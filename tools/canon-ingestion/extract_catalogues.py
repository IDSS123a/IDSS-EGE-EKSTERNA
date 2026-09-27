#!/usr/bin/env python3
"""
IDSS EGE — Canonical catalogue ingestion (Sprint 00 evidence tool).

Purpose
    Deterministically extract every catalogue question from the three official
    subject catalogues (Bosnian/Croatian/Serbian language & literature,
    Mathematics, German) into structured, provenance-carrying records, attach
    the answer key printed in the same catalogue, run structural validation,
    and write an auditable ingestion report.

What this tool deliberately does NOT do (INSTRUCTION §0, §13A, M-4)
    - It never paraphrases canonical text; `syntax.raw_text` is the PDF text
      layer exactly as extracted (whitespace-normalised only at line ends).
    - It never invents answers: `logic.answer_key_raw` is copied from the
      catalogue's own solutions chapter or left null.
    - It never marks a record as trusted. Every record leaves this tool with
      `validation.trust_status = "untrusted_pending_review"`. Structural
      validation (this tool) and semantic/source validation (a human reviewer
      comparing against the rendered page region in `source.regions`) are
      separate gates.

Run
    pip install pymupdf
    python tools/canon-ingestion/extract_catalogues.py
Output
    tools/canon-ingestion/output/<subject>.questions.json
    tools/canon-ingestion/output/INGESTION_REPORT.md
"""
from __future__ import annotations

import datetime as _dt
import hashlib
import json
import re
from dataclasses import dataclass, field
from pathlib import Path
from typing import Callable, Optional

import pymupdf  # PyMuPDF >= 1.24

EXTRACTOR_VERSION = "0.1.0"
REPO_ROOT = Path(__file__).resolve().parents[2]
OUTPUT_DIR = Path(__file__).resolve().parent / "output"

# Header/footer bands (PDF points) measured per document during discovery.
# Lines whose bbox falls inside these bands are running headers/footers
# ("EKSTERNA MATURA", subject name, ministry name, printed page number).
FOOTER_BAND_POINTS = 75

# Characters that indicate mathematical notation whose 2-D layout (stacked
# fractions, exponents, radicals) the PDF text layer cannot represent
# faithfully. Their presence forces visual verification of the record.
MATH_LAYOUT_MARKERS = re.compile(r"[√∙⋅∶±≠≤≥°²³∈∉⊂∪∩π]|[\U0001D400-\U0001D7FF]")
FIGURE_REFERENCE = re.compile(r"\b(crtež|crtežu|slici|slika|sliku|grafik|grafiku|tabel|shem)", re.IGNORECASE)
MC_OPTION = re.compile(r"^\s*([a-d])\)\s*(.*)$")


# --------------------------------------------------------------------------- #
# Low-level text model
# --------------------------------------------------------------------------- #
@dataclass
class Line:
    """One visual text line of the PDF with its location (1-based page)."""
    page: int
    text: str
    bbox: tuple[float, float, float, float]
    emphasis: list[dict] = field(default_factory=list)


def sha256_of(path: Path) -> str:
    """Return the SHA-256 hex digest of a file (immutable source identity)."""
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1 << 20), b""):
            digest.update(chunk)
    return digest.hexdigest()


def read_lines(pdf: pymupdf.Document, first_page: int, last_page: int, header_band: float) -> list[Line]:
    """Return body text lines for the inclusive 1-based page range, dropping headers/footers."""
    lines: list[Line] = []
    for page_number in range(first_page, last_page + 1):
        page = pdf[page_number - 1]
        footer_limit = page.rect.height - FOOTER_BAND_POINTS
        for block in page.get_text("dict")["blocks"]:
            for raw in block.get("lines", []):
                text = "".join(span["text"] for span in raw["spans"]).rstrip()
                x0, y0, x1, y1 = raw["bbox"]
                if y1 <= header_band or y0 >= footer_limit:
                    continue
                if not text.strip():
                    continue
                # Bold/italic carries meaning ("istaknute riječi" = the emphasised words), so it is
                # preserved alongside the plain text rather than dropped.
                emphasis = [{"text": span["text"], "bold": bool(span["flags"] & 16), "italic": bool(span["flags"] & 2)}
                            for span in raw["spans"] if span["text"].strip() and span["flags"] & (16 | 2)]
                lines.append(Line(page_number, text, (x0, y0, x1, y1), emphasis))
    return lines


def regions_of(lines: list[Line]) -> list[dict]:
    """Collapse lines into one bounding region per page (for rendering the original)."""
    by_page: dict[int, list[float]] = {}
    for line in lines:
        box = by_page.setdefault(line.page, [1e9, 1e9, -1e9, -1e9])
        box[0] = min(box[0], line.bbox[0]); box[1] = min(box[1], line.bbox[1])
        box[2] = max(box[2], line.bbox[2]); box[3] = max(box[3], line.bbox[3])
    return [{"page": page, "bbox": [round(v, 1) for v in box]} for page, box in sorted(by_page.items())]


