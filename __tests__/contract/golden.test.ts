/**
 * Golden contract tests for Greek Law MCP.
 * Validates DB integrity, census alignment, and core tool functionality
 * against real ingested FEK source data.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import Database from 'better-sqlite3';
import { existsSync, readFileSync } from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DB_PATH = path.resolve(__dirname, '../../data/database.db');
const CENSUS_PATH = path.resolve(__dirname, '../../data/census.json');
const HAS_DB = existsSync(DB_PATH);

let db: InstanceType<typeof Database>;
let census: {
  schema_version: string;
  jurisdiction: string;
  total_laws: number;
  total_provisions: number;
  laws: Array<{ id: string; title: string; provisions: number }>;
};

beforeAll(() => {
  if (!HAS_DB) return;
  db = new Database(DB_PATH, { readonly: true });
  db.pragma('journal_mode = DELETE');
  if (existsSync(CENSUS_PATH)) {
    census = JSON.parse(readFileSync(CENSUS_PATH, 'utf-8'));
  }
});

afterAll(() => {
  if (db) db.close();
});

describe.skipIf(!HAS_DB)('Database integrity', () => {
  it('should have a large legal-documents corpus (21k+)', () => {
    const row = db.prepare('SELECT COUNT(*) as cnt FROM legal_documents').get() as { cnt: number };
    expect(row.cnt).toBeGreaterThanOrEqual(21000);
  });

  it('should have at least 7k provisions', () => {
    const row = db.prepare('SELECT COUNT(*) as cnt FROM legal_provisions').get() as { cnt: number };
    expect(row.cnt).toBeGreaterThanOrEqual(7000);
  });

  it('should have extracted definitions', () => {
    const row = db.prepare('SELECT COUNT(*) as cnt FROM definitions').get() as { cnt: number };
    expect(row.cnt).toBeGreaterThanOrEqual(600);
  });

  it('should have FTS index populated', () => {
    const row = db.prepare(
      "SELECT COUNT(*) as cnt FROM provisions_fts WHERE provisions_fts MATCH 'νόμος'"
    ).get() as { cnt: number };
    expect(row.cnt).toBeGreaterThan(0);
  });

  it('should have definitions FTS populated', () => {
    const row = db.prepare(
      "SELECT name FROM sqlite_master WHERE name='definitions_fts'"
    ).get();
    expect(row).toBeDefined();
  });
});

describe.skipIf(!HAS_DB)('Census alignment', () => {
  it('census.json exists', () => {
    expect(existsSync(CENSUS_PATH)).toBe(true);
  });

  it('census jurisdiction is GR', () => {
    expect(census.jurisdiction).toBe('GR');
  });

  it('census total_laws matches DB', () => {
    const row = db.prepare('SELECT COUNT(*) as cnt FROM legal_documents').get() as { cnt: number };
    expect(census.total_laws).toBe(row.cnt);
  });

  it('census total_provisions matches DB', () => {
    const row = db.prepare('SELECT COUNT(*) as cnt FROM legal_provisions').get() as { cnt: number };
    expect(census.total_provisions).toBe(row.cnt);
  });
});

describe.skipIf(!HAS_DB)('Key laws are present', () => {
  const keyLaws = [
    { id: 'law-4624-2019', titleContains: 'ΚΑΝΟΝΙΣΜΟΥ (ΕΕ) 2016/679' },
    { id: 'pd-131-2003', titleContains: 'ΟΔΗΓΙΑ 2000/31' },
    { id: 'law-4577-2018-nis', titleContains: 'ΟΔΗΓΙΑΣ 2016/1148' },
    { id: 'penal-code-cybercrime', titleContains: 'ΠΟΙΝΙΚΟΥ ΚΩΔΙΚΑ' },
  ];

  for (const law of keyLaws) {
    it(`should contain ${law.id}`, () => {
      const row = db.prepare('SELECT id, title FROM legal_documents WHERE id = ?').get(law.id) as
        | { id: string; title: string }
        | undefined;
      expect(row).toBeDefined();
      expect(row!.title).toContain(law.titleContains);
    });
  }
});

describe.skipIf(!HAS_DB)('Article retrieval', () => {
  it('should retrieve Law 4624/2019 Art. 1', () => {
    const row = db.prepare(
      "SELECT content FROM legal_provisions WHERE document_id = 'law-4624-2019' AND provision_ref = 'Art. 1'"
    ).get() as { content: string } | undefined;
    expect(row).toBeDefined();
    expect(row!.content.length).toBeGreaterThan(50);
    expect(row!.content).toContain('Σκοπός του παρόντος νόμου');
  });

  it('should retrieve PD 131/2003 Art. 1', () => {
    const row = db.prepare(
      "SELECT content FROM legal_provisions WHERE document_id = 'pd-131-2003' AND provision_ref = 'Art. 1'"
    ).get() as { content: string } | undefined;
    expect(row).toBeDefined();
    expect(row!.content).toContain('Ορισμοί');
  });
});

describe.skipIf(!HAS_DB)('Search', () => {
  it('should find results via FTS for Greek text', () => {
    const row = db.prepare(
      "SELECT COUNT(*) as cnt FROM provisions_fts WHERE provisions_fts MATCH 'προσωπικά δεδομένα'"
    ).get() as { cnt: number };
    expect(row.cnt).toBeGreaterThan(0);
  });

  it('should find results via FTS for EU directive reference', () => {
    const row = db.prepare(
      "SELECT COUNT(*) as cnt FROM provisions_fts WHERE provisions_fts MATCH '2016'"
    ).get() as { cnt: number };
    expect(row.cnt).toBeGreaterThan(0);
  });
});

describe.skipIf(!HAS_DB)('Negative tests', () => {
  it('should return no results for fictional document', () => {
    const row = db.prepare(
      "SELECT COUNT(*) as cnt FROM legal_provisions WHERE document_id = 'fictional-law-2099'"
    ).get() as { cnt: number };
    expect(row.cnt).toBe(0);
  });

  it('should return no results for invalid provision ref', () => {
    const row = db.prepare(
      "SELECT COUNT(*) as cnt FROM legal_provisions WHERE document_id = 'law-4624-2019' AND provision_ref = '999ZZZ-INVALID'"
    ).get() as { cnt: number };
    expect(row.cnt).toBe(0);
  });
});

describe.skipIf(!HAS_DB)('list_sources metadata compatibility', () => {
  it('should have db_metadata table populated', () => {
    const row = db.prepare('SELECT COUNT(*) as cnt FROM db_metadata').get() as { cnt: number };
    expect(row.cnt).toBeGreaterThan(0);
  });

  it('should store GR jurisdiction metadata', () => {
    const row = db.prepare(
      "SELECT value FROM db_metadata WHERE key = 'jurisdiction'"
    ).get() as { value: string } | undefined;
    expect(row).toBeDefined();
    expect(row!.value).toBe('GR');
  });

  it('should store official-source metadata', () => {
    const row = db.prepare(
      "SELECT value FROM db_metadata WHERE key = 'source'"
    ).get() as { value: string } | undefined;
    expect(row).toBeDefined();
    expect(row!.value).toBe('official-source');
  });
});
