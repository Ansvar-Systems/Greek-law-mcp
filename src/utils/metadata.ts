/**
 * Response metadata utilities for Greek Law MCP.
 *
 * Provides standardised _meta and _citation shapes required by the
 * Ansvar citation pipeline and law-mcp-golden-standard contract tests.
 */

import type Database from '@ansvar/mcp-sqlite';
import type { CitationMetadata } from './citation.js';

export interface ResponseMeta {
  disclaimer: string;
  data_age: string;
  copyright: string;
  source_url?: string;
  [key: string]: unknown;
}

export interface ToolResponse<T> {
  results: T;
  _meta: ResponseMeta;
  _citation?: CitationMetadata;
  _error_type?: string;
}

export function generateResponseMetadata(db: InstanceType<typeof Database>): ResponseMeta {
  let data_age = '';
  try {
    const row = db.prepare("SELECT value FROM db_metadata WHERE key = 'built_at'").get() as
      | { value: string }
      | undefined;
    if (row?.value) {
      data_age = row.value.slice(0, 10); // YYYY-MM-DD
    }
  } catch {
    // db_metadata table may not exist in all tiers
  }

  return {
    disclaimer:
      'This is a research tool, not legal advice. Verify critical citations against official sources.',
    data_age,
    copyright: 'Εθνικό Τυπογραφείο (National Printing Office of Greece)',
    source_url: 'https://www.et.gr',
  };
}

export function generateResearchOnlyMetadata(db: InstanceType<typeof Database>): ResponseMeta {
  return {
    ...generateResponseMetadata(db),
    disclaimer:
      'RESEARCH ONLY — not legal advice. This output requires professional legal review before reliance.',
  };
}
