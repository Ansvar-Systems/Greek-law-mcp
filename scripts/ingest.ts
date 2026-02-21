#!/usr/bin/env tsx
/**
 * Greek Law MCP -- Real FEK ingestion (API metadata + PDF text extraction + optional OCR).
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { fetchOfficialPdf, searchLegislation } from './lib/fetcher.js';
import { extractTextFromPdfBuffer } from './lib/pdf-extractor.js';
import {
  TARGET_GREEK_ACTS,
  pickBestSearchResult,
  parseSearchResultToAct,
  parseProvisionsFromOfficialText,
  extractDefinitionsFromProvisions,
  type ActTarget,
  type ParsedAct,
  type ParsedDefinition,
  type ParsedProvision,
} from './lib/parser.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SEED_DIR = path.resolve(__dirname, '../data/seed');
const META_FILE = path.join(SEED_DIR, '_ingestion-meta.json');

interface ParsedArgs {
  limit: number | null;
  ocr: boolean;
  ocrMaxPages: number;
}

interface IngestionMeta {
  source: string;
  generated_at: string;
  options: {
    ocr_enabled: boolean;
    ocr_max_pages: number;
  };
  fetched: {
    id: string;
    law_number: string;
    year: number;
    official_label: string;
    official_search_id: string;
    pdf_url: string;
    extraction_method: string;
    page_count: number;
    provision_count: number;
    definition_count: number;
    warnings: string[];
  }[];
  skipped: {
    id: string;
    law_number: string;
    year: number;
    reason: string;
  }[];
  limitations: string[];
}

interface ExtractedFromPdf {
  method: string;
  pageCount: number;
  provisions: ParsedProvision[];
  definitions: ParsedDefinition[];
  warnings: string[];
}

function parseArgs(): ParsedArgs {
  const args = process.argv.slice(2);
  let limit: number | null = null;
  let ocr = false;
  let ocrMaxPages = 35;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--limit' && args[i + 1]) {
      limit = Number.parseInt(args[i + 1], 10);
      i++;
      continue;
    }

    if (args[i] === '--ocr') {
      ocr = true;
      continue;
    }

    if (args[i] === '--ocr-max-pages' && args[i + 1]) {
      ocrMaxPages = Number.parseInt(args[i + 1], 10);
      i++;
    }
  }

  return { limit, ocr, ocrMaxPages };
}

function cloneProvisions(provisions: ParsedProvision[]): ParsedProvision[] {
  return provisions.map(item => ({ ...item }));
}

function cloneDefinitions(definitions: ParsedDefinition[]): ParsedDefinition[] {
  return definitions.map(item => ({ ...item }));
}

async function extractActFromPdf(
  pdfUrl: string,
  target: ActTarget,
  options: ParsedArgs,
): Promise<ExtractedFromPdf> {
  const pdfBuffer = await fetchOfficialPdf(pdfUrl);
  const extraction = await extractTextFromPdfBuffer(pdfBuffer, {
    enableOcr: options.ocr,
    maxOcrPages: options.ocrMaxPages,
  });

  const provisions = parseProvisionsFromOfficialText(extraction.text, {
    lawNumber: target.lawNumber,
    legislationCatalogues: target.legislationCatalogues,
  });
  if (provisions.length === 0) {
    throw new Error(
      `No article headings parsed from extracted text (method=${extraction.method}, chars=${extraction.metrics.charCount})`,
    );
  }

  const definitions = extractDefinitionsFromProvisions(provisions);
  return {
    method: extraction.method,
    pageCount: extraction.pageCount,
    provisions,
    definitions,
    warnings: extraction.warnings,
  };
}

async function ingestAct(
  target: ActTarget,
  options: ParsedArgs,
  extractionCache: Map<string, ExtractedFromPdf>,
): Promise<
  | {
      ok: true;
      act: ParsedAct;
      officialLabel: string;
      officialSearchId: string;
      extraction: ExtractedFromPdf;
    }
  | {
      ok: false;
      reason: string;
    }
> {
  const rows = await searchLegislation({
    legislationCatalogues: target.legislationCatalogues,
    legislationNumber: target.lawNumber,
    selectYear: [String(target.year)],
  });

  const best = pickBestSearchResult(rows, target);
  if (!best) {
    return { ok: false, reason: 'No official result for law number/year in search API' };
  }

  const baseAct = parseSearchResultToAct(best, target);

  let extracted: ExtractedFromPdf;
  const cached = extractionCache.get(baseAct.url);
  if (cached) {
    extracted = {
      method: cached.method,
      pageCount: cached.pageCount,
      provisions: cloneProvisions(cached.provisions),
      definitions: cloneDefinitions(cached.definitions),
      warnings: [...cached.warnings],
    };
  } else {
    extracted = await extractActFromPdf(baseAct.url, target, options);
    extractionCache.set(baseAct.url, extracted);
  }

  const act: ParsedAct = {
    ...baseAct,
    provisions: cloneProvisions(extracted.provisions),
    definitions: cloneDefinitions(extracted.definitions),
  };

  return {
    ok: true,
    act,
    officialLabel: best.search_PrimaryLabel,
    officialSearchId: best.search_ID,
    extraction: extracted,
  };
}

async function main(): Promise<void> {
  const options = parseArgs();

  console.log('Greek Law MCP -- Real FEK Ingestion');
  console.log('===================================\n');
  console.log('  Source:  search.et.gr API + official FEK PDFs');
  console.log(`  OCR:     ${options.ocr ? 'enabled' : 'disabled'} (max pages: ${options.ocrMaxPages})\n`);

  fs.mkdirSync(SEED_DIR, { recursive: true });

  const targets = options.limit ? TARGET_GREEK_ACTS.slice(0, options.limit) : TARGET_GREEK_ACTS;
  const fetched: IngestionMeta['fetched'] = [];
  const skipped: IngestionMeta['skipped'] = [];
  const extractionCache = new Map<string, ExtractedFromPdf>();

  for (const target of targets) {
    process.stdout.write(`  Resolving ${target.id} (${target.lawNumber}/${target.year})...`);
    try {
      const result = await ingestAct(target, options, extractionCache);
      if (!result.ok) {
        console.log(` SKIPPED (${result.reason})`);
        skipped.push({
          id: target.id,
          law_number: target.lawNumber,
          year: target.year,
          reason: result.reason,
        });
        continue;
      }

      const outFile = path.join(SEED_DIR, `${target.id}.json`);
      fs.writeFileSync(outFile, JSON.stringify(result.act, null, 2));

      fetched.push({
        id: target.id,
        law_number: target.lawNumber,
        year: target.year,
        official_label: result.officialLabel,
        official_search_id: result.officialSearchId,
        pdf_url: result.act.url,
        extraction_method: result.extraction.method,
        page_count: result.extraction.pageCount,
        provision_count: result.act.provisions.length,
        definition_count: result.act.definitions.length,
        warnings: result.extraction.warnings,
      });

      console.log(
        ` OK (${result.officialLabel}; provisions=${result.act.provisions.length}; method=${result.extraction.method})`,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.log(` ERROR (${message})`);
      skipped.push({
        id: target.id,
        law_number: target.lawNumber,
        year: target.year,
        reason: message,
      });
    }
  }

  const meta: IngestionMeta = {
    source: 'search.et.gr / searchetv99.azurewebsites.net + official FEK PDFs',
    generated_at: new Date().toISOString(),
    options: {
      ocr_enabled: options.ocr,
      ocr_max_pages: options.ocrMaxPages,
    },
    fetched,
    skipped,
    limitations: [
      'Official source is PDF-native for full text; article extraction uses pdftotext with OCR fallback when enabled.',
      'OCR quality depends on source scan quality; low-confidence OCR passages are preserved as extracted (never fabricated).',
    ],
  };

  fs.writeFileSync(META_FILE, JSON.stringify(meta, null, 2));

  console.log('\n' + '='.repeat(72));
  console.log('Ingestion Report');
  console.log('='.repeat(72));
  console.log(`  Targets: ${targets.length}`);
  console.log(`  Fetched: ${fetched.length}`);
  console.log(`  Skipped: ${skipped.length}`);
  console.log(`  Seed dir: ${SEED_DIR}`);
  console.log(`  Meta file: ${META_FILE}`);
  console.log('');
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
