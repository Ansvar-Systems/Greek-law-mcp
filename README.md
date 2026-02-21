# Greek Law MCP

[![npm](https://img.shields.io/npm/v/@ansvar/greek-law-mcp)](https://www.npmjs.com/package/@ansvar/greek-law-mcp)
[![License](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](LICENSE)
[![CI](https://github.com/Ansvar-Systems/Greek-law-mcp/actions/workflows/ci.yml/badge.svg)](https://github.com/Ansvar-Systems/Greek-law-mcp/actions/workflows/ci.yml)

A Model Context Protocol (MCP) server providing access to Greek legislation covering data protection, cybersecurity, e-commerce, and criminal law provisions.

Provision text is ingested from official FEK PDFs (metadata API + PDF text extraction, with OCR fallback for image-only legacy issues).

**MCP Registry:** `eu.ansvar/greek-law-mcp`
**npm:** `@ansvar/greek-law-mcp`

## Quick Start

### Claude Desktop / Cursor (stdio)

```json
{
  "mcpServers": {
    "greek-law": {
      "command": "npx",
      "args": ["-y", "@ansvar/greek-law-mcp"]
    }
  }
}
```

### Remote (Streamable HTTP)

```
greek-law-mcp.vercel.app/mcp
```

## Data Sources

| Source | Authority | License |
|--------|-----------|---------|
| [Εθνικό Τυπογραφείο search portal](https://search.et.gr/el/search-legislation/) + [official FEK archive](https://et.gr) | Εθνικό Τυπογραφείο (National Printing Office of Greece) | Government terms (see `sources.yml`) |

> Full provenance: [`sources.yml`](./sources.yml)

## Tools

| Tool | Description |
|------|-------------|
| `search_legislation` | Full-text search across provisions |
| `get_provision` | Retrieve specific article/section |
| `validate_citation` | Validate legal citation |
| `check_currency` | Check if statute is in force |
| `get_eu_basis` | EU legal basis cross-references |
| `get_greek_implementations` | National EU implementations |
| `search_eu_implementations` | Search EU documents |
| `validate_eu_compliance` | EU compliance check |
| `build_legal_stance` | Comprehensive legal research |
| `format_citation` | Citation formatting |
| `list_sources` | Data provenance |
| `about` | Server metadata |

## License

Apache-2.0
