# Runbook — Virtual Engineer v2.0 + Aftermarket Sales Intelligence

## What this repo is

A single codebase that delivers **two complete AI demos** from one backend, one database, and one seed command:

| Demo | Port | Agent endpoint | Audience |
|------|------|----------------|----------|
| **Virtual Engineer** (VE) | `:5173` | `POST /api/chat` | Field service engineers |
| **Aftermarket Sales Intelligence** (AMS) | `:5174` | `POST /api/sales/chat` | Sales representatives |

Both demos share:
- **MongoDB Atlas** — `virtual_engineer` database
- **Backend MCP server** — 35 tools on `:3100`
- **One seed command** — `npm run seed:drop`

---

## Prerequisites

| Requirement | Notes |
|-------------|-------|
| Node.js 20+ | `node -v` |
| MongoDB Atlas cluster | M10+ for Atlas Search / Vector Search index management |
| LLM API key | OpenAI, Anthropic, or MDB Grove |

---

## 1. Environment Setup

Copy `.env.example` → `.env` and fill in your values:

```bash
cp .env.example .env
```

Key variables:

```
MONGODB_URI=mongodb+srv://...
MONGODB_DB=virtual_engineer

# LLM — choose one provider
LLM_PROVIDER=openai          # openai | anthropic | grove-openai | grove-anthropic
OPENAI_API_KEY=sk-...
# ANTHROPIC_API_KEY=sk-ant-...
# MDB_GROVE_API_KEY=...

MCP_PORT=3100
MCP_AUTH_DISABLED=true       # set false + MCP_API_KEY in production
```

---

## 2. Install Dependencies

```bash
# Root (backend + seed scripts)
npm install

# Virtual Engineer frontend
npm install --prefix frontend

# Aftermarket Sales frontend
npm install --prefix frontend-ams
```

---

## 3. Seed Data

### Full re-seed (recommended first time)

```bash
npm run seed:drop
```

This will:
1. Drop and recreate all VE + AMS collections
2. Upsert 5 chillers (with new AMS fields), 5 sites, alarm definitions, alarm events, service tickets, knowledge documents
3. Generate **1710 telemetry docs** per run:
   - 180 daily docs per chiller (historical window for trend analysis)
   - 168 hourly docs per chiller (recent 7-day window for VE diagnostics)
   - Engineered trends: CH-ATL-001 efficiency drift, CH-CHI-004 motor temp pre-fault, CH-DAL-002 approach temp widening
4. Seed 5 new AMS collections: `parts_catalog` (18 parts), `service_offerings` (13), `equipment_topology` (46 nodes), `sales_opportunities` (8 seeded), `sales_sessions` (2)
5. Create all indexes

### Additive update (if VE is already running against this cluster)

```bash
npm run seed
```

This upserts by natural key — existing VE documents gain the new AMS fields without disrupting VE behavior.

---

## 4. Atlas Search / Vector Search Indexes

Check index status:
```bash
npm run indexes:check
```

Create missing indexes (M10+ required):
```bash
npm run indexes:create
```

### Indexes created

| Collection | Index name | Type |
|------------|-----------|------|
| `knowledge_documents` | `knowledge_auto_embed_index` | vectorSearch (autoEmbed) |
| `knowledge_documents` | `knowledge_search` | search |
| `service_tickets` | `service_tickets_auto_embed_index` | vectorSearch (autoEmbed) |
| `service_tickets` | `service_tickets_search` | search |
| `parts_catalog` | `parts_catalog_search` | search |
| `parts_catalog` | `parts_catalog_vector_index` | vectorSearch (autoEmbed) |
| `service_offerings` | `service_offerings_search` | search |
| `service_offerings` | `service_offerings_vector_index` | vectorSearch (autoEmbed) |

> **Note:** Without Atlas Search indexes, VE and AMS catalog tools fall back gracefully to regex queries.

---

## 5. Running the Demos

### Both demos together (recommended)

```bash
npm run dev
```

Starts three processes concurrently:
- **Backend** (MCP + chat APIs) on `:3100`
- **VE frontend** on `:5173`
- **AMS frontend** on `:5174`

### Individual processes

```bash
npm run mcp:dev      # Backend only
npm run dev:ve       # VE frontend only (requires backend)
npm run dev:ams      # AMS frontend only (requires backend)
```

---

## 6. Port Layout

