import type { PdfText } from "../pdf-lines";
import type { CanonicalDocumentInfo, CatalogueRecord, ExtractionResult } from "../types";
import { baseRecord, finaliseStructural, joined, readLines, segmentBy, splitOptions } from "./common";
import type { ParserProfile } from "./profiles";

/**
 * Bosnian / Croatian / Serbian language and literature catalogue. Structure (catalogue p.3): 200
 * questions in 9 areas, numbering restarts per area; answers in §6 grouped by area; §7 "U susret
 * kurikularnoj reformi" holds 20 supplementary tasks (outside the 200, no answers).
 */
const AREAS = ["KNJIŽEVNOST", "MEDIJSKA KULTURA", "FONETIKA I FONOLOGIJA", "MORFOLOGIJA", "TVORBA RIJEČI", "SINTAKSA", "LEKSIKA", "PRAVOPIS", "HISTORIJA JEZIKA"];
const AREA_CODES = ["KNJ", "MED", "FON", "MOR", "TVO", "SIN", "LEK", "PRA", "HIS"];

/** Classify by the catalogue's own instruction verb; returns the type and the evidence phrase. */
export function bhsTaskType(text: string): { kind: string; evidence: string } {
  const lowered = text.toLowerCase();
  const verbs: [string, string][] = [
    ["poveži", "matching"],
    ["spoji", "matching"],
    ["zaokruži", "multiple_choice_single_answer"],
    ["podvuci", "marking_underline"],
    ["dopuni", "completion"],
    ["napiši", "short_constructed_response"],
    ["odredi", "short_constructed_response"],
    ["navedi", "short_constructed_response"],
    ["prepiši", "short_constructed_response"],
  ];
  for (const [needle, kind] of verbs) if (lowered.includes(needle)) return { kind, evidence: needle };
  if (/^\s*a\)/mu.test(text) && /^\s*d\)/mu.test(text)) return { kind: "multiple_choice_single_answer", evidence: "printed options a)–d)" };
  if (lowered.includes("odgovor:") || /_{8,}/u.test(text)) return { kind: "short_constructed_response", evidence: "printed answer line" };
  return { kind: "unclassified", evidence: "" };
}

function areaHeader(text: string): number | null {
  const cleaned = text.replace(/^\s*5\.\d\.?\s*/u, "").trim().toUpperCase();
  const index = AREAS.indexOf(cleaned);
  return index === -1 ? null : index;
}

