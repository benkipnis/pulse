# PULSE — Predictive Unified Lifecycle System for Equipment

A single-backend, dual-demo platform that shows two sides of the same MongoDB Atlas digital twin: **field-service diagnostics** and **aftermarket sales intelligence**. Both demos share one database, one MCP server, and one seed command.

| Demo | Audience | Port | What it answers |
|------|----------|------|-----------------|
| **Virtual Engineer** | Field service engineers | `:5173` | *"What's wrong with this unit?"* |
| **Aftermarket Sales Intelligence** | Sales representatives | `:5174` | *"What can I sell to this customer, and why now?"* |

---

## Platform Architecture

```
Browser — VE UI (:5173)          Browser — AMS UI (:5174)
       │  SSE /api/chat                  │  SSE /api/sales/chat
       └──────────────┬──────────────────┘
                      ▼
          Express Server :3100
          ├── LLM Agent (VE persona)
          ├── LLM Agent (Sales persona)
          └── MCP Server — 36 tools
                 │
                 ▼
          MongoDB Atlas — virtual_engineer DB
          ├── Atlas Database        chillers · sites · alarm_events
          │                         telemetry · service_tickets
          │                         knowledge_documents
          │                         parts_catalog · service_offerings
          │                         equipment_topology · sales_opportunities
          │                         sales_sessions
          ├── Atlas Vector Search   autoEmbed on knowledge docs, service tickets,
          │                         parts catalog, service offerings
          ├── Atlas Text Search     lexical legs for $rankFusion hybrid queries
          ├── Native Reranking      Voyage $rerank after $rankFusion
          ├── Time Series           180-day daily + 7-day hourly telemetry
          ├── $setWindowFields      rolling efficiency & approach-temp trends
          └── $graphLookup          equipment topology + parts bundle traversal
```

Both frontends proxy `/api` → `:3100`. The original `virtual_engineer` repo frontend also connects with zero config change (same port, same endpoint, same tools).

---

## MCP Tool Suite (36 total)

### Virtual Engineer — diagnostic tools (20)

| Category | Tools |
|----------|-------|
| Asset & site | `getChillerById`, `getChillerConfiguration`, `getSiteContext` |
| Alarms | `getActiveAlarms`, `getAlarmHistory`, `getAlarmDetails` |
| Telemetry & state | `getCurrentDeviceState`, `getTelemetry`, `getFaultEvents` |
| Service history | `getServiceHistory`, `getPartsHistory` |
| Knowledge & cases | `searchManuals`, `searchTroubleshootingGuides`, `searchTechnicalBulletins`, `filterCases`, `searchCaseNotes` |
| Session & feedback | `startTroubleshootingSession`, `storeRecommendationTrace`, `captureEngineerReaction`, `captureResolutionOutcome` |

### Aftermarket Sales — sales intelligence tools (16)

| Category | Tools |
|----------|-------|
| Fleet intelligence | `getCustomerFleet`, `getServiceContractStatus`, `getFleetAlarmSummary`, `getFleetCohortAnalysis` |
| Trend analysis | `getUnitEfficiencyTrend`, `getApproachTempTrend`, `scanForPreFaultPatterns` |
| Graph traversal | `getConnectedEquipmentGraph`, `getRelatedPartsBundle` |
| Catalog search | `searchPartsCatalog`, `searchServiceOfferings` |
| Sales pipeline | `createSalesOpportunity`, `listOpenOpportunities`, `captureRepReaction` |
| Session | `startSalesSession`, `storeSalesRecommendationTrace` |

Every tool response includes a `query_insight` object (access pattern, collection, pipeline summary) that both UIs surface in real time.

---

## Atlas Feature Coverage

| Feature | Used by |
|---------|---------|
| Standard Find / CRUD, `$lookup` joins | Both demos |
| Aggregation Pipeline (`$group`, `$match`, `$project`, `$unwind`, `$sort`) | Both demos |
| Atlas Vector Search (autoEmbed) | Knowledge/cases (VE) · parts/services catalog (AMS) |
| Atlas Full-Text Search (Lucene) | `$rankFusion` hybrid legs (VE + AMS) |
| `$rankFusion` Hybrid Search | `searchCaseNotes`, `searchManuals`, catalog searches |
| Native Reranking (`$rerank` via Voyage) | Knowledge + case searches (VE) |
| Time-Series Collections | Shared `telemetry` collection |
| **`$setWindowFields`** | Efficiency drift, condenser approach delta, pre-fault scan (AMS) |
| **`$graphLookup`** | Equipment topology traversal, parts bundle expansion (AMS) |
| `$dateDiff` | Service contract expiry status (AMS) |

