/**
 * Catalogue record model produced by the parser profiles. Field names follow the Sprint 00
 * reference outputs (`tools/canon-ingestion/output/*.questions.json`) exactly, so the regression
 * test can compare them one to one and Sprint 04 (review) reads one stable shape.
 */

export type StructuralStatus = "pending" | "passed" | "passed_with_flags" | "failed";

export type Region = { page: number; bbox: [number, number, number, number] };
export type McOption = { label: string; text: string };
export type EmphasisSpan = { text: string; bold: boolean; italic: boolean; page: number };

/** The source document a record was extracted from (immutable identity: SHA-256). */
export type CanonicalDocumentInfo = {
  file: string;
  sha256: string;
  official_title: string;
  issuing_authority: string;
  page_count: number;
  version_id: string | null;
};

export type ScoredItem = {
  item_number: number;
  raw_text: string;
  options?: { label: string; text: string }[];
  answer_key_raw?: string | null;
};

export type CatalogueRecord = {
  id: string;
  subject: string;
  record_kind: "official_catalogue_question" | "official_catalogue_supplementary_task" | "official_catalogue_task";
  canonical_document: CanonicalDocumentInfo;
  source: { original_number: string; section_path: string[]; pages: number[]; regions: Region[] };
  syntax: {
    raw_text: string;
    stem_text: string | null;
    options: McOption[];
    emphasis_spans: EmphasisSpan[];
    has_figure_reference: boolean;
    notation_fidelity: "text_layer_ok" | "requires_visual_verification";
  };
  logic: {
    task_type?: string;
    task_type_evidence?: string | null;
    task_type_status?: string;
    expected_option_count?: number | null;
    sub_parts?: string[];
    scored_items?: ScoredItem[];
    scored_item_count?: number;
    points_per_item_source?: string;
    answer_key_raw?: string | null;
    answer_key_source?: string | null;
    scoring_rule_source?: string;
  };
  semantics: {
    area?: string | null;
    catalogue_level?: string | null;
    catalogue_level_status?: string;
    competency_mapping?: null;
    competency_mapping_status?: string;
  };
  stimulus?: { kind: "listening_transcript"; transcript_source_number: string; transcript_raw_text: string; audio_available_in_repository: boolean };
  validation: { structural_status: StructuralStatus; issues: string[]; trust_status: "untrusted_pending_review"; semantic_review_status: "not_started" };
  provenance: { extractor: string; extractor_version: string; method: string; extracted_at: string | null };
};

/** Per-document counts written to the ingestion report. */
export type ExtractionStats = {
  declared_total: number | null;
  declared_source: string;
  pages_processed: string;
  answers_found: number;
  per_area?: Record<string, number | { tasks: number; scored_items: number }>;
  supplementary_tasks?: number;
  listening_transcripts?: number;
};

export type ExtractionResult = { records: CatalogueRecord[]; stats: ExtractionStats };
