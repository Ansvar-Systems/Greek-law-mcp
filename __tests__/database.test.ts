import { describe, it, expect, beforeAll } from 'vitest';
import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_PATH = join(__dirname, '..', 'data', 'database.db');

let db: InstanceType<typeof Database>;

beforeAll(() => {
  db = new Database(DB_PATH, { readonly: true });
});

describe('Greek Law MCP Database', () => {
  describe('Schema', () => {
    it('has legal_documents table', () => {
      const tables = db.prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='legal_documents'"
      ).all();
      expect(tables).toHaveLength(1);
    });

    it('has legal_provisions table', () => {
      const tables = db.prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='legal_provisions'"
      ).all();
      expect(tables).toHaveLength(1);
    });

    it('has definitions table', () => {
      const tables = db.prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='definitions'"
      ).all();
      expect(tables).toHaveLength(1);
    });

    it('has eu_documents table', () => {
      const tables = db.prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='eu_documents'"
      ).all();
      expect(tables).toHaveLength(1);
    });

    it('has eu_references table', () => {
      const tables = db.prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='eu_references'"
      ).all();
      expect(tables).toHaveLength(1);
    });

    it('has provisions_fts virtual table', () => {
      const tables = db.prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='provisions_fts'"
      ).all();
      expect(tables).toHaveLength(1);
    });
  });

  describe('Content', () => {
    it('has 10 legal documents', () => {
      const row = db.prepare('SELECT COUNT(*) as count FROM legal_documents').get() as { count: number };
      expect(row.count).toBe(10);
    });

    it('has at least 200 provisions', () => {
      const row = db.prepare('SELECT COUNT(*) as count FROM legal_provisions').get() as { count: number };
      expect(row.count).toBeGreaterThanOrEqual(200);
    });

    it('has at least 20 definitions', () => {
      const row = db.prepare('SELECT COUNT(*) as count FROM definitions').get() as { count: number };
      expect(row.count).toBeGreaterThanOrEqual(20);
    });

    it('has EU documents extracted', () => {
      const row = db.prepare('SELECT COUNT(*) as count FROM eu_documents').get() as { count: number };
      expect(row.count).toBeGreaterThan(0);
    });

    it('has EU references extracted', () => {
      const row = db.prepare('SELECT COUNT(*) as count FROM eu_references').get() as { count: number };
      expect(row.count).toBeGreaterThan(0);
    });
  });

  describe('Specific documents', () => {
    it('contains GDPR Implementation Law (4624/2019)', () => {
      const doc = db.prepare("SELECT * FROM legal_documents WHERE id = 'law-4624-2019'").get() as Record<string, unknown>;
      expect(doc).toBeDefined();
      expect(doc.title_en).toContain('4624/2019');
      expect(doc.status).toBe('in_force');
    });

    it('contains NIS Implementation Law (4577/2018)', () => {
      const doc = db.prepare("SELECT * FROM legal_documents WHERE id = 'law-4577-2018-nis'").get() as Record<string, unknown>;
      expect(doc).toBeDefined();
      expect(doc.title_en).toContain('4577/2018');
    });

    it('contains Penal Code cybercrime provisions', () => {
      const doc = db.prepare("SELECT * FROM legal_documents WHERE id = 'penal-code-cybercrime'").get() as Record<string, unknown>;
      expect(doc).toBeDefined();
      expect(doc.title_en).toContain('Penal Code');
    });

    it('contains Digital Governance Law (4727/2020)', () => {
      const doc = db.prepare("SELECT * FROM legal_documents WHERE id = 'law-4727-2020'").get() as Record<string, unknown>;
      expect(doc).toBeDefined();
      expect(doc.title_en).toContain('Digital Governance');
    });

    it('contains E-Commerce Decree (PD 131/2003)', () => {
      const doc = db.prepare("SELECT * FROM legal_documents WHERE id = 'pd-131-2003'").get() as Record<string, unknown>;
      expect(doc).toBeDefined();
      expect(doc.title_en).toContain('electronic commerce');
    });

    it('contains Law 2472/1997 on personal data protection', () => {
      const doc = db.prepare("SELECT * FROM legal_documents WHERE id = 'law-2472-1997'").get() as Record<string, unknown>;
      expect(doc).toBeDefined();
      expect(doc.status).toBe('amended');
    });

    it('contains eGovernment Law (3979/2011)', () => {
      const doc = db.prepare("SELECT * FROM legal_documents WHERE id = 'law-3979-2011'").get() as Record<string, unknown>;
      expect(doc).toBeDefined();
    });

    it('contains Electronic Communications Law (4070/2012)', () => {
      const doc = db.prepare("SELECT * FROM legal_documents WHERE id = 'law-4070-2012'").get() as Record<string, unknown>;
      expect(doc).toBeDefined();
    });

    it('contains Critical Infrastructure Law (4577/2018)', () => {
      const doc = db.prepare("SELECT * FROM legal_documents WHERE id = 'law-4577-2018-cii'").get() as Record<string, unknown>;
      expect(doc).toBeDefined();
    });

    it('contains Trade Secrets Law (1733/1987)', () => {
      const doc = db.prepare("SELECT * FROM legal_documents WHERE id = 'law-1733-1987'").get() as Record<string, unknown>;
      expect(doc).toBeDefined();
    });
  });

  describe('Provisions content', () => {
    it('GDPR Law Art. 1 mentions personal data and Regulation (EU) 2016/679', () => {
      const prov = db.prepare(
        "SELECT content FROM legal_provisions WHERE document_id = 'law-4624-2019' AND provision_ref = 'Art. 1'"
      ).get() as { content: string };
      expect(prov).toBeDefined();
      expect(prov.content).toContain('personal data');
      expect(prov.content).toContain('Regulation (EU) 2016/679');
    });

    it('NIS Law Art. 1 mentions Directive (EU) 2016/1148', () => {
      const prov = db.prepare(
        "SELECT content FROM legal_provisions WHERE document_id = 'law-4577-2018-nis' AND provision_ref = 'Art. 1'"
      ).get() as { content: string };
      expect(prov).toBeDefined();
      expect(prov.content).toContain('Directive (EU) 2016/1148');
    });

    it('Penal Code Art. 370B(1) covers unauthorised access', () => {
      const prov = db.prepare(
        "SELECT content FROM legal_provisions WHERE document_id = 'penal-code-cybercrime' AND provision_ref = 'Art. 370B(1)'"
      ).get() as { content: string };
      expect(prov).toBeDefined();
      expect(prov.content).toContain('computer system');
    });

    it('Digital Governance Law Art. 4 mentions gov.gr', () => {
      const prov = db.prepare(
        "SELECT content FROM legal_provisions WHERE document_id = 'law-4727-2020' AND provision_ref = 'Art. 4'"
      ).get() as { content: string };
      expect(prov).toBeDefined();
      expect(prov.content).toContain('gov.gr');
    });
  });

  describe('Full-text search', () => {
    it('search for "personal data" returns results', () => {
      const results = db.prepare(
        "SELECT COUNT(*) as count FROM provisions_fts WHERE provisions_fts MATCH 'personal data'"
      ).get() as { count: number };
      expect(results.count).toBeGreaterThan(0);
    });

    it('search for "cybersecurity" returns results', () => {
      const results = db.prepare(
        "SELECT COUNT(*) as count FROM provisions_fts WHERE provisions_fts MATCH 'cybersecurity'"
      ).get() as { count: number };
      expect(results.count).toBeGreaterThan(0);
    });

    it('search for "trade secret" returns results', () => {
      const results = db.prepare(
        "SELECT COUNT(*) as count FROM provisions_fts WHERE provisions_fts MATCH '\"trade secret\"'"
      ).get() as { count: number };
      expect(results.count).toBeGreaterThan(0);
    });
  });

  describe('EU cross-references', () => {
    it('GDPR (2016/679) is referenced', () => {
      const ref = db.prepare(
        "SELECT * FROM eu_documents WHERE id LIKE '%2016/679%'"
      ).get() as Record<string, unknown>;
      expect(ref).toBeDefined();
    });

    it('NIS Directive (2016/1148) is referenced', () => {
      const ref = db.prepare(
        "SELECT * FROM eu_documents WHERE id LIKE '%2016/1148%'"
      ).get() as Record<string, unknown>;
      expect(ref).toBeDefined();
    });

    it('GDPR Implementation Law has EU references', () => {
      const row = db.prepare(
        "SELECT COUNT(*) as count FROM eu_references WHERE document_id = 'law-4624-2019'"
      ).get() as { count: number };
      expect(row.count).toBeGreaterThan(0);
    });
  });

  describe('Metadata', () => {
    it('jurisdiction is GR', () => {
      const row = db.prepare(
        "SELECT value FROM db_metadata WHERE key = 'jurisdiction'"
      ).get() as { value: string };
      expect(row.value).toBe('GR');
    });

    it('schema_version is 2', () => {
      const row = db.prepare(
        "SELECT value FROM db_metadata WHERE key = 'schema_version'"
      ).get() as { value: string };
      expect(row.value).toBe('2');
    });

    it('has built_at timestamp', () => {
      const row = db.prepare(
        "SELECT value FROM db_metadata WHERE key = 'built_at'"
      ).get() as { value: string };
      expect(row.value).toBeDefined();
      expect(row.value.length).toBeGreaterThan(0);
    });
  });
});