def joined(lines: list[Line]) -> str:
    """Join line texts with newlines, preserving the source order."""
    return "\n".join(line.text for line in lines).strip()


# --------------------------------------------------------------------------- #
# Record construction (shared by all subjects)
# --------------------------------------------------------------------------- #
@dataclass
class Segment:
    """A contiguous run of lines belonging to one catalogue question/task."""
    original_number: str
    section_path: list[str]
    lines: list[Line] = field(default_factory=list)


def split_options(lines: list[Line]) -> tuple[list[Line], list[dict]]:
    """Split a multiple-choice question into stem lines and a) .. d) options (continuations appended)."""
    stem: list[Line] = []
    options: list[dict] = []
    for line in lines:
        match = MC_OPTION.match(line.text)
        if match and (not options or ord(match.group(1)) == ord(options[-1]["label"]) + 1) \
                and (options or match.group(1) == "a"):
            options.append({"label": match.group(1), "text": match.group(2).strip()})
        elif options:
            options[-1]["text"] = (options[-1]["text"] + "\n" + line.text.strip()).strip()
        else:
            stem.append(line)
    return stem, options


def base_record(document: dict, subject: str, segment: Segment, id_prefix: str) -> dict:
    """Build the common record skeleton with syntax + provenance layers filled."""
    raw_text = joined(segment.lines)
    issues: list[str] = []
    fidelity = "text_layer_ok"
    if MATH_LAYOUT_MARKERS.search(raw_text) or re.search(r"^\s*\d+\s*$", raw_text, re.M):
        fidelity = "requires_visual_verification"
        issues.append("2-D notation (fractions/exponents/radicals) not representable in PDF text layer")
    has_figure = bool(FIGURE_REFERENCE.search(raw_text))
    if has_figure:
        issues.append("references a figure/table: stimulus must be taken from the rendered source region")
    return {
        "id": f"{id_prefix}-{segment.original_number}",
        "subject": subject,
        "record_kind": "official_catalogue_question",
        "canonical_document": document,
        "source": {
            "original_number": segment.original_number,
            "section_path": segment.section_path,
            "pages": sorted({line.page for line in segment.lines}),
            "regions": regions_of(segment.lines),
        },
        "syntax": {
            "raw_text": raw_text,
            "stem_text": None,
            "options": [],
            "emphasis_spans": [dict(span, page=line.page) for line in segment.lines for span in line.emphasis],
            "has_figure_reference": has_figure,
            "notation_fidelity": fidelity,
        },
        "logic": {},
        "semantics": {},
        "validation": {
            "structural_status": "pending",
            "issues": issues,
            "trust_status": "untrusted_pending_review",
            "semantic_review_status": "not_started",
        },
        "provenance": {
            "extractor": "tools/canon-ingestion/extract_catalogues.py",
            "extractor_version": EXTRACTOR_VERSION,
            "method": "PyMuPDF text layer + deterministic segmentation (no AI, no OCR)",
            "extracted_at": None,  # filled once per run
        },
    }


def finalise_structural(record: dict, required_ok: bool, reason: Optional[str] = None) -> None:
    """Set structural status: 'passed', 'passed_with_flags' or 'failed' (reason recorded)."""
    validation = record["validation"]
    if not required_ok:
        validation["structural_status"] = "failed"
        if reason:
            validation["issues"].append(reason)
    elif validation["issues"]:
        validation["structural_status"] = "passed_with_flags"
    else:
        validation["structural_status"] = "passed"


def segment_by(lines: list[Line], start: Callable[[Line, list[str]], Optional[tuple[str, list[str]]]],
               section: Callable[[Line], Optional[list[str]]]) -> list[Segment]:
    """Generic segmenter: `section` updates the section path, `start` opens a new segment."""
    segments: list[Segment] = []
    path: list[str] = []
    current: Optional[Segment] = None
    for line in lines:
        new_path = section(line)
        if new_path is not None:
            path = new_path
            current = None
            continue
        opened = start(line, path)
        if opened:
            number, seg_path = opened
            current = Segment(number, seg_path, [line])
            segments.append(current)
        elif current is not None:
            current.lines.append(line)
    return segments


# --------------------------------------------------------------------------- #
# Mathematics — "Ispitni katalog za Matematika.pdf"
# Structure (catalogue p.4–5): 10 areas × 20 tasks; tasks 1–5 osnovni nivo
# (MC, 4 options), 6–15 srednji nivo, 16–20 napredni nivo (open, stepwise).
# --------------------------------------------------------------------------- #
MATH_ID = re.compile(r"^\s*5\.\s*(\d{1,2})\.\s*(\d{1,2})\.\s*(.*)$")
MATH_AREA = re.compile(r"^\s*5\.(\d{1,2})\.\s{2,}(\S.*)$|^\s*5\.(10)\.\s+(\S.*)$")
MATH_SOLUTION_ID = re.compile(r"^\s*5\.\s*(\d{1,2})\.\s*(\d{1,2})\.\s*(.*)$")
MATH_LEVELS = [(1, 5, "osnovni nivo"), (6, 15, "srednji nivo"), (16, 20, "napredni nivo")]


