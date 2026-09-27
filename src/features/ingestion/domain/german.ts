import type { PdfLine, PdfText } from "../pdf-lines";
import type { CanonicalDocumentInfo, CatalogueRecord, ExtractionResult, ScoredItem } from "../types";
import { baseRecord, finaliseStructural, joined, readLines, segmentBy, splitOptions } from "./common";
import type { ParserProfile } from "./profiles";

/**
 * German catalogue ("Ispitni katalog za Njemački jezik.pdf"). Structure (catalogue §2–§4): 5 areas;
 * every scored item is worth 0.50 points. Hörverstehen, Leseverstehen, Grammatik, Kommunikation:
 * 10 tasks × 4 items; Wortschatz: 40 single-item tasks. 4.1.11–4.1.20 are the listening transcripts.
 */
const AREAS: Record<string, string> = { "1": "HÖRVERSTEHEN", "2": "LESEVERSTEHEN", "3": "WORTSCHATZ", "4": "GRAMMATIK", "5": "KOMMUNIKATION" };
const TASK = /^\s*4\.([1-5])\.(\d{1,2})\.\s*(.*)$/u;
const ITEM = /^\s*([1-4])[.)]\s*(.*)$/u;
const EXAMPLE = /^\s*(Beispiel|0[.)]|Dialog 0)/iu;

/** Classify a German task from its printed instruction line. */
export function germanTaskType(area: string, text: string): string {
  if (/richtig\s+r\s+oder\s+falsch|richtig.*oder.*falsch/iu.test(text)) return "true_false";
  if (/a,\s*b\s+oder\s+c|a\s+oder\s+b/iu.test(text) || area === "3") return "multiple_choice_single_answer";
  if (/Ergänze/u.test(text)) return text.includes("Wörter") ? "completion_from_word_bank" : "completion";
  return "unclassified";
}

/** Numbered items 1–4 of a task body, skipping the worked example (item 0). */
function parseItems(lines: readonly PdfLine[]): ScoredItem[] {
  const items: ScoredItem[] = [];
  let inExample = false;
  for (const line of lines) {
    if (EXAMPLE.test(line.text)) {
      inExample = true;
      continue;
    }
    const match = ITEM.exec(line.text);
    if (match && Number(match[1]) === items.length + 1) {
      inExample = false;
      items.push({ item_number: Number(match[1]), raw_text: match[2].trim() });
    } else if (items.length > 0 && !inExample) {
      const last = items[items.length - 1];
      last.raw_text = `${last.raw_text}\n${line.text.trim()}`.trim();
    }
  }
  return items;
}

/** Kommunikation 4.5.1–4.5.5: every printed blank (a run of underscores) is one scored item. */
function parseWordBankItems(lines: readonly PdfLine[]): ScoredItem[] {
  const items: ScoredItem[] = [];
  for (const line of lines) {
    const blanks = line.text.match(/_{5,}/gu)?.length ?? 0;
    for (let blank = 0; blank < blanks; blank += 1) items.push({ item_number: items.length + 1, raw_text: line.text.trim() });
  }
  return items;
}

/** Kommunikation 4.5.6–4.5.10: a statement followed by candidate questions 1)–3); one item per statement. */
function parseResponseChoiceItems(lines: readonly PdfLine[]): ScoredItem[] {
  const items: ScoredItem[] = [];
  for (const line of lines) {
    const option = /^\s*([1-3])\)\s*(.*)$/u.exec(line.text);
    const last = items.at(-1);
    if (option && last) {
      (last.options ??= []).push({ label: option[1], text: option[2].trim() });
    } else if (!option) {
      if (last && !last.options) last.raw_text += `\n${line.text.trim()}`;
      else items.push({ item_number: items.length + 1, raw_text: line.text.trim() });
    }
  }
  return items;
}

/** German solutions: "4.x.y." header followed by the key (same line or following lines). */
function parseSolutions(lines: readonly PdfLine[]): Map<string, string> {
  const answers = new Map<string, string>();
  let current: string | null = null;
  for (const line of lines) {
    if (/^\s*4\.[1-5]\.\s+[A-ZÄÖÜ]{4,}/u.test(line.text) || /^\s*5\.\s+RJE/u.test(line.text)) {
      current = null;
      continue;
    }
    const match = TASK.exec(line.text);
    if (match) {
      current = `4.${match[1]}.${Number(match[2])}`;
      const rest = match[3].trim();
      // Titles repeated in the key (e.g. "Frühstücksprojekt") are not answers.
      answers.set(current, /^[a-c]\)|^\d/u.test(rest) ? rest : "");
    } else if (current !== null) {
      answers.set(current, `${answers.get(current) ?? ""}\n${line.text.trim()}`.trim());
    }
  }
  return answers;
}

/** Split a task key into per-item answers ("1 f 2 r …", "3, 2, 1, 2", or sentence lines). */
export function splitGermanKey(key: string): string[] {
  const pairs = [...key.matchAll(/(?:^|\s)([1-4])\.?\s+([a-crf])(?![\p{L}\p{N}_])/gu)];
  if (pairs.length >= 4) return pairs.slice(0, 4).map((pair) => pair[2]);
  const sentences = [...key.matchAll(/^\s*[1-4]\.\s+(.+?)\s*$/gmu)];
  if (sentences.length === 4) return sentences.map((sentence) => sentence[1]);
  return key.replace(/\n/gu, " ").split(",").map((part) => part.trim()).filter(Boolean);
}

