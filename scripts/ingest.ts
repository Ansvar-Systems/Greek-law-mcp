#!/usr/bin/env tsx
/**
 * Greek Law MCP -- Real FEK ingestion.
 *
 * Modes:
 *  - default: target-act full text ingestion (PDF extraction + optional OCR)
 *  - --country-scope: country-wide metadata ingestion (all years/catalogues)
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { fetchOfficialPdf, searchLegislation, type SearchLegislationRow } from './lib/fetcher.js';
import { extractTextFromPdfBuffer } from './lib/pdf-extractor.js';
import {
  TARGET_GREEK_ACTS,
  pickBestSearchResult,
  parseSearchResultToAct,
  parseSearchResultToCountryScopeAct,
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
const COUNTRY_SCOPE_FILE = path.join(SEED_DIR, '_country-scope-documents.json');
const COUNTRY_SCOPE_YEAR_MIN = 1833;

interface ParsedArgs {
  mode: 'targets' | 'country_scope';
  limit: number | null;
  ocr: boolean;
  ocrMaxPages: number;
  fromYear: number;
  toYear: number;
  catalogues: string[];
  includeTargets: boolean;
  maxDocuments: number | null;
}

interface IngestionMeta {
  source: string;
  generated_at: string;
  mode: ParsedArgs['mode'];
  options: {
    ocr_enabled: boolean;
    ocr_max_pages: number;
    from_year: number;
    to_year: number;
    catalogues: string[];
    include_targets: boolean;
    max_documents: number | null;
  };
  target_ingestion: {
    attempted: number;
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
  };
  country_scope?: CountryScopeSummary;
  limitations: string[];
}

interface CountryScopeSummary {
  query_attempts: number;
  query_errors: number;
  rows_total: number;
  rows_unique: number;
  documents_written: number;
  output_file: string;
  failed_queries: {
    year: number;
    catalogue: string;
    reason: string;
  }[];
}

interface ExtractedFromPdf {
  method: string;
  pageCount: number;
  provisions: ParsedProvision[];
  definitions: ParsedDefinition[];
  warnings: string[];
}

interface CountryScopeRow {
  row: SearchLegislationRow;
  legislationCatalogue: string;
}

function parsePositiveInt(value: string, name: string): number {
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed) || parsed <= 0) {
    throw new Error(`Invalid ${name}: ${value}`);
  }
  return parsed;
}

function parseYear(value: string, name: string): number {
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed) || parsed < COUNTRY_SCOPE_YEAR_MIN || parsed > 2100) {
    throw new Error(`Invalid ${name}: ${value}`);
  }
  return parsed;
}

function parseCatalogueList(value: string): string[] {
  const list = value
    .split(',')
    .map(item => item.trim())
    .filter(Boolean);

  if (list.length === 0) {
    throw new Error('Empty catalogue list');
  }

  const unsupported = list.filter(item => !['1', '2', '3'].includes(item));
  if (unsupported.length > 0) {
    throw new Error(`Unsupported catalogues: ${unsupported.join(', ')}`);
  }

  return Array.from(new Set(list));
}

function parseArgs(): ParsedArgs {
  const currentYear = new Date().getUTCFullYear();
  const args = process.argv.slice(2);

  let mode: ParsedArgs['mode'] = 'targets';
  let limit: number | null = null;
  let ocr = false;
  let ocrMaxPages = 35;
  let fromYear = COUNTRY_SCOPE_YEAR_MIN;
  let toYear = currentYear;
  let catalogues = ['1', '2', '3'];
  let includeTargets = false;
  let maxDocuments: number | null = null;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === '--country-scope') {
      mode = 'country_scope';
      continue;
    }

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

    if ((arg === '--from-year' || arg === '--year-from') && args[i + 1]) {
      fromYear = parseYear(args[i + 1], arg);
      i++;
      continue;
    }

    if ((arg === '--to-year' || arg === '--year-to') && args[i + 1]) {
      toYear = parseYear(args[i + 1], arg);
      i++;
      continue;
    }

    if (arg === '--catalogues' && args[i + 1]) {
      catalogues = parseCatalogueList(args[i + 1]);
      i++;
      continue;
    }

    if (arg === '--include-targets') {
      includeTargets = true;
      continue;
    }

    if (arg === '--max-documents' && args[i + 1]) {
      maxDocuments = parsePositiveInt(args[i + 1], '--max-documents');
      i++;
      continue;
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  if (fromYear > toYear) {
    throw new Error(`Invalid year range: from ${fromYear} > to ${toYear}`);
  }

  // Default behaviour for country scope is to retain high-fidelity target acts.
  if (mode === 'country_scope' && !includeTargets) {
    includeTargets = true;
  }

  return {
    mode,
    limit,
    ocr,
    ocrMaxPages,
    fromYear,
    toYear,
    catalogues,
    includeTargets,
    maxDocuments,
  };
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

async function ingestTargets(
  targets: ActTarget[],
  options: ParsedArgs,
  extractionCache: Map<string, ExtractedFromPdf>,
): Promise<IngestionMeta['target_ingestion']> {
  const fetched: IngestionMeta['target_ingestion']['fetched'] = [];
  const skipped: IngestionMeta['target_ingestion']['skipped'] = [];

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

  return {
    attempted: targets.length,
    fetched,
    skipped,
  };
}

function dedupeCountryScopeRows(rows: CountryScopeRow[]): CountryScopeRow[] {
  const bySearchId = new Map<string, CountryScopeRow>();
  for (const row of rows) {
    const key = row.row.search_ID;
    if (!bySearchId.has(key)) {
      bySearchId.set(key, row);
    }
  }
  return Array.from(bySearchId.values());
}

function sortActs(acts: ParsedAct[]): ParsedAct[] {
  return [...acts].sort((a, b) => {
    const left = a.issued_date ?? '';
    const right = b.issued_date ?? '';
    if (left !== right) {
      return left.localeCompare(right);
    }
    return a.id.localeCompare(b.id);
  });
}

async function ingestCountryScope(
  options: ParsedArgs,
): Promise<CountryScopeSummary> {
  const collectedRows: CountryScopeRow[] = [];
  const failedQueries: CountryScopeSummary['failed_queries'] = [];
  let queryAttempts = 0;
  let queryErrors = 0;

  for (let year = options.fromYear; year <= options.toYear; year++) {
    for (const catalogue of options.catalogues) {
      queryAttempts++;
      process.stdout.write(`  Querying year=${year} catalogue=${catalogue}...`);

      try {
        const rows = await searchLegislation({
          legislationCatalogues: catalogue,
          legislationNumber: '',
          selectYear: [String(year)],
        });

        for (const row of rows) {
          collectedRows.push({ row, legislationCatalogue: catalogue });
        }

        console.log(` ${rows.length} rows`);
      } catch (error) {
        queryErrors++;
        const reason = error instanceof Error ? error.message : String(error);
        failedQueries.push({ year, catalogue, reason });
        console.log(` ERROR (${reason})`);
      }
    }
  }

  const dedupedRows = dedupeCountryScopeRows(collectedRows);
  let acts = dedupedRows.map(item => parseSearchResultToCountryScopeAct(item.row, item.legislationCatalogue));
  acts = sortActs(acts);

  if (options.maxDocuments && acts.length > options.maxDocuments) {
    acts = acts.slice(acts.length - options.maxDocuments);
  }

  fs.writeFileSync(COUNTRY_SCOPE_FILE, JSON.stringify(acts, null, 2));

  return {
    query_attempts: queryAttempts,
    query_errors: queryErrors,
    rows_total: collectedRows.length,
    rows_unique: dedupedRows.length,
    documents_written: acts.length,
    output_file: COUNTRY_SCOPE_FILE,
    failed_queries: failedQueries,
  };
}

async function main(): Promise<void> {
  const options = parseArgs();

  console.log('Greek Law MCP -- Real FEK Ingestion');
  console.log('===================================\n');
  console.log('  Source:  search.et.gr API + official FEK PDFs');
  console.log(`  Mode:    ${options.mode === 'country_scope' ? 'country_scope' : 'targets'}`);
  console.log(`  OCR:     ${options.ocr ? 'enabled' : 'disabled'} (max pages: ${options.ocrMaxPages})`);
  if (options.mode === 'country_scope') {
    console.log(
      `  Scope:   years ${options.fromYear}-${options.toYear}, catalogues=${options.catalogues.join(',')}, include-targets=${options.includeTargets}`,
    );
  }
  console.log('');

  fs.mkdirSync(SEED_DIR, { recursive: true });

  const extractionCache = new Map<string, ExtractedFromPdf>();
  let targetIngestion: IngestionMeta['target_ingestion'] = {
    attempted: 0,
    fetched: [],
    skipped: [],
  };
  let countryScope: CountryScopeSummary | undefined;

  if (options.mode === 'targets') {
    const targets = options.limit ? TARGET_GREEK_ACTS.slice(0, options.limit) : TARGET_GREEK_ACTS;
    targetIngestion = await ingestTargets(targets, options, extractionCache);
  }

  if (options.mode === 'country_scope') {
    if (options.includeTargets) {
      const targets = options.limit ? TARGET_GREEK_ACTS.slice(0, options.limit) : TARGET_GREEK_ACTS;
      console.log('  Refreshing high-fidelity target acts first...\n');
      targetIngestion = await ingestTargets(targets, options, extractionCache);
      console.log('');
    }

    console.log('  Collecting country-scope metadata corpus...\n');
    countryScope = await ingestCountryScope(options);
  }

  const meta: IngestionMeta = {
    source: 'search.et.gr / searchetv99.azurewebsites.net + official FEK PDFs',
    generated_at: new Date().toISOString(),
    mode: options.mode,
    options: {
      ocr_enabled: options.ocr,
      ocr_max_pages: options.ocrMaxPages,
      from_year: options.fromYear,
      to_year: options.toYear,
      catalogues: options.catalogues,
      include_targets: options.includeTargets,
      max_documents: options.maxDocuments,
    },
    target_ingestion: targetIngestion,
    country_scope: countryScope,
    limitations: [
      'Official source is PDF-native for full text; country-scope ingestion stores official metadata and FEK PDF URLs for maximal coverage.',
      'High-fidelity parsed provisions/definitions are currently refreshed for explicit target acts; full country-wide article extraction would require substantially longer runtime and storage.',
      'OCR quality depends on source scan quality; low-confidence OCR passages are preserved as extracted (never fabricated).',
    ],
  };

  fs.writeFileSync(META_FILE, JSON.stringify(meta, null, 2));

  console.log('\n' + '='.repeat(72));
  console.log('Ingestion Report');
  console.log('='.repeat(72));
  console.log(`  Mode: ${options.mode}`);
  console.log(`  Targets attempted: ${targetIngestion.attempted}`);
  console.log(`  Targets fetched:   ${targetIngestion.fetched.length}`);
  console.log(`  Targets skipped:   ${targetIngestion.skipped.length}`);

  if (countryScope) {
    console.log(`  Country queries:   ${countryScope.query_attempts}`);
    console.log(`  Country errors:    ${countryScope.query_errors}`);
    console.log(`  Rows total:        ${countryScope.rows_total}`);
    console.log(`  Rows unique:       ${countryScope.rows_unique}`);
    console.log(`  Docs written:      ${countryScope.documents_written}`);
    console.log(`  Corpus file:       ${countryScope.output_file}`);
  }

  console.log(`  Seed dir:          ${SEED_DIR}`);
  console.log(`  Meta file:         ${META_FILE}`);
  console.log('');
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