def math_level(task_number: int) -> str:
    """Return the catalogue-defined level for a task number (catalogue §2, p.5)."""
    for low, high, name in MATH_LEVELS:
        if low <= task_number <= high:
            return name
    return "unknown"


def extract_mathematics(pdf: pymupdf.Document, document: dict) -> tuple[list[dict], dict]:
    """Extract the 200 Mathematics catalogue tasks and their printed answers."""
    area_names: dict[int, str] = {}
    task_lines = read_lines(pdf, 23, 55, header_band=62)

    # Area headings ("5.3.  Stepeni …"); the 5.10 heading is split over two text lines
    # ("5.10." / "Geometrijska tijela …"), so a bare number line takes the next line as its name.
    header_line_ids: set[int] = set()
    for index, line in enumerate(task_lines):
        if MATH_ID.match(line.text):
            continue
        match = re.match(r"^\s*5\.(\d{1,2})\.\s*(.*)$", line.text)
        if not match:
            continue
        name = match.group(2).strip()
        header_line_ids.add(id(line))
        if not name and index + 1 < len(task_lines):
            name = task_lines[index + 1].text.strip()
            header_line_ids.add(id(task_lines[index + 1]))
        if name:
            area_names[int(match.group(1))] = name

    def section(line: Line) -> Optional[list[str]]:
        return [] if id(line) in header_line_ids else None

    def start(line: Line, path: list[str]) -> Optional[tuple[str, list[str]]]:
        match = MATH_ID.match(line.text)
        if not match:
            return None
        area, task = int(match.group(1)), int(match.group(2))
        return f"5.{area}.{task}", [f"5.{area} {area_names.get(area, '')}".strip(), math_level(task)]

    segments = segment_by(task_lines, start, section)
    # Level banners ("I OSNOVNI NIVO", instructions) are not part of the task text.
    banner = re.compile(r"^\s*(I{1,3}\s+(OSNOVNI|SREDNJI|NAPREDNI)\s+NIVO|U zadacima od)", re.IGNORECASE)
    for segment in segments:
        segment.lines = [line for line in segment.lines if not banner.match(line.text)]

    answers = parse_keyed_solutions(read_lines(pdf, 57, 68, header_band=62), MATH_SOLUTION_ID,
                                    lambda m: f"5.{int(m.group(1))}.{int(m.group(2))}")
    records = []
    for segment in segments:
        record = base_record(document, "mathematics", segment, "MAT")
        task_number = int(segment.original_number.split(".")[2])
        is_mc = task_number <= 5
        stem, options = split_options(segment.lines) if is_mc else (segment.lines, [])
        record["syntax"]["stem_text"] = joined(stem)
        record["syntax"]["options"] = options
        sub_parts = sorted({m.group(1) for m in (MC_OPTION.match(l.text) for l in segment.lines) if m}) if not is_mc else []
        record["logic"] = {
            "task_type": "multiple_choice_single_answer" if is_mc else "open_constructed_response_stepwise",
            "task_type_evidence": "catalogue §2 Struktura testa / section banner: tasks 1–5 circle one answer; 6–20 stepwise work",
            "expected_option_count": 4 if is_mc else None,
            "sub_parts": sub_parts,
            "answer_key_raw": answers.get(segment.original_number),
            "answer_key_source": "catalogue §6 Rješenja zadataka po oblastima" if segment.original_number in answers else None,
            "scoring_rule_source": "catalogue §2/§3 apply to the 10-task exam test, not to individual catalogue tasks",
        }
        record["semantics"] = {
            "area": area_names.get(int(segment.original_number.split(".")[1])),
            "catalogue_level": math_level(task_number),
            "catalogue_level_status": "source_defined",
            "competency_mapping": None,
            "competency_mapping_status": "pending_review (catalogue lists no per-task competency)",
        }
        ok = True
        reason = None
        if is_mc and len(options) == 0 and pdf[segment.lines[0].page - 1].get_images():
            # Graphical options (e.g. 5.10.2 cylinder nets) exist only as images on the page.
            record["syntax"]["notation_fidelity"] = "requires_visual_verification"
            record["validation"]["issues"].append("answer options are graphics, not text: take them from the rendered source region")
        elif is_mc and len(options) != 4:
            ok, reason = False, f"expected 4 options a)–d), found {len(options)}"
        if record["logic"]["answer_key_raw"] is None:
            record["validation"]["issues"].append("no answer found in catalogue solutions chapter")
        finalise_structural(record, ok, reason)
        records.append(record)

    stats = {"declared_total": 200, "declared_source": "catalogue §2: '200 zadataka … 10 oblasti po 20 zadataka'",
             "pages_processed": "tasks pp.23–55, solutions pp.57–68 (PDF page numbers)",
             "answers_found": len(answers)}
    return records, stats


