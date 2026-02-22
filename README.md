# Greek Law MCP

[![npm](https://img.shields.io/npm/v/@ansvar/greek-law-mcp)](https://www.npmjs.com/package/@ansvar/greek-law-mcp)
[![License](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](LICENSE)
[![CI](https://github.com/Ansvar-Systems/Greek-law-mcp/actions/workflows/ci.yml/badge.svg)](https://github.com/Ansvar-Systems/Greek-law-mcp/actions/workflows/ci.yml)

A Model Context Protocol (MCP) server providing access to Greek legislation from official FEK sources.

Current dataset mode combines:
- country-scope official metadata corpus (21k+ acts via search.et.gr API)
- high-fidelity provision extraction for core target acts from official FEK PDFs (OCR fallback for image-only legacy issues)

To enrich country-scope records with full text incrementally:

```bash
npm run ingest:country-fulltext -- --status-every 200
```

The run is resumable and writes per-document enriched seeds under `data/seed/_country-fulltext/`.
Current deferred OCR/text extraction gaps are tracked in `OCR_GAPS.md` and `gaps/ocr-gaps.json`.

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


---

## Important Disclaimers

### Not Legal Advice

> **THIS TOOL IS NOT LEGAL ADVICE**
>
> Statute text is sourced from official government publications. However:
> - This is a **research tool**, not a substitute for professional legal counsel
> - **Coverage may be incomplete** — verify critical provisions against primary sources
> - **Verify all citations** against the official legal portal before relying on them professionally
> - Laws change — check the `about` tool for database freshness date

### Client Confidentiality

When using the remote endpoint, queries are processed by third-party infrastructure
(Vercel, Claude API). For privileged or confidential legal matters, use the local
npm package or on-premise deployment.

**Before using professionally, read:** [DISCLAIMER.md](DISCLAIMER.md) | [PRIVACY.md](PRIVACY.md)

---

## Open Law

This server is part of **Ansvar Open Law** — free, structured access to legislation
from 70+ jurisdictions worldwide via the Model Context Protocol.

**Browse all jurisdictions ->** [ansvar.eu/open-law](https://ansvar.eu/open-law)

## Ansvar MCP Network

Ansvar Open Law is part of the broader **Ansvar MCP Network** — 80+ servers covering
global legislation, EU/US compliance frameworks, and cybersecurity standards.

| Category | Coverage |
|----------|----------|
| **Legislation** | 70+ jurisdictions worldwide |
| **EU Compliance** | 49 regulations, 2,693 articles |
| **US Compliance** | 15 federal & state regulations |
| **Security Frameworks** | 261 frameworks, 1,451 controls |
| **Cybersecurity** | 200K+ CVEs, STRIDE patterns, sanctions |

**Explore the full network ->** [ansvar.ai/mcp](https://ansvar.ai/mcp)

---

Built by [Ansvar Systems](https://ansvar.eu) | [ansvar.eu/open-law](https://ansvar.eu/open-law)