---

## Demo Scenarios

### Virtual Engineer

| Unit | Site | Alarm | What it demonstrates |
|------|------|-------|----------------------|
| **CH-ATL-003** | Piedmont Regional Medical Center | `A1.01` Motor Temp | Hero: repeat fault, rising temp trend, prior PTC replacement |
| **CH-DAL-002** | Lone Star Data Center | `207` High Condenser Pressure | Cross-system causal reasoning — VFD + cooling tower |
| **CH-PHX-005** | Intel Ocotillo Campus | `Co.A1` Comm Loss | Degraded-connectivity diagnostic path |
| **CH-ATL-001** | Peachtree Tower | _(none)_ | Stable PM unit — negative control |
| **CH-CHI-004** | Northwestern University | _(none)_ | Cross-case disambiguation from ATL-003 |

### Aftermarket Sales Intelligence

| Scenario | Unit | Pattern | Atlas query |
|----------|------|---------|-------------|
| **Efficiency Drift** | CH-ATL-001 | kW/ton +7.7% over 180 days → refrigerant recharge + coil clean | `$setWindowFields` rolling avg |
| **Pre-Fault Indicator** | CH-CHI-004 | Motor temp +16°F over 90 days → predictive motor assessment | `$setWindowFields` trend slope |
| **Condenser Fouling** | CH-DAL-002 | Approach delta rising +8°F → tube clean / water treatment | `$setWindowFields` delta trend |
| **Contract Expiry** | CH-ATL-003 | Service contract expires Sep 30 — healthcare criticality | `$dateDiff` date math |
| **Lapsed Contract** | CH-PHX-005 | Contract expired Dec 2025 — fab cooling stopped | `$dateDiff` date math |
| **Fleet Cohort Outlier** | CH-DAL-002 | 18% worse efficiency than 2019 install-year peers | `$group + $lookup` cohort |
| **Repeat Part Failure** | CH-ATL-003 | Same PTC sensor failed twice in 8 months → RCA investigation | Service ticket `$group` |

---

## Getting Started

### Prerequisites