def parse_keyed_solutions(lines: list[Line], id_pattern: re.Pattern, key_of: Callable) -> dict[str, str]:
    """Collect '<id> answer…' blocks (answer may continue on following lines) into id → raw answer."""
    answers: dict[str, str] = {}
    current: Optional[str] = None
    for line in lines:
        if re.match(r"^\s*(6\.\d+\.|I{1,3}\s+(OSNOVNI|SREDNJI|NAPREDNI)|6\.\s+RJE)", line.text):
            current = None
            continue
        match = id_pattern.match(line.text)
        if match:
            current = key_of(match)
            answers[current] = match.group(match.lastindex).strip()
        elif current is not None:
            answers[current] = (answers[current] + "\n" + line.text.strip()).strip()
    return answers


# --------------------------------------------------------------------------- #
# Bosnian / Croatian / Serbian language and literature — BHS catalogue
# Structure (catalogue p.3): 200 questions in 9 areas, numbering restarts per
# area; solutions in §6 grouped by area; §7 "U susret kurikularnoj reformi"
# holds 20 supplementary tasks (outside the 200).
# --------------------------------------------------------------------------- #
BHS_AREAS = ["KNJIŽEVNOST", "MEDIJSKA KULTURA", "FONETIKA I FONOLOGIJA", "MORFOLOGIJA", "TVORBA RIJEČI",
             "SINTAKSA", "LEKSIKA", "PRAVOPIS", "HISTORIJA JEZIKA"]
BHS_AREA_CODES = ["KNJ", "MED", "FON", "MOR", "TVO", "SIN", "LEK", "PRA", "HIS"]


def bhs_task_type(text: str) -> tuple[str, str]:
    """Classify by the catalogue's own instruction verb; returns (type, evidence phrase)."""
    lowered = text.lower()
    for needle, kind in [("poveži", "matching"), ("spoji", "matching"), ("zaokruži", "multiple_choice_single_answer"),
                         ("podvuci", "marking_underline"), ("dopuni", "completion"),
                         ("napiši", "short_constructed_response"), ("odredi", "short_constructed_response"),
                         ("navedi", "short_constructed_response"), ("prepiši", "short_constructed_response")]:
        if needle in lowered:
            return kind, needle
    if re.search(r"^\s*a\)", text, re.M) and re.search(r"^\s*d\)", text, re.M):
        return "multiple_choice_single_answer", "printed options a)–d)"
    if "odgovor:" in lowered or re.search(r"_{8,}", text):
        return "short_constructed_response", "printed answer line"
    return "unclassified", ""


