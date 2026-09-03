# Architecture — PULSE

## Scope

- **Use case:** Dual-demo platform — agentic field-service diagnostics (Virtual Engineer) + proactive aftermarket sales intelligence (AMS Agent)
- **Workload:** Read-heavy deterministic lookups + hybrid semantic search + time-series trend analysis + graph traversal + session writes
- **Demo audience:** Solutions Architects, technical stakeholders

## Component Map

| Component | Atlas service/product | Responsibility |
|-----------|----------------------|----------------|
| Operational data | Atlas Database | chillers, sites, alarms, telemetry, service_tickets |
| Knowledge retrieval | Atlas Vector Search (autoEmbed) + Atlas Search via `$rankFusion` + Voyage `$rerank` | searchManuals, searchTroubleshootingGuides, searchTechnicalBulletins |
| Case advisory | Atlas Vector Search (autoEmbed) + Atlas Search via `$rankFusion` + Voyage `$rerank` | searchCaseNotes, filterCases |
| Sales catalog search | Atlas Vector Search (autoEmbed) + Atlas Search via `$rankFusion` | searchPartsCatalog, searchServiceOfferings |
| Fleet trend analysis | Atlas Database + `$setWindowFields` | efficiency drift, approach temp trends, pre-fault patterns |
| Equipment graph | Atlas Database + `$graphLookup` | equipment topology traversal, parts bundle expansion |
| Sales pipeline | Atlas Database | sales_opportunities, sales_sessions |
| Session/feedback | Atlas Database | troubleshooting_sessions, recommendation_traces, engineer_feedback |
| MCP server | Node.js + `@modelcontextprotocol/sdk` + Express | HTTP MCP transport, 36 tools (20 VE + 16 AMS) |
| LLM agents | OpenAI, Anthropic, or MongoDB Grove gateway | VE diagnostic loop + sales intelligence loop via MCP HTTP client |
| VE Demo UI | Vite + React (`frontend/`) | Evidence Board + Field Chat, SSE chat consumer |
| AMS Demo UI | Vite + React (`frontend-ams/`) | Fleet Intelligence, Opportunity Builder, Pipeline, SSE sales consumer |

## Non-MongoDB Dependencies

| Dependency | Why needed | Atlas alternative | Decision |
|------------|------------|-------------------|----------|
| `@modelcontextprotocol/sdk` | MCP protocol | None | Required |
| `express` | Streamable HTTP host | None | SDK `createMcpExpressApp` |
| `zod` | Tool input validation | None | Required by MCP SDK |
| OpenAI / Anthropic API | LLM agent reasoning (direct) | None | Required for external demos |
| MongoDB Grove gateway | LLM agent reasoning (internal) | None | Optional; single `MDB_GROVE_API_KEY` proxies to vendor APIs |
| Vite + React | Demo UI | None | Required for Phase 3 UI |
| Voyage AI rerankers (via Atlas `$rerank`) | Cross-encoder rerank of hybrid search candidates | None — billed through Atlas Native Reranking, no separate Voyage API key | Required for knowledge/case precision. Public Preview on MongoDB 8.3+. Default model `rerank-2.5-lite`. |

## Diagram

See plan: Streamable HTTP MCP → repository layer → Atlas collections and search indexes.

## Trade-Offs

- **Latency:** Stateless MCP per-request server instance — simple for POV; production may use session pooling
- **Search:** Atlas Automated Embedding removes embedding pipeline; depends on Atlas Public Preview availability
- **Hybrid search:** `$rankFusion` (Reciprocal Rank Fusion) combines vector + lexical results natively — requires MongoDB 8.0+ on the Atlas cluster (8.0.x needs a support case to enable; native on 8.1+). It is generally available. No application-level score merging or regex fallback is used; if the required indexes are unavailable, tools return `degraded: true` with empty results.
- **Native reranking:** `$rerank` (Voyage cross-encoder) follows `$rankFusion` in the same aggregation. Requires MongoDB 8.3+ and the project setting **Native Reranking: `$rerank` in the Aggregation Pipeline**. Fusion scores are snapshotted as `rrf_score` before `$rerank` overwrites `$meta.score`. If `$rerank` is unavailable, search falls back to `$rankFusion` order with `degraded: true`. No new indexes are required.
- **Auth:** API key bearer token; disabled in local dev via `MCP_AUTH_DISABLED=true`

## Hard Gate Approval

- **Approval:** User — "build it" (2026-07-17); `$rerank` Option A — "move forward with option A" (2026-08-27)
- **Logged in `docs/gates.md`:** Yes (G2/G2b/G3)
