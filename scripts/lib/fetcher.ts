/**
 * Rate-limited client for official Greek legislation metadata.
 *
 * Source:
 *   - search.et.gr frontend + API backend
 *   - API base: https://searchetv99.azurewebsites.net/api
 *
 * Important limitation:
 *   The official source exposes law metadata and links to FEK PDFs, but does not
 *   expose structured article-level text via API.
 */

const USER_AGENT = 'Greek-Law-MCP/1.0 (https://github.com/Ansvar-Systems/Greek-law-mcp)';
const API_BASE = 'https://searchetv99.azurewebsites.net/api';
const MIN_DELAY_MS = 1200;

let lastRequestTime = 0;

function wait(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function rateLimit(): Promise<void> {
  const now = Date.now();
  const elapsed = now - lastRequestTime;
  if (elapsed < MIN_DELAY_MS) {
    await wait(MIN_DELAY_MS - elapsed);
  }
  lastRequestTime = Date.now();
}

export interface ApiEnvelope<T> {
  status: 'ok' | 'error';
  message: string;
  data: string;
  parsedData: T;
}

export async function fetchOfficialPdf(url: string, maxRetries = 3): Promise<Buffer> {
  await rateLimit();

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'User-Agent': USER_AGENT,
        'Accept': 'application/pdf,application/octet-stream,*/*',
      },
      redirect: 'follow',
    });

    if (response.status === 429 || response.status >= 500) {
      if (attempt < maxRetries) {
        const backoff = Math.pow(2, attempt + 1) * 1000;
        console.log(`  HTTP ${response.status} for ${url}, retrying in ${backoff}ms...`);
        await wait(backoff);
        continue;
      }
    }

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      throw new Error(`HTTP ${response.status} for ${url}: ${text.slice(0, 200)}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }

  throw new Error(`Failed to fetch PDF ${url} after ${maxRetries} retries`);
}

async function request<T>(
  path: string,
  method: 'GET' | 'POST',
  body?: Record<string, unknown>,
  maxRetries = 3
): Promise<ApiEnvelope<T>> {
  const url = `${API_BASE}${path}`;
  await rateLimit();

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const response = await fetch(url, {
      method,
      headers: {
        'User-Agent': USER_AGENT,
        'Accept': 'application/json',
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
      redirect: 'follow',
    });

    if (response.status === 429 || response.status >= 500) {
      if (attempt < maxRetries) {
        const backoff = Math.pow(2, attempt + 1) * 1000;
        console.log(`  HTTP ${response.status} for ${url}, retrying in ${backoff}ms...`);
        await wait(backoff);
        continue;
      }
    }

    const text = await response.text();
    if (!response.ok) {
      throw new Error(`HTTP ${response.status} for ${url}: ${text.slice(0, 200)}`);
    }

    let parsedEnvelope: { status?: string; message?: string; data?: string };
    try {
      parsedEnvelope = JSON.parse(text) as { status?: string; message?: string; data?: string };
    } catch {
      throw new Error(`Non-JSON response from ${url}`);
    }

    const rawData = parsedEnvelope.data ?? '[]';
    let parsedData: T;
    try {
      parsedData = JSON.parse(rawData) as T;
    } catch {
      throw new Error(`Invalid nested JSON payload from ${url}`);
    }

    return {
      status: parsedEnvelope.status === 'ok' ? 'ok' : 'error',
      message: parsedEnvelope.message ?? '',
      data: rawData,
      parsedData,
    };
  }

  throw new Error(`Failed to fetch ${url} after ${maxRetries} retries`);
}

export interface SearchLegislationRequest {
  legislationCatalogues: string;
  legislationNumber: string;
  selectYear: string[];
}

export interface SearchLegislationRow {
  search_ID: string;
  search_DocumentNumber: string;
  search_IssueGroupID: string;
  search_IssueDate: string;
  search_PublicationDate: string;
  search_Pages: string;
  search_PrimaryLabel: string;
  search_LawID: string;
  search_LawProtocolNumber: string;
  search_Description: string;
  search_Score: string;
}

export interface DocumentEntityByIdRow {
  documententitybyid_DocumentNumber?: string;
  documententitybyid_IssueGroupID?: string;
  documententitybyid_IssueDate?: string;
  documententitybyid_PublicationDate?: string;
  documententitybyid_Pages?: string;
  documententitybyid_PrimaryLabel?: string;
  documententitybyid_ReReleaseDate?: string;
  documententitybyid_topics_ID?: string;
  documententitybyid_topics_Name?: string;
  documententitybyid_subjects_ID?: string;
  documententitybyid_subjects_Value?: string;
}

export async function searchLegislation(
  requestBody: SearchLegislationRequest
): Promise<SearchLegislationRow[]> {
  const result = await request<SearchLegislationRow[]>(
    '/searchlegislation',
    'POST',
    requestBody as unknown as Record<string, unknown>
  );
  if (result.status !== 'ok') {
    throw new Error(`API error for /searchlegislation: ${result.message}`);
  }
  return result.parsedData ?? [];
}

export async function getDocumentEntityById(searchId: string): Promise<DocumentEntityByIdRow[]> {
  const result = await request<DocumentEntityByIdRow[]>(`/documententitybyid/${searchId}`, 'GET');
  if (result.status !== 'ok') {
    throw new Error(`API error for /documententitybyid/${searchId}: ${result.message}`);
  }
  return result.parsedData ?? [];
}