def extract_bhs(pdf: pymupdf.Document, document: dict) -> tuple[list[dict], dict]:
    """Extract the 200 BHS catalogue questions (+20 supplementary reform tasks) with answers."""
    def area_header(text: str) -> Optional[int]:
        cleaned = re.sub(r"^\s*5\.\d\.?\s*", "", text).strip().upper()
        return BHS_AREAS.index(cleaned) if cleaned in BHS_AREAS else None

    records: list[dict] = []
    expected: dict[str, int] = {}

    def make_segmenter(prefix_for_area: Callable[[int], list[str]]):
        state = {"area": None}

        def section(line: Line) -> Optional[list[str]]:
            index = area_header(line.text)
            if index is not None:
                state["area"] = index
                expected[BHS_AREA_CODES[index]] = 1
                return prefix_for_area(index)
            return None

        def start(line: Line, path: list[str]) -> Optional[tuple[str, list[str]]]:
            if state["area"] is None:
                return None
            code = BHS_AREA_CODES[state["area"]]
            want = expected[code]
            if re.match(rf"^\s*{want}\.\s+\S", line.text):
                expected[code] = want + 1
                return f"{code}.{want}", path
            return None
        return section, start

    section, start = make_segmenter(lambda i: [f"5.{i + 1} {BHS_AREAS[i]}"])
    segments = segment_by(read_lines(pdf, 9, 58, header_band=78), start, section)
    # Area introductions ("Čak 48 pitanja …") precede question 1 and are dropped by the segmenter.

    solution_lines = read_lines(pdf, 59, 71, header_band=78)
    answers: dict[str, str] = {}
    area_index: Optional[int] = None
    current: Optional[str] = None
    want = 1
    for line in solution_lines:
        index = area_header(line.text)
        if index is not None:
            area_index, want, current = index, 1, None
            continue
        if area_index is None:
            continue
        match = re.match(rf"^\s*{want}\.\s*(.*)$", line.text)
        if match:
            current = f"{BHS_AREA_CODES[area_index]}.{want}"
            answers[current] = match.group(1).strip()
            want += 1
        elif current is not None:
            answers[current] = (answers[current] + "\n" + line.text.strip()).strip()

    for segment in segments:
        record = base_record(document, "bhs_language_literature", segment, "BHS")
        kind, evidence = bhs_task_type(joined(segment.lines))
        stem, options = split_options(segment.lines) if kind == "multiple_choice_single_answer" else (segment.lines, [])
        record["syntax"]["stem_text"] = joined(stem)
        record["syntax"]["options"] = options
        record["logic"] = {
            "task_type": kind,
            "task_type_evidence": f"source wording: '{evidence}'" if evidence else None,
            "task_type_status": "derived_from_source_wording",
            "answer_key_raw": answers.get(segment.original_number),
            "answer_key_source": "catalogue §6 Rješenja zadataka" if segment.original_number in answers else None,
            "scoring_rule_source": "catalogue §4 applies to the 18-question exam test, not to individual catalogue questions",
        }
        area = segment.section_path[0].split(" ", 1)[1] if segment.section_path else None
        record["semantics"] = {
            "area": area,
            "catalogue_level": None,
            "catalogue_level_status": "not_defined_by_source",
            "competency_mapping": None,
            "competency_mapping_status": "pending_review (catalogue §1 lists outcomes, not per-question mapping)",
        }
        ok, reason = True, None
        if kind == "multiple_choice_single_answer" and len(options) not in (3, 4):
            ok, reason = False, f"multiple choice expects 3–4 options (catalogue §3), found {len(options)}"
        if kind == "unclassified":
            record["validation"]["issues"].append("task type could not be derived from wording")
        if record["logic"]["answer_key_raw"] is None:
            record["validation"]["issues"].append("no answer found in catalogue solutions chapter")
        finalise_structural(record, ok, reason)
        records.append(record)

    # Supplementary §7 tasks: numbered 1..20, open tasks, no answer key.
    reform_lines = read_lines(pdf, 72, 81, header_band=78)
    reform_want = {"n": 1}

    def reform_start(line: Line, path: list[str]) -> Optional[tuple[str, list[str]]]:
        if re.match(rf"^\s*{reform_want['n']}\.\s+\S", line.text):
            number = reform_want["n"]; reform_want["n"] += 1
            return f"REF.{number}", ["7 U SUSRET KURIKULARNOJ REFORMI"]
        return None

    reform_segments = segment_by(reform_lines, reform_start, lambda line: None)
    supplementary = []
    for segment in reform_segments:
        record = base_record(document, "bhs_language_literature", segment, "BHS")
        record["record_kind"] = "official_catalogue_supplementary_task"
        record["syntax"]["stem_text"] = joined(segment.lines)
        record["logic"] = {"task_type": "open_extended_response", "answer_key_raw": None, "answer_key_source": None}
        record["semantics"] = {"area": "U susret kurikularnoj reformi", "catalogue_level": None,
                               "catalogue_level_status": "not_defined_by_source", "competency_mapping": None,
                               "competency_mapping_status": "pending_review"}
        record["validation"]["issues"].append("supplementary task: outside the declared 200; no answer key in source")
        finalise_structural(record, True)
        supplementary.append(record)

    per_area = {code: sum(1 for r in records if r["source"]["original_number"].startswith(code + "."))
                for code in BHS_AREA_CODES}
    stats = {"declared_total": 200, "declared_source": "catalogue Uvod p.3: 'Katalog sadrži 200 pitanja sa rješenjima'",
             "pages_processed": "questions pp.9–58, solutions pp.59–71, supplementary pp.72–81",
             "answers_found": len(answers), "per_area": per_area,
             "supplementary_tasks": len(supplementary)}
    return records + supplementary, stats


# --------------------------------------------------------------------------- #
# German — "Ispitni katalog za Njemački jezik.pdf"
# Structure (catalogue §2–§4): 5 areas; every scored item is worth 0.50 points.
# Hörverstehen/Leseverstehen/Grammatik/Kommunikation: 10 tasks × 4 items;
# Wortschatz: 40 single-item tasks. 4.1.11–4.1.20 are listening transcripts.
# --------------------------------------------------------------------------- #
DE_AREAS = {"1": "HÖRVERSTEHEN", "2": "LESEVERSTEHEN", "3": "WORTSCHATZ", "4": "GRAMMATIK", "5": "KOMMUNIKATION"}
DE_TASK = re.compile(r"^\s*4\.([1-5])\.(\d{1,2})\.\s*(.*)$")
DE_ITEM = re.compile(r"^\s*([1-4])[.)]\s*(.*)$")
DE_EXAMPLE = re.compile(r"^\s*(Beispiel|0[.)]|Dialog 0)", re.IGNORECASE)


def de_task_type(area: str, text: str) -> str:
    """Classify a German task from its printed instruction line."""
    if re.search(r"richtig\s+r\s+oder\s+falsch|richtig.*oder.*falsch", text, re.IGNORECASE):
        return "true_false"
    if re.search(r"a,\s*b\s+oder\s+c|a\s+oder\s+b", text, re.IGNORECASE) or area == "3":
        return "multiple_choice_single_answer"
    if re.search(r"Ergänze", text):
        return "completion_from_word_bank" if "Wörter" in text else "completion"
    return "unclassified"


def parse_de_items(lines: list[Line]) -> list[dict]:
    """Split a task body into its numbered items 1–4, skipping the worked example (item 0)."""
    items: list[dict] = []
    in_example = False
    for line in lines:
        if DE_EXAMPLE.match(line.text):
            in_example = True
            continue
        match = DE_ITEM.match(line.text)
        if match and int(match.group(1)) == len(items) + 1:
            in_example = False
            items.append({"item_number": int(match.group(1)), "raw_text": match.group(2).strip()})
        elif items and not in_example:
            items[-1]["raw_text"] = (items[-1]["raw_text"] + "\n" + line.text.strip()).strip()
    return items


