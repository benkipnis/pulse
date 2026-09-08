# Agent Instructions — PULSE

This repository is a **runnable platform**: one MCP server, two LLM agents, one unified React UI, and a shared MongoDB Atlas database. It is not a generic toolkit.

## What's here

| Use Case | UI Section | Port | Description |
|----------|------------|------|-------------|
| **Virtual Engineer** | VE section | `:5174` | AI-assisted chiller diagnostics for field service engineers |
| **Aftermarket Sales Intelligence** | AMS section | `:5174` | Proactive sales opportunity identification from fleet telemetry patterns |
| **Platform** | Platform tab | `:5174` | Architecture story — shared DB, shared MCP, extensibility |

All sections share the **same backend on `:3100`** (36 MCP tools) and the **same `virtual_engineer` database**. The UI lives entirely in `frontend-ams/`.

## Repository layout

| Path | Purpose |
|------|---------|
| `backend/src/` | Express server — MCP tools, LLM agents, SSE chat APIs |
| `backend/src/mcp/createServer.js` | 36 MCP tool definitions (6 shared + 14 VE + 16 AMS) |
| `backend/src/agent/orchestrator.js` | VE diagnostic agent |
| `backend/src/agent/sales-orchestrator.js` | Sales intelligence agent |
| `backend/src/repositories/` | MongoDB data access layer |
| `backend/src/lib/searchIndexes.js` | Centralized Atlas Search index definitions (auto-created on startup) |
| `frontend-ams/src/` | PULSE UI — VE section, AMS section, Platform tab |
| `scripts/data/` | Sample data, schemas, seed scripts |
| `scripts/data/samples/ams/` | AMS-only sample JSON files |
| `tests/connectivity/` | MCP smoke tests |
| `docs/` | Architecture, runbook, gates, phase status |

## Local Cursor configuration

`.cursor/` (rules and skills) is **gitignored** and kept locally for agent-assisted development. It is not part of the published repository.

## Key workflows

### Run and test

```bash
npm run dev                    # starts backend :3100 + PULSE UI :5174
npm run mcp:dev                # backend only
npm run dev:pulse              # PULSE UI only (requires backend)
npm run test:connectivity      # requires backend running on :3100
```

### Data changes

Edit `scripts/data/samples/` (VE) or `scripts/data/samples/ams/` (AMS), then `npm run seed:drop`. See `scripts/data/README.md`.

### Add or change MCP tools

1. Implement repository function in `backend/src/repositories/`
2. Register tool in `backend/src/mcp/createServer.js` with `query_insight` metadata
3. Update `MCP_TOOL_COUNT` constant at top of `createServer.js`
4. Extend smoke tests in `tests/connectivity/`

### UI changes

The PULSE UI is a single-page multi-tab layout in `frontend-ams/src/`. It has two top-level sections (VE, AMS) and a Platform tab, all in one Vite app. VE tabs share `ChatContext` SSE events; AMS tabs share `SalesContext` SSE events.

## Design principles

1. **Deterministic first** — resolve asset and operational facts before knowledge/case search
2. **Real LLM agent** — no scripted tool sequences in demo paths
3. **Transparency** — surface `query_insight` (pattern, collection, pipeline) in the UI
4. **No customer branding** — use generic OEM terminology in sample data and docs
5. **Additive only** — AMS extensions never break VE demo behavior; all changes are backward compatible
6. **Shared tools grow the platform** — reclassify foundational tools as shared when both agents can use them; this demonstrates that new agents require less custom tooling over time

## Compliance artifacts

Maintain `docs/architecture.md` and `docs/runbook.md` as the primary reference docs for this platform.
