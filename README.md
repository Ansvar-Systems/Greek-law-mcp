# Greek Law MCP Server

<!-- ANSVAR-CTA-BEGIN -->
> **The Greek law corpus is now served through the Ansvar Gateway.** Connect your AI assistant (Claude, Copilot, Cursor, or any MCP client) to `https://gateway.ansvar.eu/mcp` — one OAuth connection, free tier available, covering this corpus plus EU regulations, national law across 28 audited jurisdictions (Europe + the US), and CVE/security intelligence, every result with a verbatim source citation. Start at https://ansvar.eu/docs/quickstart

### Connect

**Claude Code** (one line):

```bash
claude mcp add ansvar --transport http https://gateway.ansvar.eu/mcp
```

**Claude Desktop / Cursor** — add to `claude_desktop_config.json` (or `mcp.json`):

```json
{
  "mcpServers": {
    "ansvar": {
      "type": "url",
      "url": "https://gateway.ansvar.eu/mcp"
    }
  }
}
```

**Claude.ai** — Settings → Connectors → Add custom connector → paste `https://gateway.ansvar.eu/mcp`

First request opens an OAuth signup flow (setup details: [ansvar.eu/docs/quickstart](https://ansvar.eu/docs/quickstart)). After signup, your client is bound to your account; tier (free / premium / team / company) determines fan-out, quota, and which downstream MCPs are reachable.

---

## Self-host this MCP

You can also clone this repo and build the corpus yourself. The schema,
fetcher, and tool implementations all live here. What is not in the repo is
the pre-built database — TDM and standards-licensing constraints on the
upstream sources mean we host the corpus on Ansvar infrastructure rather
than redistribute it as a public artifact.

Build your own: run this repo's ingestion script (entry-point varies per
repo — typically `scripts/ingest.sh`, `npm run ingest`, or `make ingest`;
check the repo root).
<!-- ANSVAR-CTA-END -->


**The Εθνικό Τυπογραφείο (Government Gazette) alternative for the AI age.**

[![MCP Registry](https://img.shields.io/badge/MCP-Registry-blue)](https://registry.modelcontextprotocol.io)
[![License](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)
[![GitHub stars](https://img.shields.io/github/stars/Ansvar-Systems/Greek-law-mcp?style=social)](https://github.com/Ansvar-Systems/Greek-law-mcp)
[![CI](https://github.com/Ansvar-Systems/Greek-law-mcp/actions/workflows/ci.yml/badge.svg)](https://github.com/Ansvar-Systems/Greek-law-mcp/actions/workflows/ci.yml)
[![Daily Data Check](https://github.com/Ansvar-Systems/Greek-law-mcp/actions/workflows/check-updates.yml/badge.svg)](https://github.com/Ansvar-Systems/Greek-law-mcp/actions/workflows/check-updates.yml)
[![Database](https://img.shields.io/badge/database-pre--built-green)](docs/EU_INTEGRATION_GUIDE.md)
[![Provisions](https://img.shields.io/badge/provisions-7%2C793-blue)](docs/EU_INTEGRATION_GUIDE.md)

Query **21,119 Greek statutes** -- from the Νόμος 4624/2019 (GDPR implementation) and Ποινικός Κώδικας to the Αστικός Κώδικας, κώδικας εταιριών, and more -- directly from Claude, Cursor, or any MCP-compatible client.

If you're building legal tech, compliance tools, or doing Greek legal research, this is your verified reference database.

Built by [Ansvar Systems](https://ansvar.eu) -- Stockholm, Sweden

---

## Why This Exists

Greek legal research is scattered across e-nomothesia.gr, the Εθνικό Τυπογραφείο (National Printing Office), and EUR-Lex. Whether you're:
- A **lawyer** validating citations in a brief or contract
- A **compliance officer** checking if a statute is still in force
- A **legal tech developer** building tools on Greek law
- A **researcher** tracing legislative provisions across 21,119 statutes

...you shouldn't need dozens of browser tabs and manual cross-referencing. Ask Claude. Get the exact provision. With context.

This MCP server makes Greek law **searchable, cross-referenceable, and AI-readable**.

---

## Example Queries

Once connected, just ask naturally:

- *"Αναζήτηση 'προστασία προσωπικών δεδομένων' -- ποιες υποχρεώσεις θεσπίζει ο Ν. 4624/2019;"*
- *"Ισχύει ακόμα ο Ποινικός Κώδικας (Ν. 4619/2019) ως προς το άρθρο 292;"*
- *"Βρες διατάξεις για την εταιρική διακυβέρνηση στον Αστικό Κώδικα"*
- *"Ποιες ευρωπαϊκές οδηγίες ενσωμάτωσε ο νόμος για την κυβερνοασφάλεια;"*
- *"Ποιοι ελληνικοί νόμοι υλοποιούν τον ΓΚΠΔ;"*
- *"Επαλήθευσε παραπομπή: Ν. 4624/2019, άρθ. 5"*
- *"Δημιούργησε νομική θέση για τις υποχρεώσεις γνωστοποίησης παραβίασης δεδομένων"*
- *"Συμμορφώνεται η ελληνική νομοθεσία με τις απαιτήσεις της οδηγίας NIS2;"*

---

## What's Included

| Category | Count | Details |
|----------|-------|---------|
| **Statutes** | 21,119 statutes | Comprehensive Greek legislation from search.et.gr |
| **Provisions** | 7,793 sections | Full-text searchable with FTS5 |
| **EU Cross-References** | Included | Directives and regulations linked to Greek transpositions |
| **Database Size** | 68 MB | Optimized SQLite, portable |
| **Daily Updates** | Automated | Freshness checks against e-nomothesia.gr / et.gr |

**Verified data only** -- every citation is validated against official sources (Εθνικό Τυπογραφείο, e-nomothesia.gr). Zero LLM-generated content.

---

## See It In Action

### Why This Works

**Verbatim Source Text (No LLM Processing):**
- All statute text is ingested from official Greek legal sources (e-nomothesia.gr, et.gr)
- Provisions are returned **unchanged** from SQLite FTS5 database rows
- Zero LLM summarization or paraphrasing -- the database contains statute text, not AI interpretations

**Smart Context Management:**
- Search returns ranked provisions with BM25 scoring (safe for context)
- Provision retrieval gives exact text by statute number + article
- Cross-references help navigate without loading everything at once

**Technical Architecture:**
```
e-nomothesia.gr / et.gr → Parse → SQLite → FTS5 snippet() → MCP response
                            ↑                      ↑
                    Provision parser        Verbatim database query
```

### Traditional Research vs. This MCP

| Traditional Approach | This MCP Server |
|---------------------|-----------------|
| Search e-nomothesia.gr by law number | Search by plain Greek: *"προσωπικά δεδομένα συναίνεση"* |
| Navigate multi-article statutes manually | Get the exact provision with context |
| Manual cross-referencing between laws | `build_legal_stance` aggregates across sources |
| "Is this statute still in force?" → check manually | `check_currency` tool → answer in seconds |
| Find EU basis → dig through EUR-Lex | `get_eu_basis` → linked EU directives instantly |
| Check multiple sites for updates | Daily automated freshness checks |
| No API, no integration | MCP protocol → AI-native |

**Traditional:** Search e-nomothesia.gr → Download ΦΕΚ PDF → Ctrl+F → Cross-reference → Check EUR-Lex for EU basis → Repeat

**This MCP:** *"Ποιο άρθρο του Ν. 4624/2019 ενσωματώνει το άρθρο 9 ΓΚΠΔ για τις ειδικές κατηγορίες;"* → Done.

---

## Available Tools (13)

### Core Legal Research Tools (8)

| Tool | Description |
|------|-------------|
| `search_legislation` | FTS5 full-text search across 7,793 provisions with BM25 ranking |
| `get_provision` | Retrieve specific provision by law number + article reference |
| `validate_citation` | Validate citation against database -- zero-hallucination check |
| `build_legal_stance` | Aggregate citations from multiple statutes for a legal topic |
| `format_citation` | Format citations per Greek conventions (full/short/pinpoint) |
| `check_currency` | Check if statute is in force, amended, or repealed |
| `list_sources` | List all available statutes with metadata and data provenance |
| `about` | Server info, capabilities, dataset statistics, and coverage summary |

### EU Law Integration Tools (5)

| Tool | Description |
|------|-------------|
| `get_eu_basis` | Get EU directives/regulations that underpin a Greek statute |
| `get_greek_implementations` | Find Greek laws implementing a specific EU act |
| `search_eu_implementations` | Search EU documents with Greek implementation counts |
| `get_provision_eu_basis` | Get EU law references for a specific provision |
| `validate_eu_compliance` | Check implementation status of Greek statutes against EU directives |

---

## EU Law Integration

Greece is an EU member state. Greek legislation directly transposes EU directives and implements EU regulations, creating a traceable mapping between Greek and EU law.

Key areas of EU-Greek law alignment:

- **GDPR (2016/679)** -- implemented via Νόμος 4624/2019 (Αρχή Προστασίας Δεδομένων Προσωπικού Χαρακτήρα)
- **NIS2 Directive (2022/2555)** -- transposed into Greek cybersecurity legislation
- **eIDAS Regulation (910/2014)** -- applicable directly; supplemented by Greek electronic identification rules
- **DORA (2022/2554)** -- digital operational resilience for financial sector entities
- **AI Act (2024/1689)** -- EU regulation applicable directly across all member states
- **AML Directives** -- implemented via Greek anti-money laundering legislation (Ν. 4557/2018 and amendments)

The EU bridge tools provide bi-directional lookup: find which Greek statutes implement a given EU act, or find which EU acts underpin a given Greek provision.

| Metric | Value |
|--------|-------|
| **EU Member State** | Since 1981 |
| **Legal System** | Civil law (continental European / Roman law tradition) |
| **Official Gazette** | Φύλλο Εφημερίδας της Κυβερνήσεως -- ΦΕΚ (et.gr) |
| **Legislation Portal** | e-nomothesia.gr |
| **EUR-Lex Integration** | Automated metadata fetching |

See [EU_INTEGRATION_GUIDE.md](docs/EU_INTEGRATION_GUIDE.md) for detailed documentation.

---

## Data Sources & Freshness

All content is sourced from authoritative Greek legal databases:

- **[e-nomothesia.gr](https://e-nomothesia.gr/)** -- Consolidated Greek legislation portal
- **[Εθνικό Τυπογραφείο / et.gr](https://et.gr/)** -- Official Government Gazette (ΦΕΚ -- Φύλλο Εφημερίδας της Κυβερνήσεως)
- **[EUR-Lex](https://eur-lex.europa.eu/)** -- Official EU law database (metadata only)

### Automated Freshness Checks (Daily)

A [daily GitHub Actions workflow](.github/workflows/check-updates.yml) monitors all data sources:

| Source | Check | Method |
|--------|-------|--------|
| **Statute amendments** | e-nomothesia.gr / et.gr comparison | All 21,119 statutes checked |
| **New statutes** | ΦΕΚ publications (90-day window) | Diffed against database |
| **EU reference staleness** | Git commit timestamps | Flagged if >90 days old |

---

## Security

This project uses multiple layers of automated security scanning:

| Scanner | What It Does | Schedule |
|---------|-------------|----------|
| **CodeQL** | Static analysis for security vulnerabilities | Weekly + PRs |
| **Semgrep** | SAST scanning (OWASP top 10, secrets, TypeScript) | Every push |
| **Gitleaks** | Secret detection across git history | Every push |
| **Trivy** | CVE scanning on filesystem and npm dependencies | Daily |
| **Docker Security** | Container image scanning + SBOM generation | Daily |
| **Socket.dev** | Supply chain attack detection | PRs |
| **OSSF Scorecard** | OpenSSF best practices scoring | Weekly |
| **Dependabot** | Automated dependency updates | Weekly |

See [SECURITY.md](SECURITY.md) for the full policy and vulnerability reporting.

---

## Important Disclaimers

### Legal Advice

> **THIS TOOL IS NOT LEGAL ADVICE**
>
> Statute text is sourced from official Greek legal publications (e-nomothesia.gr, ΦΕΚ). However:
> - This is a **research tool**, not a substitute for professional legal counsel
> - **Verify critical citations** against primary sources (ΦΕΚ) for court filings
> - **EU cross-references** are extracted from Greek statute text, not EUR-Lex full text
> - **Always confirm** current in-force status via e-nomothesia.gr before relying on a provision professionally

**Before using professionally, read:** [DISCLAIMER.md](DISCLAIMER.md) | [PRIVACY.md](PRIVACY.md)

### Client Confidentiality

Queries go through the Claude API. For privileged or confidential matters, use on-premise deployment. See [PRIVACY.md](PRIVACY.md) for Δικηγορικός Σύλλογος Αθηνών / Ολομέλεια Δικηγορικών Συλλόγων Ελλάδος compliance guidance.

---

## Documentation

- **[EU Integration Guide](docs/EU_INTEGRATION_GUIDE.md)** -- Detailed EU cross-reference documentation
- **[EU Usage Examples](docs/EU_USAGE_EXAMPLES.md)** -- Practical EU lookup examples
- **[Security Policy](SECURITY.md)** -- Vulnerability reporting and scanning details
- **[Disclaimer](DISCLAIMER.md)** -- Legal disclaimers and professional use notices
- **[Privacy](PRIVACY.md)** -- Client confidentiality and data handling

---

## Development

### Setup

```bash
git clone https://github.com/Ansvar-Systems/Greek-law-mcp
cd Greek-law-mcp
npm install
npm run build
npm test
```

### Running Locally

```bash
npm run dev                                       # Start MCP server
npx @anthropic/mcp-inspector node dist/index.js   # Test with MCP Inspector
```

### Data Management

```bash
npm run ingest              # Ingest statutes from e-nomothesia.gr / et.gr
npm run build:db            # Rebuild SQLite database
npm run check-updates       # Check for amendments and new statutes
```

### Performance

- **Search Speed:** <100ms for most FTS5 queries
- **Database Size:** 68 MB (efficient, portable)
- **Reliability:** 100% ingestion success rate

---

## More Ansvar MCPs

Full fleet coverage at [ansvar.eu/coverage](https://ansvar.eu/coverage).
## Contributing

Contributions welcome! See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

Priority areas:
- Court case law expansion (Άρειος Πάγος, ΣτΕ)
- EU Regulations MCP integration (full EU law text, CJEU case law)
- Historical statute versions and amendment tracking
- Presidential Decrees (Προεδρικά Διατάγματα) expansion

---

## Roadmap

- [x] Core statute database with FTS5 search
- [x] Full corpus ingestion (21,119 statutes, 7,793 provisions)
- [x] EU law integration tools
- [x] Vercel Streamable HTTP deployment

- [x] Daily freshness checks
- [ ] Case law expansion (Άρειος Πάγος, Συμβούλιο της Επικρατείας)
- [ ] Historical statute versions (amendment tracking)
- [ ] Presidential Decrees expansion

---

## Citation

If you use this MCP server in academic research:

```bibtex
@software{greek_law_mcp_2026,
  author = {Ansvar Systems AB},
  title = {Greek Law MCP Server: Production-Grade Legal Research Tool},
  year = {2026},
  url = {https://github.com/Ansvar-Systems/Greek-law-mcp},
  note = {Comprehensive Greek legal database with 21,119 statutes and 7,793 provisions}
}
```

---

## License

Apache License 2.0. See [LICENSE](./LICENSE) for details.

### Data Licenses

Ansvar attribution code: **`Greek-N-2121-1993-Art-2-5`**. Basis:
`Ν. 2121/1993 Άρθρο 2(5)` — broad statutory-PD carve-out via
three-category enumeration plus a catch-all.

- **Statutes & Legislation:** Εθνικό Τυπογραφείο (National Printing
  Office) — FEK archive at `et.gr` / `search.et.gr`. Reused under
  N. 2121/1993 Art. 2(5).
- **EU Metadata:** EUR-Lex (EU public-domain notice).

### Coverage scope (broad)

N. 2121/1993 Art. 2(5) carves out three named categories plus a
catch-all:

- Legislative texts (`νομοθετικά κείμενα`)
- Administrative texts (`διοικητικά κείμενα`)
- Judicial texts (`δικαστικά κείμενα`)
- "...and other texts of official character" — catch-all clause

See `docs/audits/2026-05-17-eu-copyright-statutory-works-batch-2-HU-LU-PT-RO-GR.md`
in the Ansvar architecture-documentation repo for the verbatim Art. 2(5)
text and the coverage analysis.

---

## About Ansvar Systems

We build AI-accelerated compliance and legal research tools for the European market. This MCP server started as our internal reference tool for Greek law -- turns out everyone building for the Greek and SE European markets has the same research frustrations.

So we're open-sourcing it. Navigating 21,119 statutes shouldn't require a law degree.

**[ansvar.eu](https://ansvar.eu)** -- Stockholm, Sweden

---

<p align="center">
  <sub>Built with care in Stockholm, Sweden</sub>
</p>