def parse_de_word_bank_items(lines: list[Line]) -> list[dict]:
    """Kommunikation 4.5.1–4.5.5: every printed blank (a run of underscores) is one scored item."""
    items: list[dict] = []
    for line in lines:
        for _ in re.findall(r"_{5,}", line.text):
            items.append({"item_number": len(items) + 1, "raw_text": line.text.strip()})
    return items


def parse_de_response_choice_items(lines: list[Line]) -> list[dict]:
    """Kommunikation 4.5.6–4.5.10: a statement followed by candidate questions 1)–3); one item per statement."""
    items: list[dict] = []
    for line in lines:
        option = re.match(r"^\s*([1-3])\)\s*(.*)$", line.text)
        if option and items:
            items[-1].setdefault("options", []).append({"label": option.group(1), "text": option.group(2).strip()})
        elif not option:
            if items and "options" not in items[-1]:
                items[-1]["raw_text"] += "\n" + line.text.strip()
            else:
                items.append({"item_number": len(items) + 1, "raw_text": line.text.strip()})
    return items


def extract_german(pdf: pymupdf.Document, document: dict) -> tuple[list[dict], dict]:
    """Extract German tasks, their scored items, answer keys and listening transcripts."""
    lines = read_lines(pdf, 10, 62, header_band=68)

    def section(line: Line) -> Optional[list[str]]:
        match = re.match(r"^\s*4\.([1-5])\.\s+([A-ZÄÖÜ][A-ZÄÖÜ –-]+)\s*$", line.text)
        return [f"4.{match.group(1)} {match.group(2).strip()}"] if match else None

    def start(line: Line, path: list[str]) -> Optional[tuple[str, list[str]]]:
        match = DE_TASK.match(line.text)
        return (f"4.{match.group(1)}.{int(match.group(2))}", path) if match else None

    segments = segment_by(lines, start, section)
    # Kommunikation prints the worked example "Dialog 0" before 4.5.1; it is not a task.

    answers = parse_de_solutions(read_lines(pdf, 64, 67, header_band=68))
    transcripts = {s.original_number: s for s in segments
                   if s.original_number.startswith("4.1.") and int(s.original_number.split(".")[2]) > 10}
    records: list[dict] = []
    for segment in segments:
        if segment.original_number in transcripts:
            continue
        area_digit, task_number = segment.original_number.split(".")[1], int(segment.original_number.split(".")[2])
        record = base_record(document, "german", segment, "DEU")
        record["record_kind"] = "official_catalogue_task"
        title_line = segment.lines[0].text
        kind = de_task_type(area_digit, joined(segment.lines[:4]))
        record["syntax"]["stem_text"] = title_line.strip()
        key = answers.get(segment.original_number)
        if area_digit == "3":
            stem, options = split_options(segment.lines)
            record["syntax"]["options"] = options
            items = [{"item_number": 1, "raw_text": joined(stem)}]
            keys = [key] if key else []
        elif area_digit == "5" and task_number <= 5:
            items = parse_de_word_bank_items(segment.lines[1:])
            keys = split_de_key(key) if key else []
        elif area_digit == "5":
            items = parse_de_response_choice_items(segment.lines[1:])
            keys = split_de_key(key) if key else []
        else:
            items = parse_de_items(segment.lines[1:])
            keys = split_de_key(key) if key else []
        for index, item in enumerate(items):
            item["answer_key_raw"] = keys[index] if index < len(keys) else None
        transcript_id = f"4.1.{task_number + 10}" if area_digit == "1" else None
        record["logic"] = {
            "task_type": kind,
            "task_type_evidence": "printed instruction line of the task",
            "scored_items": items,
            "scored_item_count": len(items),
            "points_per_item_source": "catalogue §3 'Zadaci se boduju sa 0.50 bodova'",
            "answer_key_raw": key,
            "answer_key_source": "catalogue §5 Rješenja zadataka" if key else None,
        }
        record["semantics"] = {
            "area": DE_AREAS[area_digit],
            "catalogue_level": None,
            "catalogue_level_status": "not_defined_by_source (catalogue §1 targets CEFR A2.2 overall)",
            "competency_mapping": None,
            "competency_mapping_status": "pending_review",
        }
        if transcript_id and transcript_id in transcripts:
            record["stimulus"] = {"kind": "listening_transcript", "transcript_source_number": transcript_id,
                                  "transcript_raw_text": joined(transcripts[transcript_id].lines),
                                  "audio_available_in_repository": False}
            record["validation"]["issues"].append("listening task: official audio is not in the repository; only the printed transcript")
        expected_items = 1 if area_digit == "3" else 4
        ok, reason = True, None
        if len(items) != expected_items:
            ok, reason = False, f"expected {expected_items} scored item(s), found {len(items)}"
        if area_digit == "3" and len(record["syntax"]["options"]) != 3:
            ok, reason = False, f"Wortschatz item expects 3 options a)–c), found {len(record['syntax']['options'])}"
        if len(keys) != expected_items:
            record["validation"]["issues"].append(f"answer key yields {len(keys)} value(s) for {expected_items} item(s)")
        finalise_structural(record, ok, reason)
        records.append(record)

    per_area = {}
    for digit, name in DE_AREAS.items():
        area_records = [r for r in records if r["semantics"]["area"] == name]
        per_area[name] = {"tasks": len(area_records),
                          "scored_items": sum(r["logic"]["scored_item_count"] for r in area_records)}
    stats = {"declared_total": None,
             "declared_source": "catalogue declares no total; §2 lists 5 areas × 2 points, §3 0.50 points per item",
             "pages_processed": "tasks pp.10–62, solutions pp.64–67",
             "answers_found": len(answers), "per_area": per_area,
             "listening_transcripts": len(transcripts)}
    return records, stats


