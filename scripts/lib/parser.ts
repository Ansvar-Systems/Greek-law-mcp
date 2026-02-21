/**
 * Parser and target catalogue for official Greek legislation metadata.
 *
 * Source:
 *   - search.et.gr / searchetv99.azurewebsites.net API
 *   - Official full text is available as FEK PDF only.
 *
 * Limitation:
 *   - No structured article-level API endpoint was found.
 *   - Therefore this parser emits document metadata and source URLs only.
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
    // Official source does not provide article-level text via API.
    provisions: [],
    definitions: [],
  };
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
