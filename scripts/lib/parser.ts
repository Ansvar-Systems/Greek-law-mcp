/**
 * Parser and target catalogue for official Greek legislation ingestion.
 *
 * Source:
 *   - search.et.gr / searchetv99.azurewebsites.net API
 *   - Official full text is available as FEK PDF.
 */

import type { SearchLegislationRow } from './fetcher.js';

export interface ActTarget {
  id: string;
  lawNumber: string;
  year: number;
  /**
   * 1 = law, 2 = presidential decree
   * (as used by /api/searchlegislation)
   */
  legislationCatalogues: '1' | '2';
  shortName?: string;
  status: 'in_force' | 'amended' | 'repealed' | 'not_yet_in_force';
  titleEn?: string;
  notes?: string;
}

export interface ParsedProvision {
  provision_ref: string;
  chapter?: string;
  section: string;
  title: string;
  content: string;
}

export interface ParsedDefinition {
  term: string;
  definition: string;
  source_provision?: string;
}

export interface ParsedAct {
  id: string;
  type: 'statute';
  title: string;
  title_en: string;
  short_name: string;
  status: 'in_force' | 'amended' | 'repealed' | 'not_yet_in_force';
  issued_date?: string;
  in_force_date?: string;
  url: string;
  description?: string;
  provisions: ParsedProvision[];
  definitions: ParsedDefinition[];
}

