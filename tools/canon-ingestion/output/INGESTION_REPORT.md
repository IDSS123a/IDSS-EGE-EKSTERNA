# Canonical Catalogue Ingestion Report

Generated: 2026-09-27T11:10:47+00:00 by `tools/canon-ingestion/extract_catalogues.py` v0.1.0

Gate model (INSTRUCTION §0 Quality Gate): **structural validation** is automated here; **semantic/source validation** is a separate human gate. No record below is trusted yet — every record carries `trust_status = untrusted_pending_review` until a reviewer compares it against the rendered source region (`source.regions`).

Unit definitions: for Mathematics and BHS a *canonical unit* is one numbered catalogue question (its a)/b) sub-parts stay inside it). For German a *canonical unit* is one numbered task (4.x.y); it contains 4 *scored items* (Wortschatz: 1), each worth 0.50 points per catalogue §3. The 200-question target is therefore met at the scored-item level for German. Listening transcripts 4.1.11–4.1.20 are attached to tasks 4.1.1–4.1.10 as stimuli, not counted.

Known extraction limits: the PDF text layer cannot represent stacked fractions, exponents, radicals or figures (flagged `requires_visual_verification`); German r/f tick boxes remain as literal `r`/`f` lines inside item text; footnotes printed on a task's page stay inside that task's text.

## Summary

| Subject | Declared by source | Canonical units detected | Scored units | Structurally passed | Passed with flags | Failed | With answer key | Supplementary |
|---|---|---|---|---|---|---|---|---|
| mathematics | 200 | 200 | 200 | 16 | 184 | 0 | 200 | 0 |
| bhs_language_literature | 200 | 200 | 200 | 200 | 0 | 0 | 200 | 20 |
| german | not declared | 80 | 200 | 70 | 10 | 0 | 80 | 0 |

## mathematics

- Source: `matematika_-_katalog.pdf` — 75 pages — SHA-256 `450a10071ffceecaa989b824077ab36d6688d8cafcd036a783e1b34867855149`
- PDF creation date: `D:20220819195041+02'00'`
- Declared total: 200 (catalogue §2: '200 zadataka … 10 oblasti po 20 zadataka')
- Pages processed: tasks pp.23–55, solutions pp.57–68 (PDF page numbers)
- Canonical units detected: **200**; scored units: **200**
- Answer-key entries parsed: 200

**Review flags (records may carry several):**

- 179 × 2-D notation (fractions/exponents/radicals) not representable in PDF text layer
- 19 × references a figure/table: stimulus must be taken from the rendered source region
- 1 × answer options are graphics, not text: take them from the rendered source region

**Structural failures (0):**

- none

**Missing answer key (0):** none

**Exact-duplicate stems (0):** none

**Final validation status:** structural gate run; semantic/source gate NOT started — 0 records trusted.

## bhs_language_literature

- Source: `bjk_hjk_sjk_katalog_eksterna_matura_2022_2023.pdf` — 89 pages — SHA-256 `ba11dfbb0bcafcf09117b673348f370fc88bcfa333e1e13d5ef50586ac3ad3e8`
- PDF creation date: `D:20220821151110+02'00'`
- Declared total: 200 (catalogue Uvod p.3: 'Katalog sadrži 200 pitanja sa rješenjima')
- Pages processed: questions pp.9–58, solutions pp.59–71, supplementary pp.72–81
- Canonical units detected: **200**; scored units: **200**
- Answer-key entries parsed: 200
- Per area: `{"KNJ": 48, "MED": 12, "FON": 25, "MOR": 33, "TVO": 10, "SIN": 30, "LEK": 10, "PRA": 24, "HIS": 8}`
- Supplementary tasks: `20`

**Review flags (records may carry several):**

- none

**Structural failures (0):**

- none

**Missing answer key (0):** none

**Exact-duplicate stems (0):** none

**Final validation status:** structural gate run; semantic/source gate NOT started — 0 records trusted.

## german

- Source: `Ispitni katalog za Njemački jezik.pdf` — 76 pages — SHA-256 `51a8d531227e2eb7a443bd218e4095aaaa100db6cae662f8f99d441cfab89c05`
- PDF creation date: `D:20240726201545+02'00'`
- Declared total: not declared (catalogue declares no total; §2 lists 5 areas × 2 points, §3 0.50 points per item)
- Pages processed: tasks pp.10–62, solutions pp.64–67
- Canonical units detected: **80**; scored units: **200**
- Answer-key entries parsed: 80
- Per area: `{"HÖRVERSTEHEN": {"tasks": 10, "scored_items": 40}, "LESEVERSTEHEN": {"tasks": 10, "scored_items": 40}, "WORTSCHATZ": {"tasks": 40, "scored_items": 40}, "GRAMMATIK": {"tasks": 10, "scored_items": 40}, "KOMMUNIKATION": {"tasks": 10, "scored_items": 40}}`
- Listening transcripts: `10`

**Review flags (records may carry several):**

- 10 × listening task: official audio is not in the repository; only the printed transcript

**Structural failures (0):**

- none

**Missing answer key (0):** none

**Exact-duplicate stems (0):** none

**Final validation status:** structural gate run; semantic/source gate NOT started — 0 records trusted.