/** Extract German tasks, their scored items, answer keys and listening transcripts. */
export function extractGerman(pdf: PdfText, document: CanonicalDocumentInfo, profile: ParserProfile): ExtractionResult {
  const band = profile.header_band;
  const segments = segmentBy(
    readLines(pdf, profile.pages.tasks[0], profile.pages.tasks[1], band),
    (line, path) => {
      const match = TASK.exec(line.text);
      return match ? { number: `4.${match[1]}.${Number(match[2])}`, path } : null;
    },
    (line) => {
      const match = /^\s*4\.([1-5])\.\s+([A-ZÄÖÜ][A-ZÄÖÜ –-]+)\s*$/u.exec(line.text);
      return match ? [`4.${match[1]} ${match[2].trim()}`] : null;
    },
  );

  const answers = parseSolutions(readLines(pdf, profile.pages.solutions[0], profile.pages.solutions[1], band));
  const transcripts = new Map(segments.filter((segment) => segment.originalNumber.startsWith("4.1.") && Number(segment.originalNumber.split(".")[2]) > 10).map((segment) => [segment.originalNumber, segment]));
  const records: CatalogueRecord[] = [];
  for (const segment of segments) {
    if (transcripts.has(segment.originalNumber)) continue;
    const [, areaDigit, taskText] = segment.originalNumber.split(".");
    const taskNumber = Number(taskText);
    const record = baseRecord(document, profile.subject, segment, profile.id_prefix);
    record.record_kind = "official_catalogue_task";
    const kind = germanTaskType(areaDigit, joined(segment.lines.slice(0, 4)));
    record.syntax.stem_text = segment.lines[0].text.trim();
    const key = answers.get(segment.originalNumber);
    let items: ScoredItem[];
    let keys: string[];
    if (areaDigit === "3") {
      const { stem, options } = splitOptions(segment.lines);
      record.syntax.options = options;
      items = [{ item_number: 1, raw_text: joined(stem) }];
      keys = key ? [key] : [];
    } else if (areaDigit === "5" && taskNumber <= 5) {
      items = parseWordBankItems(segment.lines.slice(1));
      keys = key ? splitGermanKey(key) : [];
    } else if (areaDigit === "5") {
      items = parseResponseChoiceItems(segment.lines.slice(1));
      keys = key ? splitGermanKey(key) : [];
    } else {
      items = parseItems(segment.lines.slice(1));
      keys = key ? splitGermanKey(key) : [];
    }
    items.forEach((item, index) => {
      item.answer_key_raw = index < keys.length ? keys[index] : null;
    });
    const transcriptId = areaDigit === "1" ? `4.1.${taskNumber + 10}` : null;
    record.logic = {
      task_type: kind,
      task_type_evidence: "printed instruction line of the task",
      scored_items: items,
      scored_item_count: items.length,
      points_per_item_source: "catalogue §3 'Zadaci se boduju sa 0.50 bodova'",
      answer_key_raw: key ?? null,
      answer_key_source: key ? "catalogue §5 Rješenja zadataka" : null,
    };
    record.semantics = {
      area: AREAS[areaDigit],
      catalogue_level: null,
      catalogue_level_status: "not_defined_by_source (catalogue §1 targets CEFR A2.2 overall)",
      competency_mapping: null,
      competency_mapping_status: "pending_review",
    };
    const transcript = transcriptId ? transcripts.get(transcriptId) : undefined;
    if (transcriptId && transcript) {
      record.stimulus = { kind: "listening_transcript", transcript_source_number: transcriptId, transcript_raw_text: joined(transcript.lines), audio_available_in_repository: false };
      record.validation.issues.push("listening task: official audio is not in the repository; only the printed transcript");
    }
    const expectedItems = areaDigit === "3" ? 1 : 4;
    let ok = true;
    let reason: string | undefined;
    if (items.length !== expectedItems) {
      ok = false;
      reason = `expected ${expectedItems} scored item(s), found ${items.length}`;
    }
    if (areaDigit === "3" && record.syntax.options.length !== 3) {
      ok = false;
      reason = `Wortschatz item expects 3 options a)–c), found ${record.syntax.options.length}`;
    }
    if (keys.length !== expectedItems) record.validation.issues.push(`answer key yields ${keys.length} value(s) for ${expectedItems} item(s)`);
    finaliseStructural(record, ok, reason);
    records.push(record);
  }

  const perArea = Object.fromEntries(
    Object.values(AREAS).map((name) => {
      const inArea = records.filter((record) => record.semantics.area === name);
      return [name, { tasks: inArea.length, scored_items: inArea.reduce((sum, record) => sum + (record.logic.scored_item_count ?? 0), 0) }];
    }),
  );
  return {
    records,
    stats: {
      declared_total: profile.declared_total,
      declared_source: profile.declared_source,
      pages_processed: `tasks pp.${profile.pages.tasks.join("–")}, solutions pp.${profile.pages.solutions.join("–")}`,
      answers_found: answers.size,
      per_area: perArea,
      listening_transcripts: transcripts.size,
    },
  };
}
