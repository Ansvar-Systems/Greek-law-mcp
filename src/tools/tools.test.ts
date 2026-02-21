/**
 * Tool-level database checks for metadata-only official ingestion.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import Database from 'better-sqlite3';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_PATH = join(__dirname, '..', '..', 'data', 'database.db');

let db: InstanceType<typeof Database>;

beforeAll(() => {
  db = new Database(DB_PATH, { readonly: true });
  db.pragma('foreign_keys = ON');
});

afterAll(() => {
  if (db) db.close();
});

describe('database integrity', () => {
  it('has 10 legal documents', () => {
    const row = db.prepare('SELECT COUNT(*) as cnt FROM legal_documents').get() as { cnt: number };
    expect(row.cnt).toBe(10);
  });

  it('has zero provisions in metadata-only mode', () => {
    const row = db.prepare('SELECT COUNT(*) as cnt FROM legal_provisions').get() as { cnt: number };
    expect(row.cnt).toBe(0);
  });

  it('keeps FTS tables present even when empty', () => {
    const provFts = db.prepare("SELECT name FROM sqlite_master WHERE name='provisions_fts'").get();
    const defFts = db.prepare("SELECT name FROM sqlite_master WHERE name='definitions_fts'").get();
    expect(provFts).toBeDefined();
    expect(defFts).toBeDefined();
  });
});

describe('official records', () => {
  it('finds Law 4577/2018 metadata', () => {
    const row = db.prepare(
      "SELECT title, url FROM legal_documents WHERE id = 'law-4577-2018-nis'"
    ).get() as { title: string; url: string } | undefined;
    expect(row).toBeDefined();
    expect(row!.title).toContain('ΟΔΗΓΙΑΣ 2016/1148');
    expect(row!.url).toContain('/2018/20180100199.pdf');
  });

  it('finds Penal Code record mapped to Law 4619/2019', () => {
    const row = db.prepare(
      "SELECT title, url FROM legal_documents WHERE id = 'penal-code-cybercrime'"
    ).get() as { title: string; url: string } | undefined;
    expect(row).toBeDefined();
    expect(row!.title).toContain('ΠΟΙΝΙΚΟΥ ΚΩΔΙΚΑ');
    expect(row!.url).toContain('/2019/20190100095.pdf');
  });
});

describe('provision retrieval negative case', () => {
  it('returns no provision rows for known laws (no structured API source)', () => {
    const row = db.prepare(
      "SELECT content FROM legal_provisions WHERE document_id = 'law-4624-2019' AND provision_ref = 'Art. 1'"
    ).get();
    expect(row).toBeUndefined();
  });
});