/** Extract the 200 BHS catalogue questions (+20 supplementary tasks) with their answers. */
export function extractBhs(pdf: PdfText, document: CanonicalDocumentInfo, profile: ParserProfile): ExtractionResult {
  const band = profile.header_band;
  const expected = new Map<string, number>();
  let currentArea: number | null = null;

  const segments = segmentBy(
    readLines(pdf, profile.pages.tasks[0], profile.pages.tasks[1], band),
    (line, path) => {
      if (currentArea === null) return null;
      const code = AREA_CODES[currentArea];
      const want = expected.get(code) ?? 1;
      if (new RegExp(`^\\s*${want}\\.\\s+\\S`, "u").test(line.text)) {
        expected.set(code, want + 1);
        return { number: `${code}.${want}`, path };
      }
      return null;
    },
    (line) => {
      const index = areaHeader(line.text);
      if (index === null) return null;
      currentArea = index;
      expected.set(AREA_CODES[index], 1);
      return [`5.${index + 1} ${AREAS[index]}`];
    },
  );

  const answers = new Map<string, string>();
  let areaIndex: number | null = null;
  let current: string | null = null;
  let want = 1;
  for (const line of readLines(pdf, profile.pages.solutions[0], profile.pages.solutions[1], band)) {
    const index = areaHeader(line.text);
    if (index !== null) {
      areaIndex = index;
      want = 1;
      current = null;
      continue;
    }
    if (areaIndex === null) continue;
    const match = new RegExp(`^\\s*${want}\\.\\s*(.*)$`, "u").exec(line.text);
    if (match) {
      current = `${AREA_CODES[areaIndex]}.${want}`;
      answers.set(current, match[1].trim());
      want += 1;
    } else if (current !== null) {
      answers.set(current, `${answers.get(current) ?? ""}\n${line.text.trim()}`.trim());
    }
  }

  const records: CatalogueRecord[] = segments.map((segment) => {
    const record = baseRecord(document, profile.subject, segment, profile.id_prefix);
    const { kind, evidence } = bhsTaskType(joined(segment.lines));
    const { stem, options } = kind === "multiple_choice_single_answer" ? splitOptions(segment.lines) : { stem: segment.lines, options: [] };
    record.syntax.stem_text = joined(stem);
    record.syntax.options = options;
    const key = answers.get(segment.originalNumber);
    record.logic = {
      task_type: kind,
      task_type_evidence: evidence ? `source wording: '${evidence}'` : null,
      task_type_status: "derived_from_source_wording",
      answer_key_raw: key ?? null,
      answer_key_source: key !== undefined ? "catalogue §6 Rješenja zadataka" : null,
      scoring_rule_source: "catalogue §4 applies to the 18-question exam test, not to individual catalogue questions",
    };
    const area = segment.sectionPath[0] ? segment.sectionPath[0].split(" ").slice(1).join(" ") : null;
    record.semantics = {
      area,
      catalogue_level: null,
      catalogue_level_status: "not_defined_by_source",
      competency_mapping: null,
      competency_mapping_status: "pending_review (catalogue §1 lists outcomes, not per-question mapping)",
    };
    let ok = true;
    let reason: string | undefined;
    if (kind === "multiple_choice_single_answer" && ![3, 4].includes(options.length)) {
      ok = false;
      reason = `multiple choice expects 3–4 options (catalogue §3), found ${options.length}`;
    }
    if (kind === "unclassified") record.validation.issues.push("task type could not be derived from wording");
    if (record.logic.answer_key_raw === null) record.validation.issues.push("no answer found in catalogue solutions chapter");
    finaliseStructural(record, ok, reason);
    return record;
  });

  const supplementary: CatalogueRecord[] = [];
  if (profile.pages.supplementary) {
    let reformWant = 1;
    const reformSegments = segmentBy(
      readLines(pdf, profile.pages.supplementary[0], profile.pages.supplementary[1], band),
      (line) => {
        if (!new RegExp(`^\\s*${reformWant}\\.\\s+\\S`, "u").test(line.text)) return null;
        const number = reformWant;
        reformWant += 1;
        return { number: `REF.${number}`, path: ["7 U SUSRET KURIKULARNOJ REFORMI"] };
      },
      () => null,
    );
    for (const segment of reformSegments) {
      const record = baseRecord(document, profile.subject, segment, profile.id_prefix);
      record.record_kind = "official_catalogue_supplementary_task";
      record.syntax.stem_text = joined(segment.lines);
      record.logic = { task_type: "open_extended_response", answer_key_raw: null, answer_key_source: null };
      record.semantics = { area: "U susret kurikularnoj reformi", catalogue_level: null, catalogue_level_status: "not_defined_by_source", competency_mapping: null, competency_mapping_status: "pending_review" };
      record.validation.issues.push("supplementary task: outside the declared 200; no answer key in source");
      finaliseStructural(record, true);
      supplementary.push(record);
    }
  }

  const perArea = Object.fromEntries(AREA_CODES.map((code) => [code, records.filter((record) => record.source.original_number.startsWith(`${code}.`)).length]));
  return {
    records: [...records, ...supplementary],
    stats: {
      declared_total: profile.declared_total,
      declared_source: profile.declared_source,
      pages_processed: `questions pp.${profile.pages.tasks.join("–")}, solutions pp.${profile.pages.solutions.join("–")}${profile.pages.supplementary ? `, supplementary pp.${profile.pages.supplementary.join("–")}` : ""}`,
      answers_found: answers.size,
      per_area: perArea,
      supplementary_tasks: supplementary.length,
    },
  };
}
