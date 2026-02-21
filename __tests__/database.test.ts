import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_PATH = join(__dirname, '..', 'data', 'database.db');

let db: InstanceType<typeof Database>;

beforeAll(() => {
  db = new Database(DB_PATH, { readonly: true });
});

afterAll(() => {
  db.close();
});

describe('Greek Law MCP Database (official metadata mode)', () => {
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
    it('has 10 legal documents', () => {
      const row = db.prepare('SELECT COUNT(*) as count FROM legal_documents').get() as { count: number };
      expect(row.count).toBe(10);
    });

    it('has zero provisions because official source is PDF-only', () => {
      const row = db.prepare('SELECT COUNT(*) as count FROM legal_provisions').get() as { count: number };
      expect(row.count).toBe(0);
    });

    it('has zero definitions because no structured article text is available', () => {
      const row = db.prepare('SELECT COUNT(*) as count FROM definitions').get() as { count: number };
      expect(row.count).toBe(0);
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