```
:3100  — Backend MCP server
         POST /mcp                 MCP Streamable HTTP (for external MCP clients)
         POST /api/chat            VE diagnostic chat (SSE)
         POST /api/sales/chat      AMS sales chat (SSE)
         GET  /api/sales/fleet     Fleet overview REST endpoint
         GET  /api/sales/contracts Contract status REST endpoint
         GET  /api/sales/opportunities Pipeline opportunities REST endpoint
         GET  /health              Health check (lists both chat endpoints + tool count)

:5173  — Virtual Engineer UI
         → proxies /api/** to :3100

:5174  — Aftermarket Sales Intelligence UI
         → proxies /api/** to :3100
```

---

## 7. Demo Scenarios

### Virtual Engineer Scenarios

| Unit | Alarm | Description |
|------|-------|-------------|
| CH-ATL-003 | A1.01 | **Hero** — repeat compressor motor temp fault at Piedmont Hospital |
| CH-DAL-002 | 207 | High condenser pressure — Equinix data center |
| CH-PHX-005 | Co.A1 | Communication fault — Intel fab |
| CH-ATL-001 | — | Stable PM unit |

### Aftermarket Sales Scenarios

| Scenario | Unit | Pattern |
|----------|------|---------|
| **Efficiency Drift** | CH-ATL-001 | kW/ton +9% over 180 days → refrigerant recharge + coil clean |
| **Pre-Fault Indicator** | CH-CHI-004 | Motor temp rising +18°F over 90 days → predictive motor assessment |
| **Condenser Fouling** | CH-DAL-002 | Approach delta widening +8°F → tube clean / treatment |
| **Contract Expiry** | CH-ATL-003 | Contract expires Sep 30 (< 30 days) → ServiceEdge renewal |
| **Lapsed Contract** | CH-PHX-005 | Contract expired Dec 2025 (9 months ago) |
| **Fleet Cohort Outlier** | CH-DAL-002 | 18% worse kW/ton than 2019 install-year peers |
| **Repeat Part Failure** | CH-ATL-003 | PTC sensor replaced Nov 2025 → repeat Jul 2026 → RCA |

---

## 8. MongoDB Atlas Features Used

| Feature | Where |
|---------|-------|
| Standard Find / CRUD | All repositories |
| Aggregation Pipeline `$group $match $lookup $project $unwind $sort` | fleet.js, serviceTickets.js |
| `$setWindowFields` | `getUnitEfficiencyTrend`, `getApproachTempTrend`, `scanForPreFaultPatterns` |
| `$graphLookup` | `getConnectedEquipmentGraph`, `getRelatedPartsBundle` |
| `$dateDiff` | `getServiceContractStatus` (days_until_expiry) |
| Atlas Vector Search (autoEmbed) | `searchKnowledge`, `searchCaseNotesHybrid` |
| Atlas Full-Text Search (Lucene) | `searchManuals`, `searchCaseNotes`, `searchPartsCatalog`, `searchServiceOfferings` |
| `$rankFusion` (hybrid) | `searchKnowledge`, `searchCaseNotesHybrid` |
| Voyage `$rerank` | VE knowledge + case search |
| Time-Series Collections | `telemetry` collection |

---

## 9. Connecting the Original VE Frontend to This Backend

The original `virtual_engineer` frontend proxies `/api` → `localhost:3100`. Since this repo also runs on `:3100` with all 20 original tools and `/api/chat` unchanged, you can point any existing VE frontend at this backend with **zero config changes**.

```bash
# In your original virtual_engineer repo:
npm run dev   # will connect to this repo's backend on :3100
```

---

## 10. Troubleshooting

**`Cannot connect to MongoDB` on startup:**
- Verify `MONGODB_URI` in `.env`
- Run `node tests/connectivity/` for diagnostics

**`Atlas Search index not found` / search tools return no results:**
- Run `npm run indexes:check` to see index status
- Create with `npm run indexes:create` (requires M10+ or Atlas Search Nodes)
- M0/M2/M5 shared tiers: use the Atlas UI to create indexes manually

**Telemetry `$setWindowFields` tools return empty:**
- Telemetry must have `power_kw` and `cooling_tons` fields — run `npm run seed:drop` to regenerate with the extended generator

**`concurrently` not found:**
- Run `npm install` at the repo root (it's in devDependencies)
