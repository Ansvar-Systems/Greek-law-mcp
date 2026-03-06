import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import Database from 'better-sqlite3';
import { existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_PATH = join(__dirname, '..', 'data', 'database.db');
const HAS_DB = existsSync(DB_PATH);

let db: InstanceType<typeof Database>;

beforeAll(() => {
  if (!HAS_DB) return;
  db = new Database(DB_PATH, { readonly: true });
});

afterAll(() => {
  if (db) db.close();
});

describe.skipIf(!HAS_DB)('Greek Law MCP Database (official FEK ingestion mode)', () => {
  describe('Schema', () => {
    it('has legal_documents table', () => {
      const row = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='legal_documents'").get();
      expect(row).toBeDefined();
    });

    it('has legal_provisions table', () => {
      const row = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='legal_provisions'").get();
      expect(row).toBeDefined();
    });
  });

  describe('Counts', () => {
    it('has at least 10 legal documents', () => {
      const row = db.prepare('SELECT COUNT(*) as count FROM legal_documents').get() as { count: number };
      expect(row.count).toBeGreaterThanOrEqual(10);
    });

    it('has extracted provisions from official FEK text', () => {
      const row = db.prepare('SELECT COUNT(*) as count FROM legal_provisions').get() as { count: number };
      expect(row.count).toBeGreaterThan(900);
    });

    it('has extracted definitions from definitions provisions where detectable', () => {
      const row = db.prepare('SELECT COUNT(*) as count FROM definitions').get() as { count: number };
      expect(row.count).toBeGreaterThan(100);
    });

    it('has zero EU cross-references in metadata-only ingestion', () => {
      const euDocs = db.prepare('SELECT COUNT(*) as count FROM eu_documents').get() as { count: number };
      const euRefs = db.prepare('SELECT COUNT(*) as count FROM eu_references').get() as { count: number };
      expect(euDocs.count).toBe(0);
      expect(euRefs.count).toBe(0);
    });
  });

  describe('Official records', () => {
    it('contains Law 4624/2019 official FEK URL', () => {
      const row = db.prepare(
        "SELECT title, issued_date, url FROM legal_documents WHERE id = 'law-4624-2019'"
      ).get() as { title: string; issued_date: string; url: string } | undefined;
      expect(row).toBeDefined();
      expect(row!.title).toContain('ΚΑΝΟΝΙΣΜΟΥ (ΕΕ) 2016/679');
      expect(row!.issued_date).toBe('2019-08-29');
      expect(row!.url).toContain('/2019/20190100137.pdf');
    });

    it('contains PD 131/2003 official FEK URL', () => {
      const row = db.prepare(
        "SELECT title, issued_date, url FROM legal_documents WHERE id = 'pd-131-2003'"
      ).get() as { title: string; issued_date: string; url: string } | undefined;
      expect(row).toBeDefined();
      expect(row!.title).toContain('ΟΔΗΓΙΑ 2000/31');
      expect(row!.issued_date).toBe('2003-05-16');
      expect(row!.url).toContain('/2003/20030100116.pdf');
    });

    it('contains Law 4624/2019 Art. 1 provision text', () => {
      const row = db.prepare(
        "SELECT content FROM legal_provisions WHERE document_id = 'law-4624-2019' AND provision_ref = 'Art. 1'"
      ).get() as { content: string } | undefined;
      expect(row).toBeDefined();
      expect(row!.content).toContain('Σκοπός του παρόντος νόμου');
    });

    it('contains PD 131/2003 Art. 1 provision text', () => {
      const row = db.prepare(
        "SELECT content FROM legal_provisions WHERE document_id = 'pd-131-2003' AND provision_ref = 'Art. 1'"
      ).get() as { content: string } | undefined;
      expect(row).toBeDefined();
      expect(row!.content).toContain('Ορισμοί');
    });
  });

  describe('Metadata', () => {
    it('jurisdiction is GR', () => {
      const row = db.prepare("SELECT value FROM db_metadata WHERE key = 'jurisdiction'").get() as { value: string };
      expect(row.value).toBe('GR');
    });

    it('source metadata is present', () => {
      const row = db.prepare("SELECT value FROM db_metadata WHERE key = 'source'").get() as { value: string };
      expect(row.value).toBe('official-source');
    });
  });
});