def parse_de_solutions(lines: list[Line]) -> dict[str, str]:
    """German solutions: '4.x.y.' header followed by the key (same line or following lines)."""
    answers: dict[str, str] = {}
    current: Optional[str] = None
    for line in lines:
        if re.match(r"^\s*4\.[1-5]\.\s+[A-ZÄÖÜ]{4,}", line.text) or re.match(r"^\s*5\.\s+RJE", line.text):
            current = None
            continue
        match = DE_TASK.match(line.text)
        if match:
            current = f"4.{match.group(1)}.{int(match.group(2))}"
            rest = match.group(3).strip()
            # Titles repeated in the key (e.g. "Frühstücksprojekt") are not answers.
            answers[current] = rest if re.match(r"^[a-c]\)|^\d", rest) else ""
        elif current is not None:
            answers[current] = (answers[current] + "\n" + line.text.strip()).strip()
    return answers


def split_de_key(key: str) -> list[str]:
    """Split a task key into per-item answers ('1 f 2 r …', '3, 2, 1, 2', or sentence lines)."""
    pairs = re.findall(r"(?:^|\s)([1-4])\.?\s+([a-crf])\b", key)
    if len(pairs) >= 4:
        return [value for _, value in pairs[:4]]
    sentences = re.findall(r"(?m)^\s*[1-4]\.\s+(.+?)\s*$", key)
    if len(sentences) == 4:
        return sentences
    flat = [part.strip() for part in re.split(r",", key.replace("\n", " ")) if part.strip()]
    return flat


# --------------------------------------------------------------------------- #
# Orchestration + report
# --------------------------------------------------------------------------- #
CATALOGUES = [
    {"subject": "mathematics", "file": "Ispitni katalog za Matematika.pdf",
     "official_title": "Eksterna matura — Matematika: Ispitni katalog pitanja", "extract": extract_mathematics},
    {"subject": "bhs_language_literature", "file": "Ispitni katalog za BHS jezik.pdf",
     "official_title": "Eksterna matura — Bosanski jezik i književnost, Hrvatski jezik i književnost, "
                       "Srpski jezik i književnost: Ispitni katalog (2022/2023)", "extract": extract_bhs},
    {"subject": "german", "file": "Ispitni katalog za Njemački jezik.pdf",
     "official_title": "Eksterna matura — Njemački jezik: Ispitni katalog pitanja", "extract": extract_german},
]


def main() -> None:
    """Run all three extractions, write JSON per subject and the Markdown report."""
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    run_at = _dt.datetime.now(_dt.timezone.utc).replace(microsecond=0).isoformat()
    report_sections: list[str] = []
    summary_rows: list[str] = []
    for catalogue in CATALOGUES:
        path = REPO_ROOT / catalogue["file"]
        pdf = pymupdf.open(path)
        document = {
            "file": catalogue["file"],
            "sha256": sha256_of(path),
            "official_title": catalogue["official_title"],
            "issuing_authority": "Ministarstvo za odgoj i obrazovanje Kantona Sarajevo",
            "page_count": len(pdf),
            "pdf_creation_date": pdf.metadata.get("creationDate"),
            "version_status": "candidate_active (currency vs. ministry website unverified — see docs/discovery/AMBIGUITIES.md)",
        }
        records, stats = catalogue["extract"](pdf, document)
        for record in records:
            record["provenance"]["extracted_at"] = run_at
        out_file = OUTPUT_DIR / f"{catalogue['subject']}.questions.json"
        out_file.write_text(json.dumps({"document": document, "stats": stats, "records": records},
                                       ensure_ascii=False, indent=2), encoding="utf-8")
        report_sections.append(render_subject_report(catalogue["subject"], document, stats, records))
        summary_rows.append(render_summary_row(catalogue["subject"], stats, records))

    header = [
        "# Canonical Catalogue Ingestion Report",
        "",
        f"Generated: {run_at} by `tools/canon-ingestion/extract_catalogues.py` v{EXTRACTOR_VERSION}",
        "",
        "Gate model (INSTRUCTION §0 Quality Gate): **structural validation** is automated here; "
        "**semantic/source validation** is a separate human gate. No record below is trusted yet — every "
        "record carries `trust_status = untrusted_pending_review` until a reviewer compares it against the "
        "rendered source region (`source.regions`).",
        "",
        "Unit definitions: for Mathematics and BHS a *canonical unit* is one numbered catalogue question "
        "(its a)/b) sub-parts stay inside it). For German a *canonical unit* is one numbered task "
        "(4.x.y); it contains 4 *scored items* (Wortschatz: 1), each worth 0.50 points per catalogue §3. "
        "The 200-question target is therefore met at the scored-item level for German. "
        "Listening transcripts 4.1.11–4.1.20 are attached to tasks 4.1.1–4.1.10 as stimuli, not counted.",
        "",
        "Known extraction limits: the PDF text layer cannot represent stacked fractions, exponents, radicals "
        "or figures (flagged `requires_visual_verification`); German r/f tick boxes remain as literal "
        "`r`/`f` lines inside item text; footnotes printed on a task's page stay inside that task's text.",
        "",
        "## Summary",
        "",
        "| Subject | Declared by source | Canonical units detected | Scored units | Structurally passed | Passed with flags | Failed | With answer key | Supplementary |",
        "|---|---|---|---|---|---|---|---|---|",
        *summary_rows,
        "",
    ]
    (OUTPUT_DIR / "INGESTION_REPORT.md").write_text("\n".join(header + report_sections) + "\n", encoding="utf-8")
    print("\n".join(summary_rows))