- Node.js 20+
- MongoDB Atlas cluster (M10+ recommended for Atlas Search CLI management; M0 works with UI-created indexes)
- MongoDB 8.3+ for Voyage `$rerank`; 8.1+ for `$rankFusion`; any version for deterministic tools
- LLM API key: `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, or `MDB_GROVE_API_KEY`

### 1. Install dependencies

```bash
npm install
npm install --prefix frontend
npm install --prefix frontend-ams
```

### 2. Configure environment

```bash
cp .env.example .env
```

Minimum required:

```bash
MONGODB_URI=mongodb+srv://<user>:<pass>@<cluster>.mongodb.net/
LLM_PROVIDER=openai              # openai | anthropic | grove-openai | grove-anthropic
OPENAI_API_KEY=sk-...
MCP_AUTH_DISABLED=true
```

Full variable reference: [`docs/runbook.md`](docs/runbook.md).

### 3. Seed sample data

```bash
npm run seed:drop
```

Generates 1,710 telemetry docs per run (180-day daily + 7-day hourly per unit), seeds all 12 collections including the 5 new AMS-only collections, and creates all indexes.

### 4. Create Atlas Search + Vector Search indexes

```bash
npm run indexes:check     # reports READY / BUILDING / MISSING for all 8 indexes
npm run indexes:create    # creates missing indexes and polls until READY (M10+ required)
```

Eight indexes across four collections: vector + text on `knowledge_documents`, `service_tickets`, `parts_catalog`, and `service_offerings`.

> Without search indexes, knowledge/catalog tools return `degraded: true` with regex fallback — all deterministic tools continue to work.

### 5. Enable Native Reranking (`$rerank`)

Knowledge and case search tools use Voyage `$rerank` after `$rankFusion` in the same aggregation. Do this once per Atlas project:

1. Confirm cluster is **MongoDB 8.3+**
2. As **Project Owner**, open **Project Settings** → enable **Native Reranking: `$rerank` in the Aggregation Pipeline**

See [`docs/runbook.md`](docs/runbook.md) for full details.

### 6. Start both demos

```bash
npm run dev
```

Starts backend on `:3100`, Virtual Engineer UI on `:5173`, and Sales Intelligence UI on `:5174` concurrently.

Or start individually:

```bash
npm run mcp:dev      # backend only
npm run dev:ve       # VE frontend only (requires backend)
npm run dev:ams      # AMS frontend only (requires backend)
```

### 7. Run connectivity tests

```bash
npm run test:connectivity    # requires backend running on :3100
```

---

## API Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/health` | DB ping + tool count + both chat endpoints |
| `POST` | `/mcp` | MCP JSON-RPC (initialize, tools/call) |
| `GET/DELETE` | `/mcp` | MCP SSE stream / session teardown |
| `POST` | `/api/chat` | VE diagnostic agent (SSE stream) |
| `POST` | `/api/feedback` | VE engineer reaction capture |
| `POST` | `/api/sales/chat` | Sales intelligence agent (SSE stream) |
| `GET` | `/api/sales/fleet` | Fleet overview for a customer |
| `GET` | `/api/sales/contracts` | Contract/warranty expiry status |
| `GET` | `/api/sales/opportunities` | Pipeline opportunities query |
| `POST` | `/api/sales/reaction` | Sales rep thumbs-up/down on MCP-created opportunity |

---

## Database — `virtual_engineer`

### Existing collections (VE baseline + AMS additive fields)

| Collection | AMS additions |
|------------|---------------|
| `chillers` | `rated_efficiency_kwpton`, `rated_capacity_tons`, `service_contract_expiry`, `equipment_id`, `customer_id` |
| `telemetry` | `power_kw`, `cooling_tons`, `ambient_temp_f`, `interval` |
| `service_tickets` | _(no new fields; existing `type` field used)_ |

### New AMS-only collections

| Collection | Docs | Atlas feature |
|------------|------|---------------|
| `parts_catalog` | 18 parts | Atlas Search + Vector Search |
| `service_offerings` | 13 offerings | Atlas Search + Vector Search |
| `equipment_topology` | 46 nodes | `$graphLookup` traversal |
| `sales_opportunities` | 8 seeded | Standard CRUD |
| `sales_sessions` | 2 seeded | Standard CRUD |

---

## Repository Layout

| Path | Purpose |
|------|---------|
| `backend/src/index.js` | Express server — mounts both chat routers + MCP |
| `backend/src/mcp/createServer.js` | All 36 MCP tool definitions |
| `backend/src/agent/orchestrator.js` | VE diagnostic agent loop |
| `backend/src/agent/sales-orchestrator.js` | Sales intelligence agent loop |
| `backend/src/repositories/` | MongoDB data access layer (VE + AMS) |
| `frontend/src/` | Virtual Engineer UI — Overview, Evidence Board, Field Chat |
| `frontend-ams/src/` | Sales Intelligence UI — Fleet, Opportunity Builder, Pipeline |
| `scripts/data/` | Sample data, seed scripts, telemetry generator, index manager |
| `scripts/data/samples/ams/` | AMS-only sample JSON files |
| `tests/connectivity/` | MCP smoke tests |
| `docs/` | Architecture, runbook, gates, phase status |

---

## Data Freshness

Telemetry and alarm timestamps are anchored to `Date.now()` at seed time. Re-run `npm run seed:drop` any time to reset to a fresh baseline. The 180-day historical window for AMS trend analysis is generated fresh on each run.

---

## Connecting the Original VE Frontend

The original `virtual_engineer` repo frontend proxies `/api` → `localhost:3100`. Since this platform also runs on `:3100` with all 20 original VE tools and `/api/chat` preserved exactly:

```bash
# In your original virtual_engineer repo:
npm run dev    # connects to PULSE backend with zero config changes
```
