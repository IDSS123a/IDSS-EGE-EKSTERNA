import type { PdfLine, PdfText } from "../pdf-lines";
import type { CanonicalDocumentInfo, ExtractionResult } from "../types";
import { MC_OPTION, baseRecord, finaliseStructural, joined, readLines, segmentBy, splitOptions } from "./common";
import type { ParserProfile } from "./profiles";

/**
 * Mathematics catalogue ("Ispitni katalog za Matematika.pdf"). Structure (catalogue p.4–5): 10 areas × 20
 * tasks; tasks 1–5 osnovni nivo (multiple choice, 4 options), 6–15 srednji, 16–20 napredni
 * (open, stepwise). Answers in §6 "Rješenja zadataka po oblastima".
 */
const MATH_ID = /^\s*5\.\s*(\d{1,2})\.\s*(\d{1,2})\.\s*(.*)$/u;
const MATH_AREA_LINE = /^\s*5\.(\d{1,2})\.\s*(.*)$/u;
const LEVELS: [number, number, string][] = [
  [1, 5, "osnovni nivo"],
  [6, 15, "srednji nivo"],
  [16, 20, "napredni nivo"],
];
const LEVEL_BANNER = /^\s*(I{1,3}\s+(OSNOVNI|SREDNJI|NAPREDNI)\s+NIVO|U zadacima od)/iu;

/** Catalogue-defined level of a task number (catalogue §2, p.5). */
export function mathLevel(taskNumber: number): string {
  return LEVELS.find(([low, high]) => low <= taskNumber && taskNumber <= high)?.[2] ?? "unknown";
}

/** Collect "<id> answer" blocks (answers may continue on following lines) into id → raw answer. */
export function parseKeyedSolutions(lines: readonly PdfLine[], idPattern: RegExp, keyOf: (match: RegExpExecArray) => string): Map<string, string> {
  const answers = new Map<string, string>();
  let current: string | null = null;
  for (const line of lines) {
    if (/^\s*(6\.\d+\.|I{1,3}\s+(OSNOVNI|SREDNJI|NAPREDNI)|6\.\s+RJE)/u.test(line.text)) {
      current = null;
      continue;
    }
    const match = idPattern.exec(line.text);
    if (match) {
      current = keyOf(match);
      answers.set(current, (match[match.length - 1] ?? "").trim());
    } else if (current !== null) {
      answers.set(current, `${answers.get(current) ?? ""}\n${line.text.trim()}`.trim());
    }
  }
  return answers;
}

/** Extract the 200 Mathematics catalogue tasks and their printed answers. */
export function extractMathematics(pdf: PdfText, document: CanonicalDocumentInfo, profile: ParserProfile): ExtractionResult {
  const areaNames = new Map<number, string>();
  const taskLines = readLines(pdf, profile.pages.tasks[0], profile.pages.tasks[1], profile.header_band);

  // Area headings ("5.3. Stepeni …"); a bare "5.10." line takes the next line as its name.
  const headerLines = new Set<PdfLine>();
  taskLines.forEach((line, index) => {
    if (MATH_ID.test(line.text)) return;
    const match = MATH_AREA_LINE.exec(line.text);
    if (!match) return;
    let name = match[2].trim();
    headerLines.add(line);
    if (!name && index + 1 < taskLines.length) {
      name = taskLines[index + 1].text.trim();
      headerLines.add(taskLines[index + 1]);
    }
    if (name) areaNames.set(Number(match[1]), name);
  });

  const segments = segmentBy(
    taskLines,
    (line) => {
      const match = MATH_ID.exec(line.text);
      if (!match) return null;
      const area = Number(match[1]);
      const task = Number(match[2]);
      return { number: `5.${area}.${task}`, path: [`5.${area} ${areaNames.get(area) ?? ""}`.trim(), mathLevel(task)] };
    },
    (line) => (headerLines.has(line) ? [] : null),
  );
  for (const segment of segments) segment.lines = segment.lines.filter((line) => !LEVEL_BANNER.test(line.text));

  const answers = parseKeyedSolutions(
    readLines(pdf, profile.pages.solutions[0], profile.pages.solutions[1], profile.header_band),
    MATH_ID,
    (match) => `5.${Number(match[1])}.${Number(match[2])}`,
  );
  const imagePages = new Set(pdf.imagePages);

  const records = segments.map((segment) => {
    const record = baseRecord(document, profile.subject, segment, profile.id_prefix);
    const taskNumber = Number(segment.originalNumber.split(".")[2]);
    const isMc = taskNumber <= 5;
    const { stem, options } = isMc ? splitOptions(segment.lines) : { stem: segment.lines, options: [] };
    record.syntax.stem_text = joined(stem);
    record.syntax.options = options;
    const subParts = isMc ? [] : [...new Set(segment.lines.map((line) => MC_OPTION.exec(line.text)?.[1]).filter((part): part is string => Boolean(part)))].sort();
    const key = answers.get(segment.originalNumber);
    record.logic = {
      task_type: isMc ? "multiple_choice_single_answer" : "open_constructed_response_stepwise",
      task_type_evidence: "catalogue §2 Struktura testa / section banner: tasks 1–5 circle one answer; 6–20 stepwise work",
      expected_option_count: isMc ? 4 : null,
      sub_parts: subParts,
      answer_key_raw: key ?? null,
      answer_key_source: key !== undefined ? "catalogue §6 Rješenja zadataka po oblastima" : null,
      scoring_rule_source: "catalogue §2/§3 apply to the 10-task exam test, not to individual catalogue tasks",
    };
    record.semantics = {
      area: areaNames.get(Number(segment.originalNumber.split(".")[1])) ?? null,
      catalogue_level: mathLevel(taskNumber),
      catalogue_level_status: "source_defined",
      competency_mapping: null,
      competency_mapping_status: "pending_review (catalogue lists no per-task competency)",
    };
    let ok = true;
    let reason: string | undefined;
    if (isMc && options.length === 0 && imagePages.has(segment.lines[0].page)) {
      // Graphical options (e.g. 5.10.2 cylinder nets) exist only as images on the page.
      record.syntax.notation_fidelity = "requires_visual_verification";
      record.validation.issues.push("answer options are graphics, not text: take them from the rendered source region");
    } else if (isMc && options.length !== 4) {
      ok = false;
      reason = `expected 4 options a)–d), found ${options.length}`;
    }
    if (record.logic.answer_key_raw === null) record.validation.issues.push("no answer found in catalogue solutions chapter");
    finaliseStructural(record, ok, reason);
    return record;
  });

  return {
    records,
    stats: {
      declared_total: profile.declared_total,
      declared_source: profile.declared_source,
      pages_processed: `tasks pp.${profile.pages.tasks.join("–")}, solutions pp.${profile.pages.solutions.join("–")} (PDF page numbers)`,
      answers_found: answers.size,
    },
  };
}
