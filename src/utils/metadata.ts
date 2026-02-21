/**
 * Response metadata utilities for Greek Law MCP.
 */

import type Database from '@ansvar/mcp-sqlite';

export interface ResponseMetadata {
  data_source: string;
  jurisdiction: string;
  disclaimer: string;
  freshness?: string;
}

export interface ToolResponse<T> {
  results: T;
  _metadata: ResponseMetadata;
}

export function generateResponseMetadata(
  db: InstanceType<typeof Database>,
): ResponseMetadata {
  let freshness: string | undefined;
  try {
    const row = db.prepare(
      "SELECT value FROM db_metadata WHERE key = 'built_at'"
    ).get() as { value: string } | undefined;
    if (row) freshness = row.value;
  } catch {
    // Ignore
  }

  return {
    data_source: 'ET / legislation.gr (www.et.gr) — Εθνικό Τυπογραφείο (National Printing Office of Greece)',
    jurisdiction: 'GR',
    disclaimer:
      'This data is sourced from ET / legislation.gr under public domain. ' +
      'The authoritative versions are maintained by Εθνικό Τυπογραφείο (National Printing Office of Greece). ' +
      'Always verify with the official portal (www.et.gr).',
    freshness,
  };
}
