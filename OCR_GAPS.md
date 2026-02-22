# OCR Gap Backlog (Deferred)

Date: 2026-02-22

This repository is currently in a staged country-wide full-text ingestion rollout.

Current status:
- Country-scope corpus records: `21,109`
- Enriched full-text records written locally: `5,686` (`26.94%`)
- Non-OCR pass failures currently recorded: `56`

Gap policy:
- These failures are explicitly marked as **deferred OCR/text extraction gaps**.
- No legal text was fabricated for failed records.
- Failed records remain represented by official metadata + source FEK PDF URL until remediated.

Backlog artifact:
- `gaps/ocr-gaps.json`

Deferred remediation plan:
1. Continue non-OCR pass to maximize directly extractable text coverage.
2. Run dedicated OCR remediation pass for remaining failures/gaps.
3. Rebuild DB and re-run validation checks after OCR remediation.
4. Keep unresolved records explicitly tagged as gaps with source URL and reason.
