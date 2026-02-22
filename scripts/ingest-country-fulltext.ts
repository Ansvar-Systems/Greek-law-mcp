#!/usr/bin/env tsx
/**
 * Greek Law MCP -- country-scope full-text enrichment.
 *
 * Reads metadata records from data/seed/_country-scope-documents.json and writes
 * per-document enriched seed files into data/seed/_country-fulltext/.
 *
 * Resumable by file existence; does not fabricate text.
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { fetchOfficialPdf } from './lib/fetcher.js';
import { extractTextFromPdfBuffer } from './lib/pdf-extractor.js';
import {
  parseProvisionsFromOfficialText,
  extractDefinitionsFromProvisions,
  type ParsedAct,
  type ParsedProvision,
} from './lib/parser.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SEED_DIR = path.resolve(__dirname, '../data/seed');
const COUNTRY_SCOPE_FILE = path.join(SEED_DIR, '_country-scope-documents.json');
const OUTPUT_DIR = path.join(SEED_DIR, '_country-fulltext');
const PROGRESS_FILE = path.join(SEED_DIR, '_country-fulltext-progress.json');

interface ParsedArgs {
  limit: number | null;
  ocr: boolean;
  ocrMaxPages: number;
  force: boolean;
  statusEvery: number;
  newestFirst: boolean;
}

interface ProgressFailure {
  id: string;
  url: string;
  reason: string;
}

interface ProgressReport {
  generated_at: string;
  source_file: string;
  output_dir: string;
  options: {
    ocr_enabled: boolean;
    ocr_max_pages: number;
    force: boolean;
    limit: number | null;
    status_every: number;
    newest_first: boolean;
  };
  totals: {
    candidate_documents: number;
    existing_output_files: number;
    attempted: number;
    written: number;
    skipped_existing: number;
    from_target_override: number;
    from_pdf_extraction: number;
    with_article_provisions: number;
    with_fulltext_fallback_provision: number;
    failed: number;
  };
  failures: ProgressFailure[];
}

function parsePositiveInt(value: string, name: string): number {
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed) || parsed <= 0) {
    throw new Error(`Invalid ${name}: ${value}`);
  }
  return parsed;
}

function parseArgs(): ParsedArgs {
  const args = process.argv.slice(2);
  let limit: number | null = null;
  let ocr = false;
  let ocrMaxPages = 35;
  let force = false;
  let statusEvery = 25;
  let newestFirst = true;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === '--limit' && args[i + 1]) {
      limit = parsePositiveInt(args[i + 1], '--limit');
      i++;
      continue;
    }

    if (arg === '--ocr') {
      ocr = true;
      continue;
    }

    if (arg === '--ocr-max-pages' && args[i + 1]) {
      ocrMaxPages = parsePositiveInt(args[i + 1], '--ocr-max-pages');
      i++;
      continue;
    }

    if (arg === '--force') {
      force = true;
      continue;
    }

    if (arg === '--status-every' && args[i + 1]) {
      statusEvery = parsePositiveInt(args[i + 1], '--status-every');
      i++;
      continue;
    }

    if (arg === '--oldest-first') {
      newestFirst = false;
      continue;
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  return {
    limit,
    ocr,
    ocrMaxPages,
    force,
    statusEvery,
    newestFirst,
  };
}

function readCountryScopeDocs(newestFirst: boolean): ParsedAct[] {
  if (!fs.existsSync(COUNTRY_SCOPE_FILE)) {
    throw new Error(`Missing country-scope file: ${COUNTRY_SCOPE_FILE}`);
  }

  const parsed = JSON.parse(fs.readFileSync(COUNTRY_SCOPE_FILE, 'utf8')) as unknown;
  if (!Array.isArray(parsed)) {
    throw new Error(`Expected array in ${COUNTRY_SCOPE_FILE}`);
  }

  const docs = parsed.filter(item => {
    if (typeof item !== 'object' || item === null) return false;
    const record = item as Partial<ParsedAct>;
    return typeof record.id === 'string' && typeof record.url === 'string' && typeof record.title === 'string';
  }) as ParsedAct[];

  docs.sort((left, right) => {
    const l = `${left.issued_date ?? ''}:${left.id}`;
    const r = `${right.issued_date ?? ''}:${right.id}`;
    return l.localeCompare(r);
  });

  if (newestFirst) {
    docs.reverse();
  }

  return docs;
}

function loadTargetOverrides(): Map<string, ParsedAct> {
  const overrides = new Map<string, ParsedAct>();
  const files = fs.readdirSync(SEED_DIR)
    .filter(file => file.endsWith('.json') && !file.startsWith('_'));

  for (const file of files) {
    const filePath = path.join(SEED_DIR, file);
    const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8')) as ParsedAct;
    if (!parsed?.id || !Array.isArray(parsed.provisions)) continue;
    if (parsed.provisions.length === 0) continue;
    overrides.set(parsed.id, parsed);
  }

  return overrides;
}

function buildFulltextFallbackProvision(text: string): ParsedProvision | null {
  const normalized = text.trim();
  if (normalized.length === 0) return null;

  return {
    provision_ref: 'Art. 0',
    section: '0',
    title: 'Πλήρες κείμενο',
    content: normalized,
  };
}

function writeProgress(progress: ProgressReport): void {
  fs.writeFileSync(PROGRESS_FILE, JSON.stringify(progress, null, 2));
}

async function enrichFromPdf(doc: ParsedAct, options: ParsedArgs): Promise<ParsedAct> {
  const pdfBuffer = await fetchOfficialPdf(doc.url);
  const extracted = await extractTextFromPdfBuffer(pdfBuffer, {
    enableOcr: options.ocr,
    maxOcrPages: options.ocrMaxPages,
    allowLowQualityFallback: true,
  });

  let provisions = parseProvisionsFromOfficialText(extracted.text);
  if (provisions.length === 0) {
    const fallback = buildFulltextFallbackProvision(extracted.text);
    provisions = fallback ? [fallback] : [];
  }

  const definitions = extractDefinitionsFromProvisions(provisions);
  return {
    ...doc,
    provisions,
    definitions,
  };
}

async function main(): Promise<void> {
  const options = parseArgs();

  console.log('Greek Law MCP -- Country Full-Text Enrichment');
  console.log('==============================================\n');
  console.log(`  Source metadata: ${COUNTRY_SCOPE_FILE}`);
  console.log(`  Output directory: ${OUTPUT_DIR}`);
  console.log(`  OCR: ${options.ocr ? 'enabled' : 'disabled'} (max pages: ${options.ocrMaxPages})`);
  console.log(`  Force rewrite: ${options.force ? 'yes' : 'no'}\n`);

  const docs = readCountryScopeDocs(options.newestFirst);
  const targets = loadTargetOverrides();
  const candidates = options.limit ? docs.slice(0, options.limit) : docs;

  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  const existingFiles = new Set(
    fs.readdirSync(OUTPUT_DIR)
      .filter(file => file.endsWith('.json'))
      .map(file => file.replace(/\.json$/, '')),
  );

  const progress: ProgressReport = {
    generated_at: new Date().toISOString(),
    source_file: COUNTRY_SCOPE_FILE,
    output_dir: OUTPUT_DIR,
    options: {
      ocr_enabled: options.ocr,
      ocr_max_pages: options.ocrMaxPages,
      force: options.force,
      limit: options.limit,
      status_every: options.statusEvery,
      newest_first: options.newestFirst,
    },
    totals: {
      candidate_documents: candidates.length,
      existing_output_files: existingFiles.size,
      attempted: 0,
      written: 0,
      skipped_existing: 0,
      from_target_override: 0,
      from_pdf_extraction: 0,
      with_article_provisions: 0,
      with_fulltext_fallback_provision: 0,
      failed: 0,
    },
    failures: [],
  };

  for (let i = 0; i < candidates.length; i++) {
    const doc = candidates[i];
    const outPath = path.join(OUTPUT_DIR, `${doc.id}.json`);

    if (!options.force && existingFiles.has(doc.id)) {
      progress.totals.skipped_existing++;
      if ((i + 1) % options.statusEvery === 0) {
        progress.generated_at = new Date().toISOString();
        writeProgress(progress);
        console.log(`  Progress ${i + 1}/${candidates.length} (skipped existing: ${progress.totals.skipped_existing})`);
      }
      continue;
    }

    progress.totals.attempted++;

    try {
      let enriched: ParsedAct;
      if (targets.has(doc.id)) {
        enriched = targets.get(doc.id)!;
        progress.totals.from_target_override++;
      } else {
        enriched = await enrichFromPdf(doc, options);
        progress.totals.from_pdf_extraction++;
      }

      if (enriched.provisions.length > 0) {
        const fallbackOnly =
          enriched.provisions.length === 1 &&
          enriched.provisions[0].provision_ref === 'Art. 0' &&
          enriched.provisions[0].section === '0';

        if (fallbackOnly) {
          progress.totals.with_fulltext_fallback_provision++;
        } else {
          progress.totals.with_article_provisions++;
        }
      }

      fs.writeFileSync(outPath, JSON.stringify(enriched, null, 2));
      progress.totals.written++;
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      progress.totals.failed++;
      progress.failures.push({
        id: doc.id,
        url: doc.url,
        reason,
      });

      console.log(`  ERROR ${doc.id}: ${reason}`);
    }

    if ((i + 1) % options.statusEvery === 0) {
      progress.generated_at = new Date().toISOString();
      writeProgress(progress);
      console.log(
        `  Progress ${i + 1}/${candidates.length} | written=${progress.totals.written} failed=${progress.totals.failed} skipped=${progress.totals.skipped_existing}`,
      );
    }
  }

  progress.generated_at = new Date().toISOString();
  writeProgress(progress);

  console.log('\n' + '='.repeat(72));
  console.log('Full-Text Enrichment Report');
  console.log('='.repeat(72));
  console.log(`  Candidates: ${progress.totals.candidate_documents}`);
  console.log(`  Attempted now: ${progress.totals.attempted}`);
  console.log(`  Written now: ${progress.totals.written}`);
  console.log(`  Skipped existing: ${progress.totals.skipped_existing}`);
  console.log(`  From target override: ${progress.totals.from_target_override}`);
  console.log(`  From PDF extraction: ${progress.totals.from_pdf_extraction}`);
  console.log(`  With article provisions: ${progress.totals.with_article_provisions}`);
  console.log(`  With fulltext fallback: ${progress.totals.with_fulltext_fallback_provision}`);
  console.log(`  Failed: ${progress.totals.failed}`);
  console.log(`  Progress file: ${PROGRESS_FILE}`);
  console.log('');
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