function sanitizeIdToken(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

function normalizeWhitespace(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

function parseUsDateToIso(dateValue: string | undefined): string | undefined {
  if (!dateValue) return undefined;
  // API shape: "MM/DD/YYYY HH:mm:ss"
  const match = dateValue.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (!match) return undefined;
  const month = match[1].padStart(2, '0');
  const day = match[2].padStart(2, '0');
  const year = match[3];
  return `${year}-${month}-${day}`;
}

export function parseSearchIssueYear(row: SearchLegislationRow): number | null {
  const issueDate = parseUsDateToIso(row.search_IssueDate);
  if (!issueDate) return null;
  const year = Number.parseInt(issueDate.slice(0, 4), 10);
  return Number.isNaN(year) ? null : year;
}

function pad(value: string, size: number): string {
  return value.padStart(size, '0');
}

function buildFekPdfUrl(row: SearchLegislationRow): string {
  const issueGroup = pad(row.search_IssueGroupID, 2);
  const issuedDateIso = parseUsDateToIso(row.search_IssueDate);
  const year = issuedDateIso?.slice(0, 4) ?? '0000';
  const documentNumber = pad(row.search_DocumentNumber, 5);
  const fileId = `${year}${issueGroup}${documentNumber}`;
  return `https://ia37rg02wpsa01.blob.core.windows.net/fek/${issueGroup}/${year}/${fileId}.pdf`;
}

export function pickBestSearchResult(
  rows: SearchLegislationRow[],
  target: ActTarget
): SearchLegislationRow | null {
  if (rows.length === 0) return null;

  const strict = rows.filter(r => {
    const lawNo = normalizeWhitespace(r.search_LawProtocolNumber ?? '');
    const issueDateIso = parseUsDateToIso(r.search_IssueDate);
    const year = issueDateIso ? Number.parseInt(issueDateIso.slice(0, 4), 10) : NaN;
    return lawNo === target.lawNumber && year === target.year;
  });

  if (strict.length > 0) return strict[0];

  const byNumber = rows.filter(r => normalizeWhitespace(r.search_LawProtocolNumber ?? '') === target.lawNumber);
  if (byNumber.length > 0) return byNumber[0];

  return rows[0];
}

export function parseSearchResultToAct(row: SearchLegislationRow, target: ActTarget): ParsedAct {
  const title = normalizeWhitespace(row.search_Description || row.search_PrimaryLabel || '');
  const issuedDate = parseUsDateToIso(row.search_IssueDate);

  return {
    id: target.id,
    type: 'statute',
    title,
    title_en: target.titleEn ?? '',
    short_name: target.shortName ?? `${target.legislationCatalogues === '2' ? 'Π.Δ.' : 'Ν.'} ${target.lawNumber}/${target.year}`,
    status: target.status,
    issued_date: issuedDate,
    url: buildFekPdfUrl(row),
    description: title,
    provisions: [],
    definitions: [],
  };
}

function catalogueToPrefix(catalogue: string): string {
  if (catalogue === '1') return 'law';
  if (catalogue === '2') return 'pd';
  if (catalogue === '3') return 'pnp';
  return 'act';
}

function catalogueToShortLabel(catalogue: string): string {
  if (catalogue === '1') return 'Ν.';
  if (catalogue === '2') return 'Π.Δ.';
  if (catalogue === '3') return 'Π.Ν.Π.';
  return 'Πράξη';
}

export function buildCountryScopeActId(
  row: SearchLegislationRow,
  legislationCatalogue: string,
): string {
  const year = parseSearchIssueYear(row) ?? 0;
  const lawNumberRaw = normalizeWhitespace(row.search_LawProtocolNumber ?? row.search_DocumentNumber ?? '');
  const lawNumberToken = sanitizeIdToken(lawNumberRaw.length > 0 ? lawNumberRaw : row.search_DocumentNumber ?? '');
  const prefix = catalogueToPrefix(legislationCatalogue);
  return `${prefix}-${lawNumberToken || 'unknown'}-${year}-sid-${row.search_ID}`;
}

export function parseSearchResultToCountryScopeAct(
  row: SearchLegislationRow,
  legislationCatalogue: string,
): ParsedAct {
  const title = normalizeWhitespace(row.search_Description || row.search_PrimaryLabel || '');
  const issuedDate = parseUsDateToIso(row.search_IssueDate);
  const year = issuedDate?.slice(0, 4) ?? '0000';
  const lawNumber = normalizeWhitespace(row.search_LawProtocolNumber ?? row.search_DocumentNumber ?? '');
  const shortLabel = catalogueToShortLabel(legislationCatalogue);

  return {
    id: buildCountryScopeActId(row, legislationCatalogue),
    type: 'statute',
    title,
    title_en: '',
    short_name: lawNumber ? `${shortLabel} ${lawNumber}/${year}` : `${shortLabel} ${year}`,
    status: 'in_force',
    issued_date: issuedDate,
    url: buildFekPdfUrl(row),
    description: title,
    provisions: [],
    definitions: [],
  };
}

interface ArticleHeading {
  startOffset: number;
  endOffset: number;
  section: string;
  inlineTitle?: string;
}

export interface ParseProvisionOptions {
  lawNumber?: string;
  legislationCatalogues?: '1' | '2';
}

const ARTICLE_HEADING_LINE_REGEX = /^\s*(?:Άρθρο|Αρθρο|ΑΡΘΡΟ|[΄´']Αρθρο|Άρδρο|Αρδρο|ΑΡΔΡΟ|Αρϑρο)\s+([0-9]{1,3}[A-Za-zΑ-Ωα-ω΄’'\-]*)(?:\s*[-–—.:]\s*(.+)|\s{2,}(.+))?\s*$/u;
const CHAPTER_LINE_REGEX = /^\s*ΚΕΦΑΛΑΙΟ\s+([Α-ΩA-Za-z0-9΄'’\-]+)/u;

function normalizeDocumentText(text: string): string {
  return text
    .replace(/\r/g, '')
    .replace(/\f/g, '\n')
    .replace(/\u0000/g, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function normalizeSectionToken(value: string): string {
  return value
    .replace(/[.·]/g, '')
    .replace(/[΄’']/g, '')
    .trim();
}

function findArticleHeadings(text: string): ArticleHeading[] {
  const headings: ArticleHeading[] = [];
  const lines = text.split('\n');
  let offset = 0;

  for (const line of lines) {
    const trimmed = line.trim();
    const match = trimmed.match(ARTICLE_HEADING_LINE_REGEX);
    if (match) {
      const section = normalizeSectionToken(match[1]);
      const inlineTitle = normalizeWhitespace((match[2] ?? match[3] ?? '').replace(/\.+\s*\d+$/, '').trim());
      const title = inlineTitle.length > 0 && inlineTitle.length <= 160 ? inlineTitle : undefined;
      const lineStart = offset + Math.max(0, line.indexOf(trimmed));

      headings.push({
        startOffset: lineStart,
        endOffset: offset + line.length + 1,
        section,
        inlineTitle: title,
      });
    }

    offset += line.length + 1;
  }

  return headings;
}

function normalizeProvisionBody(text: string): string {
  const lines = text.split('\n');
  const filtered = lines.filter(line => {
    const trimmed = line.trim();
    if (!trimmed) return true;
    if (/^ΕΦΗΜΕΡΙ[ΣΣ].*ΚΥΒΕΡΝΗΣΕΩΣ/iu.test(trimmed)) return false;
    if (/^Τεύχος\s+[A-Za-zΑ-ΩΆ-Ώ].*/iu.test(trimmed)) return false;
    if (/^\d{3,4}$/.test(trimmed)) return false;
    return true;
  });

  return filtered
    .join('\n')
    .replace(/^\s+|\s+$/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function parseChapterNearOffset(text: string, headingOffset: number): string | undefined {
  const windowStart = Math.max(0, headingOffset - 600);
  const region = text.slice(windowStart, headingOffset);
  const lines = region.split('\n');

  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i].trim();
    const match = line.match(CHAPTER_LINE_REGEX);
    if (match) {
      return `ΚΕΦΑΛΑΙΟ ${match[1]}`;
    }
  }

  return undefined;
}

function looksLikeTitle(line: string): boolean {
  if (!line) return false;
  if (line.length > 140) return false;
  if (/^\(?\d+[.)]/.test(line)) return false;
  if (/^[α-ωΑ-Ω]\)/u.test(line)) return false;
  if (/^[-–—]/.test(line)) return false;
  return true;
}

function pickProvisionTitle(section: string, inlineTitle: string | undefined, body: string): string {
  if (inlineTitle) {
    return `Άρθρο ${section} - ${inlineTitle}`;
  }

  const firstLine = body.split('\n').map(line => line.trim()).find(Boolean);
  if (firstLine && looksLikeTitle(firstLine)) {
    return `Άρθρο ${section} - ${firstLine}`;
  }

  return `Άρθρο ${section}`;
}

function dedupeAndSortProvisions(provisions: ParsedProvision[]): ParsedProvision[] {
  const byRef = new Map<string, ParsedProvision>();
  for (const provision of provisions) {
    const key = provision.provision_ref;
    const existing = byRef.get(key);
    if (!existing || normalizeWhitespace(provision.content).length > normalizeWhitespace(existing.content).length) {
      byRef.set(key, provision);
    }
  }

  return Array.from(byRef.values()).sort((a, b) => {
    const aNum = Number.parseInt(a.section, 10);
    const bNum = Number.parseInt(b.section, 10);
    if (!Number.isNaN(aNum) && !Number.isNaN(bNum) && aNum !== bNum) return aNum - bNum;
    return a.section.localeCompare(b.section, 'el');
  });
}

function buildStartRegex(options: ParseProvisionOptions): RegExp | null {
  if (!options.lawNumber || !options.legislationCatalogues) return null;

  const escapedNumber = options.lawNumber.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  if (options.legislationCatalogues === '1') {
    return new RegExp(
      String.raw`(?:^|\n)\s*(?:ΝΟΜΟΣ|Νόμος)\s+ΥΠ[’'΄]?\s*ΑΡΙΘ\.?\s*${escapedNumber}\b`,
      'iu',
    );
  }

  return new RegExp(
    String.raw`(?:^|\n)\s*ΠΡΟΕΔΡΙΚΟ\s+ΔΙΑΤΑΓΜΑ\s+ΥΠ[’'΄]?\s*ΑΡΙΘ\.?\s*${escapedNumber}\b`,
    'iu',
  );
}

function isolateTargetDocument(text: string, options: ParseProvisionOptions): string {
  const startRegex = buildStartRegex(options);
  if (!startRegex) return text;

  const startMatch = startRegex.exec(text);
  if (!startMatch || startMatch.index === undefined) {
    return text;
  }

  const startIndex = startMatch.index;
  const searchFrom = startIndex + startMatch[0].length;
  const afterStart = text.slice(searchFrom);
  const nextDocRegex =
    /(?:^|\n)\s*(?:ΝΟΜΟΣ|ΠΡΟΕΔΡΙΚΟ\s+ΔΙΑΤΑΓΜΑ|ΝΟΜΟΘΕΤΙΚΟ\s+ΔΙΑΤΑΓΜΑ)\s+ΥΠ[’'΄]?\s*ΑΡΙΘ\.?\s*\d+/gu;
  const nextMatch = nextDocRegex.exec(afterStart);
  const endIndex = nextMatch && nextMatch.index !== undefined
    ? searchFrom + nextMatch.index
    : text.length;

  return text.slice(startIndex, endIndex).trim();
}

export function parseProvisionsFromOfficialText(
  text: string,
  options: ParseProvisionOptions = {},
): ParsedProvision[] {
  const normalized = normalizeDocumentText(text);
  const documentScope = isolateTargetDocument(normalized, options);
  const headings = findArticleHeadings(documentScope);

  if (headings.length === 0) {
    return [];
  }

  const parsed: ParsedProvision[] = [];
  for (let i = 0; i < headings.length; i++) {
    const current = headings[i];
    const next = headings[i + 1];
    const bodyStart = current.endOffset;
    const bodyEnd = next ? next.startOffset : documentScope.length;
    const rawBody = documentScope.slice(bodyStart, bodyEnd);
    const body = normalizeProvisionBody(rawBody);
    if (body.length < 40) continue;

    const section = current.section;
    parsed.push({
      provision_ref: `Art. ${section}`,
      chapter: parseChapterNearOffset(documentScope, current.startOffset),
      section,
      title: pickProvisionTitle(section, current.inlineTitle, body),
      content: body,
    });
  }

  return dedupeAndSortProvisions(parsed);
}

function isDefinitionsProvision(provision: ParsedProvision): boolean {
  const title = provision.title ?? '';
  return /Ορισμοί|Ορισμός/iu.test(title) || /Ορισμοί|Ορισμός/iu.test(provision.content.slice(0, 200));
}

export function extractDefinitionsFromProvisions(provisions: ParsedProvision[]): ParsedDefinition[] {
  const byTerm = new Map<string, ParsedDefinition>();

  for (const provision of provisions) {
    if (!isDefinitionsProvision(provision)) continue;
    const lines = provision.content.split('\n').map(line => line.trim()).filter(Boolean);

    for (const line of lines) {
      const quoteMatch = line.match(/[«"]([^»"]{2,120})[»"]\s*[:\-]\s*(.+)$/u);
      if (!quoteMatch) continue;

      const term = normalizeWhitespace(quoteMatch[1]);
      const definition = normalizeWhitespace(quoteMatch[2]);
      if (!term || !definition) continue;
      if (definition.length < 4) continue;

      byTerm.set(term.toLocaleLowerCase('el'), {
        term,
        definition,
        source_provision: provision.provision_ref,
      });
    }
  }

  return Array.from(byTerm.values()).slice(0, 100);
}

/**
 * Ten target records preserved from the original repository scope.
 * law-4577-2018-nis and law-4577-2018-cii intentionally map to the same
 * official law number because the original MCP modeled two thematic views.
 */
export const TARGET_GREEK_ACTS: ActTarget[] = [
  {
    id: 'law-1733-1987',
    lawNumber: '1733',
    year: 1987,
    legislationCatalogues: '1',
    shortName: 'Ν. 1733/1987',
    status: 'amended',
  },
  {
    id: 'law-2472-1997',
    lawNumber: '2472',
    year: 1997,
    legislationCatalogues: '1',
    shortName: 'Ν. 2472/1997',
    status: 'amended',
  },
  {
    id: 'law-3979-2011',
    lawNumber: '3979',
    year: 2011,
    legislationCatalogues: '1',
    shortName: 'Ν. 3979/2011',
    status: 'amended',
  },
  {
    id: 'law-4070-2012',
    lawNumber: '4070',
    year: 2012,
    legislationCatalogues: '1',
    shortName: 'Ν. 4070/2012',
    status: 'in_force',
  },
  {
    id: 'law-4577-2018-nis',
    lawNumber: '4577',
    year: 2018,
    legislationCatalogues: '1',
    shortName: 'Ν. 4577/2018',
    status: 'in_force',
  },
  {
    id: 'law-4577-2018-cii',
    lawNumber: '4577',
    year: 2018,
    legislationCatalogues: '1',
    shortName: 'Ν. 4577/2018',
    status: 'in_force',
  },
  {
    id: 'law-4624-2019',
    lawNumber: '4624',
    year: 2019,
    legislationCatalogues: '1',
    shortName: 'Ν. 4624/2019',
    status: 'in_force',
  },
  {
    id: 'law-4727-2020',
    lawNumber: '4727',
    year: 2020,
    legislationCatalogues: '1',
    shortName: 'Ν. 4727/2020',
    status: 'in_force',
  },
  {
    id: 'pd-131-2003',
    lawNumber: '131',
    year: 2003,
    legislationCatalogues: '2',
    shortName: 'Π.Δ. 131/2003',
    status: 'in_force',
  },
  {
    id: 'penal-code-cybercrime',
    lawNumber: '4619',
    year: 2019,
    legislationCatalogues: '1',
    shortName: 'Ποινικός Κώδικας',
    status: 'in_force',
  },
];
