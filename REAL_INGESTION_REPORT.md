# Greek Law MCP — Real Ingestion Report (Official FEK PDFs + OCR Fallback)

Date: 2026-02-21  
Branch: `dev`

## 1) Official Source Research

- Official legal portal: `https://search.et.gr/el/search-legislation/`
- Official authority: Εθνικό Τυπογραφείο (National Printing Office of Greece)
- Official API backend: `https://searchetv99.azurewebsites.net/api`
- Official FEK PDF storage: `https://ia37rg02wpsa01.blob.core.windows.net/fek/`
- Language: Greek (`el`)
- Data format: metadata API + full text in PDFs

Feasibility: **Hard** (PDF-native full text, no structured article endpoint)

## 2) Audit of Existing Dataset

Before replacement, the repository had AI-seeded-style structure in historical commits.  
This branch had already moved to metadata-only real records (0 provisions), which was source-correct but incomplete for article retrieval.

## 3) Real Ingestion Implemented

Implemented end-to-end ingestion from official sources:

- `scripts/lib/fetcher.ts`
  - rate-limited official API + PDF fetch (`>=1.2s` pacing)
- `scripts/lib/pdf-extractor.ts`
  - `pdftotext` extraction for text PDFs
  - windows-1253 recovery for mojibake legacy encodings
  - OCR fallback (`--ocr`) for image-only PDFs via `tesseract.js`
- `scripts/lib/parser.ts`
  - target-act isolation within multi-act FEK issues
  - article parsing into MCP `provisions`
  - conservative definition extraction from definition articles
- `scripts/ingest.ts`
  - metadata fetch + PDF extraction + structured seed output
  - per-law extraction metadata in `_ingestion-meta.json`

## 4) Laws Ingested (10/10)

1. Ν. 1733/1987 — OCR fallback — 3 provisions  
2. Ν. 2472/1997 — OCR fallback — 4 provisions  
3. Ν. 3979/2011 — pdftotext — 63 provisions  
4. Ν. 4070/2012 — pdftotext — 185 provisions  
5. Ν. 4577/2018 (NIS view) — pdftotext — 19 provisions  
6. Ν. 4577/2018 (CII view) — pdftotext — 19 provisions  
7. Ν. 4624/2019 — pdftotext — 87 provisions  
8. Ν. 4727/2020 — pdftotext — 237 provisions  
9. Π.Δ. 131/2003 — pdftotext + windows-1253 recode — 19 provisions  
10. Ν. 4619/2019 (penal-code-cybercrime mapping) — pdftotext — 340 provisions

## 5) Database State After Rebuild

- Documents: **10**
- Provisions: **976**
- Definitions: **186**
- EU auto-extracted refs: **0** (current EU regex is English-centric)
- DB size: **5.9 MB**

## 6) Character-by-Character Verification (3 Provisions)

Verified by refetching official FEK PDFs and reparsing directly from source:

1. `law-4624-2019` `Art. 1` — **MATCH** (`pdftotext`)
2. `law-4727-2020` `Art. 1` — **MATCH** (`pdftotext`)
3. `pd-131-2003` `Art. 1` — **MATCH** (`pdftotext_windows1253`)

## 7) Validation Commands

All required checks passed:

- `npm run build`
- `npm test`
- `npx tsc --noEmit`

## 8) Limitations

- Two legacy FEKs (`1733/1987`, `2472/1997`) are image-only and required OCR.  
  OCR output is source-derived but has scan/OCR noise and is lower confidence than native text PDFs.
- Official portal remains PDF-native for full legal text; no structured article API endpoint was identified.
