# Agent Instructions — PULSE

This repository is a **runnable dual-demo platform**: one MCP server, two LLM agents, two React UIs, and a shared MongoDB Atlas database. It is not a generic toolkit.

## What's here

| Demo | Port | Description |
|------|------|-------------|
| **Virtual Engineer** | `:5173` | AI-assisted chiller diagnostics for field service engineers |
| **Aftermarket Sales Intelligence** | `:5174` | Proactive sales opportunity identification from fleet telemetry patterns |

Both demos share the **same backend on `:3100`** (36 MCP tools) and the **same `virtual_engineer` database**.

## Repository layout

| Path | Purpose |
|------|---------|
| `backend/src/` | Express server — MCP tools, LLM agents, SSE chat APIs |
| `backend/src/mcp/createServer.js` | 36 MCP tool definitions (20 VE + 16 AMS) |
| `backend/src/agent/orchestrator.js` | VE diagnostic agent |
| `backend/src/agent/sales-orchestrator.js` | Sales intelligence agent |
| `backend/src/repositories/` | MongoDB data access layer |
| `frontend/src/` | Virtual Engineer UI — Overview, Evidence Board, Field Chat |
| `frontend-ams/src/` | Sales Intelligence UI — Fleet Intelligence, Opportunity Builder, Pipeline |
| `scripts/data/` | Sample data, schemas, seed scripts |
| `scripts/data/samples/ams/` | AMS-only sample JSON files |
| `tests/connectivity/` | MCP smoke tests |
| `docs/` | Architecture, runbook, gates, phase status |

## Local Cursor configuration

`.cursor/` (rules and skills) is **gitignored** and kept locally for agent-assisted development. It is not part of the published repository.

## Key workflows

### Run and test

```bash
npm run dev                    # starts backend :3100 + VE UI :5173 + AMS UI :5174
npm run mcp:dev                # backend only
npm run dev:ve                 # VE frontend only (requires backend)
npm run dev:ams                # AMS frontend only (requires backend)
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

- **VE UI:** single-page multi-tab layout in `frontend/src/`. Tabs share `ChatContext` SSE events.
- **AMS UI:** single-page multi-tab layout in `frontend-ams/src/`. Tabs share `SalesContext` SSE events.

## Design principles

1. **Deterministic first** — resolve asset and operational facts before knowledge/case search
2. **Real LLM agent** — no scripted tool sequences in demo paths
3. **Transparency** — surface `query_insight` (pattern, collection, pipeline) in the UI
4. **No customer branding** — use generic OEM terminology in sample data and docs
5. **Additive only** — AMS extensions never break VE demo behavior; all changes are backward compatible

## Compliance artifacts

Maintain `docs/architecture.md` and `docs/runbook.md` as the primary reference docs for this platform.