def core(records: list[dict]) -> list[dict]:
    """Records that count toward the declared catalogue question universe."""
    return [r for r in records if r["record_kind"] != "official_catalogue_supplementary_task"]


def scored_units(records: list[dict]) -> int:
    """Count scored units: German counts items, other subjects count questions."""
    return sum(r["logic"].get("scored_item_count", 1) for r in core(records))


def render_summary_row(subject: str, stats: dict, records: list[dict]) -> str:
    """One Markdown table row for the summary."""
    base = core(records)
    count = lambda status: sum(1 for r in base if r["validation"]["structural_status"] == status)
    with_key = sum(1 for r in base if r["logic"].get("answer_key_raw"))
    supplementary = len(records) - len(base)
    return (f"| {subject} | {stats.get('declared_total') or 'not declared'} | {len(base)} | {scored_units(records)} | "
            f"{count('passed')} | {count('passed_with_flags')} | {count('failed')} | {with_key} | {supplementary} |")


def render_subject_report(subject: str, document: dict, stats: dict, records: list[dict]) -> str:
    """Detailed per-subject section: counts, flags, failures, duplicates."""
    base = core(records)
    flag_counts: dict[str, int] = {}
    for record in base:
        for issue in record["validation"]["issues"]:
            flag_counts[issue] = flag_counts.get(issue, 0) + 1
    failures = [r for r in base if r["validation"]["structural_status"] == "failed"]
    missing_keys = [r["id"] for r in base if not r["logic"].get("answer_key_raw")]
    seen: dict[str, str] = {}
    duplicates: list[str] = []
    for record in base:
        fingerprint = re.sub(r"\W+", "", (record["syntax"]["stem_text"] or "").lower())
        if len(fingerprint) > 25 and fingerprint in seen:
            duplicates.append(f"{record['id']} ≡ {seen[fingerprint]}")
        seen.setdefault(fingerprint, record["id"])
    lines = [
        f"## {subject}",
        "",
        f"- Source: `{document['file']}` — {document['page_count']} pages — SHA-256 `{document['sha256']}`",
        f"- PDF creation date: `{document['pdf_creation_date']}`",
        f"- Declared total: {stats.get('declared_total') or 'not declared'} ({stats['declared_source']})",
        f"- Pages processed: {stats['pages_processed']}",
        f"- Canonical units detected: **{len(base)}**; scored units: **{scored_units(records)}**",
        f"- Answer-key entries parsed: {stats['answers_found']}",
    ]
    for key in ("per_area", "supplementary_tasks", "listening_transcripts"):
        if key in stats:
            lines.append(f"- {key.replace('_', ' ').capitalize()}: `{json.dumps(stats[key], ensure_ascii=False)}`")
    declared = stats.get("declared_total")
    if declared and scored_units(records) != declared:
        lines.append(f"- **DISCREPANCY:** detected {scored_units(records)} scored units vs. declared {declared}.")
    lines += ["", "**Review flags (records may carry several):**", ""]
    lines += [f"- {count} × {issue}" for issue, count in sorted(flag_counts.items(), key=lambda kv: -kv[1])] or ["- none"]
    lines += ["", f"**Structural failures ({len(failures)}):**", ""]
    lines += [f"- `{r['id']}` — {r['validation']['issues'][-1]}" for r in failures] or ["- none"]
    lines += ["", f"**Missing answer key ({len(missing_keys)}):** " + (", ".join(f"`{i}`" for i in missing_keys) or "none"), ""]
    lines += [f"**Exact-duplicate stems ({len(duplicates)}):** " + (", ".join(duplicates) or "none"), ""]
    lines += ["**Final validation status:** structural gate run; semantic/source gate NOT started — "
              "0 records trusted.", ""]
    return "\n".join(lines)


if __name__ == "__main__":
    main()
