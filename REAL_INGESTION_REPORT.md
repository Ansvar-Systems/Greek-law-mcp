# Greek Law MCP — Real Ingestion Report (Country Scope + FEK Full Text Targets)

Date: 2026-02-22  
Branch: `dev`

## 1) Official Source Research

- Official legal portal: `https://search.et.gr/el/search-legislation/`
- Official authority: Εθνικό Τυπογραφείο (National Printing Office of Greece)
- Official API backend: `https://searchetv99.azurewebsites.net/api`
- Official FEK PDF storage: `https://ia37rg02wpsa01.blob.core.windows.net/fek/`
- Language: Greek (`el`)
- Data format: metadata API + full text in PDFs

## 2) Country-Scope Ingestion Run

Command run:

```bash
npm run ingest -- --country-scope --ocr
```

Parameters:
- Years queried: `1833` through `2026`
- Catalogues queried: `1` (laws), `2` (presidential decrees), `3` (acts of legislative content)
- Request pacing: enforced in client (`>=1.2s` between government requests)

Results:
- Query attempts: **582**
- Query errors: **0**
- Rows returned: **75,024**
- Unique official records by `search_ID`: **21,109**
- Country-scope JSON written: `data/seed/_country-scope-documents.json` (**21,109** documents)

## 3) High-Fidelity FEK Full Text Refresh (Targets)

The 10 target acts were refreshed from official FEK PDFs in the same run:

- Fetched: **10/10**
- Skipped: **0**
- OCR fallback used where needed (legacy scanned FEKs):
  - `law-1733-1987`
  - `law-2472-1997`

Parsed target corpus totals:
- Provisions: **976**
- Definitions: **186**

## 4) Database Rebuild

Command run:

```bash
npm run build:db
```

Output:
- Documents: **21,119**
- Provisions: **976**
- Definitions: **186**
- EU auto-extracted refs: **0**
- DB size: **20.9 MB**

Notes:
- `scripts/build-db.ts` now supports both single-document seed files and bulk array seed files.
- Non-seed JSON metadata files are skipped safely.

## 5) Character-Exact Provision Verification (3 required checks)

Verified by SHA-256 against fixed official extraction fixtures:

1. `law-4624-2019` `Art. 1`  
   `d58bb54d4a43244ff8da8501e948a0db99cac2c61bd3c41986a552d4552c3e63` — **MATCH**
2. `law-4727-2020` `Art. 1`  
   `b9b381d5b88f225aafccfb6b3cd2732b8e0dbb61660df482b1307a45f6995c8b` — **MATCH**
3. `pd-131-2003` `Art. 1`  
   `42e6f072ba4bddc82ae4f803646634e9fa8b8dab3bad0c307c03e813350b8f53` — **MATCH**

## 6) Validation Commands

All required checks passed:

- `npm run build`
- `npm test`
- `npx tsc --noEmit`

## 7) Scope and Accuracy Statement

- **Maximal country-scope metadata coverage achieved** for queried official catalogues and years (`1833-2026`, catalogues `1,2,3`) with zero query failures.
- **Full-text article extraction is authoritative and source-derived for the refreshed target set.**
- **Full country-wide article extraction for all 21k+ records was not executed in this run** due runtime/storage scale; country-wide records currently carry official metadata + FEK URLs, and target acts carry parsed provisions/definitions.
- No legal text was fabricated; all stored text originates from official FEK PDFs.
