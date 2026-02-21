#!/usr/bin/env tsx
/**
 * Greek Law MCP -- Official Metadata Ingestion
 *
 * Ingests real official records from the Greek National Printing House search API.
 * This pipeline writes document metadata and official FEK PDF links.
 *
 * Important limitation:
 *   Full legal text is available as PDF only, with no structured article API.
 *   Therefore seed files contain no provisions/definitions.
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { searchLegislation } from './lib/fetcher.js';
import {
  TARGET_GREEK_ACTS,
  pickBestSearchResult,
  parseSearchResultToAct,
  type ActTarget,
  type ParsedAct,
} from './lib/parser.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SEED_DIR = path.resolve(__dirname, '../data/seed');
const META_FILE = path.join(SEED_DIR, '_ingestion-meta.json');

interface IngestionMeta {
  source: string;
  generated_at: string;
  fetched: {
    id: string;
    law_number: string;
    year: number;
    official_label: string;
    official_search_id: string;
    pdf_url: string;
  }[];
  skipped: {
    id: string;
    law_number: string;
    year: number;
    reason: string;
  }[];
  limitations: string[];
}

function parseArgs(): { limit: number | null } {
  const args = process.argv.slice(2);
  let limit: number | null = null;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--limit' && args[i + 1]) {
      limit = Number.parseInt(args[i + 1], 10);
      i++;
    }
  }

  return { limit };
}

async function ingestAct(target: ActTarget): Promise<{
  ok: true;
  act: ParsedAct;
  officialLabel: string;
  officialSearchId: string;
} | {
  ok: false;
  reason: string;
}> {
  const rows = await searchLegislation({
    legislationCatalogues: target.legislationCatalogues,
    legislationNumber: target.lawNumber,
    selectYear: [String(target.year)],
  });

  const best = pickBestSearchResult(rows, target);
  if (!best) {
    return { ok: false, reason: 'No official result for law number/year in search API' };
  }

  const act = parseSearchResultToAct(best, target);
  return {
    ok: true,
    act,
    officialLabel: best.search_PrimaryLabel,
    officialSearchId: best.search_ID,
  };
}

async function main(): Promise<void> {
  const { limit } = parseArgs();

  console.log('Greek Law MCP -- Official Metadata Ingestion');
  console.log('===========================================\n');
  console.log('  Source:  search.et.gr / searchetv99.azurewebsites.net');
  console.log('  Method:  Official API metadata + FEK PDF URL derivation');
  console.log('  Note:    No structured article-level API found (PDF-only full text)\n');

  fs.mkdirSync(SEED_DIR, { recursive: true });

  const targets = limit ? TARGET_GREEK_ACTS.slice(0, limit) : TARGET_GREEK_ACTS;
  const fetched: IngestionMeta['fetched'] = [];
  const skipped: IngestionMeta['skipped'] = [];

  for (const target of targets) {
    process.stdout.write(`  Resolving ${target.id} (${target.lawNumber}/${target.year})...`);
    try {
      const result = await ingestAct(target);
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
      });

      console.log(` OK (${result.officialLabel})`);
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
    source: 'search.et.gr / searchetv99.azurewebsites.net',
    generated_at: new Date().toISOString(),
    fetched,
    skipped,
    limitations: [
      'Official API exposes metadata and FEK PDF links.',
      'No structured endpoint for article-level legal text was found.',
      'Seed files intentionally contain zero provisions/definitions to avoid synthetic text.',
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
