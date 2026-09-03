# Index Definitions — PULSE

Database: `virtual_engineer`

## Overview

Eight Atlas Search and Vector Search indexes are required across four collections. The first four support the Virtual Engineer diagnostic tools; the second four support the Aftermarket Sales catalog search tools.

## Atlas Vector Search — Automated Embedding

Embeddings are generated and stored by Atlas in `__mdb_internal_search`. Application documents contain **text only**.

### `knowledge_auto_embed_index` on `knowledge_documents`

```json
{
  "name": "knowledge_auto_embed_index",
  "type": "vectorSearch",
  "definition": {
    "fields": [
      {
        "type": "autoEmbed",
        "modality": "text",
        "path": "content",
        "model": "voyage-4"
      },
      { "type": "filter", "path": "type" },
      { "type": "filter", "path": "model_families" },
      { "type": "filter", "path": "subsystem" },
      { "type": "filter", "path": "alarm_codes" }
    ]
  }
}
```

### `service_tickets_auto_embed_index` on `service_tickets`

Requires `searchable_narrative` field (populated by seed script).

```json
{
  "name": "service_tickets_auto_embed_index",
  "type": "vectorSearch",
  "definition": {
    "fields": [
      {
        "type": "autoEmbed",
        "modality": "text",
        "path": "searchable_narrative",
        "model": "voyage-4-lite"
      },
      { "type": "filter", "path": "status" },
      { "type": "filter", "path": "related_alarm_codes" },
      { "type": "filter", "path": "chiller_id" },
      { "type": "filter", "path": "type" }
    ]
  }
}
```

**Query pattern (both indexes):**

```javascript
{
  $vectorSearch: {
    index: "<index_name>",
    path: "<text_field>",
    query: { text: "natural language query here" },
    numCandidates: 100,
    limit: 10,
    filter: { /* optional */ }
  }
}
```

### `knowledge_search` on `knowledge_documents` (lexical, for hybrid search)

```json
{
  "name": "knowledge_search",
  "definition": {
    "mappings": {
      "dynamic": false,
      "fields": {
        "title": { "type": "string", "analyzer": "lucene.english" },
        "content": { "type": "string", "analyzer": "lucene.english" },
        "type": { "type": "token" },
        "model_families": { "type": "token" },
        "subsystem": { "type": "token" },
        "alarm_codes": { "type": "token" }
      }
    }
  }
}
```

## Atlas Search — `service_tickets_search`

```json
{
  "name": "service_tickets_search",
  "definition": {
    "mappings": {
      "dynamic": false,
      "fields": {
        "reported_symptom": { "type": "string", "analyzer": "lucene.english" },
        "work_performed": { "type": "string", "analyzer": "lucene.english" },
        "resolution": { "type": "string", "analyzer": "lucene.english" },
        "root_cause": { "type": "string", "analyzer": "lucene.english" },
        "searchable_narrative": { "type": "string", "analyzer": "lucene.english" },
        "related_alarm_codes": { "type": "token" },
        "status": { "type": "token" },
        "type": { "type": "token" },
        "chiller_id": { "type": "token" },
        "ticket_id": { "type": "token" }
      }
    }
  }
}
```

## B-tree Indexes (created by seed script)

See `scripts/data/seed/load-sample-data.js` → `createIndexes()`.

## Provisioning Steps (Atlas UI)

1. Run `npm run seed:drop` to load all collections including `knowledge_documents`
2. Atlas → Search & Vector Search → Create Search Index on `knowledge_documents`
3. Choose JSON editor, paste `knowledge_auto_embed_index` definition, wait for initial sync
4. Create a second Search Index on `knowledge_documents` for `knowledge_search` (lexical, JSON editor, definition above)
5. Create Search Index on `service_tickets` for `service_tickets_search`
6. Create Vector Search Index on `service_tickets` for `service_tickets_auto_embed_index`
7. Verify all four index statuses are **Active** before demoing search tools

## Provisioning via CLI (alternative to Atlas UI)

`scripts/data/manage-search-indexes.js` checks whether the four indexes above exist and are
`READY`, and can create any that are missing using the Node driver's `createSearchIndex()`
(same index names/definitions as this doc, sourced from `KNOWLEDGE_VECTOR_INDEX`,
`KNOWLEDGE_SEARCH_INDEX`, `TICKETS_VECTOR_INDEX`, `TICKETS_SEARCH_INDEX` if overridden in `.env`).

```bash
npm run indexes:check    # report status only (READY / BUILDING / MISSING)
npm run indexes:create   # create any missing indexes, then poll until READY
```

Requires an Atlas cluster tier that supports driver-based Search Index management (M10+, or
Search Nodes) — not supported on M0/M2/M5 shared tiers or local `mongod`, where you must use the
Atlas UI instead. This does not update definitions on indexes that already exist; delete and
recreate via the Atlas UI if a definition needs to change.

## Hybrid search via `$rankFusion`

`searchManuals`/`searchTroubleshootingGuides`/`searchTechnicalBulletins` and `searchCaseNotes` use the native
[`$rankFusion`](https://www.mongodb.com/docs/manual/reference/operator/aggregation/rankFusion/) aggregation
stage to combine vector and lexical results via Reciprocal Rank Fusion (RRF) — no application-level score
merging and no regex fallback.

**Requirements:** MongoDB 8.0+ on the Atlas cluster. 8.0.x requires an Atlas support case to enable
`$rankFusion`; it is native on 8.1+. Verify cluster version in Atlas UI before provisioning indexes.

If a `$rankFusion` query fails (index missing/not Active), the tool returns `degraded: true` with empty
results and an error message — there is no regex fallback. All relevant indexes (vector + lexical, for
both `knowledge_documents` and `service_tickets`) must be **Active** for non-degraded responses.

## Native reranking via `$rerank`

Knowledge and case search append [`$rerank`](https://www.mongodb.com/docs/vector-search/query/aggregation-stages/rerank/)
after `$rankFusion`. Atlas sends the candidate set to a Voyage reranker (default `rerank-2.5-lite`) and
returns documents ordered by cross-encoder relevance. No new search indexes are required.

Pipeline shape:

```javascript
[
  { $rankFusion: { /* vector + lexical legs, limit = RERANK_CANDIDATES (20) */ } },
  { $addFields: { rrf_score: { $meta: "score" } } },  // snapshot fusion score before $rerank overwrites it
  { $set: { rerank_text: /* title + content + alarms + model + subsystem */ } },
  {
    $rerank: {
      model: "rerank-2.5-lite",
      query: { text: "Prefer passages that apply to model family 30XA, alarm code(s) A1.01.\n\n<user query>" },
      path: "rerank_text",
      numDocsToRerank: 20
    }
  },
  { $addFields: { rerank_score: { $meta: "score" } } },
  { $limit: 10 }
]
```

**Requirements:**

1. Atlas cluster on **MongoDB 8.3+** (Latest version with auto-upgrades).
2. Project Owner enables **Project Settings → Native Reranking: `$rerank` in the Aggregation Pipeline**.
3. `$rerank` cannot sit inside `$rankFusion` input pipelines — it must follow fusion.

If `$rerank` is not enabled or the cluster is below 8.3, search retries without `$rerank` and returns
`degraded: true` with `$rankFusion` order. Set `RERANK_ENABLED=false` to skip `$rerank` entirely.

`$rerank` is billed through Atlas (Voyage token usage). It is not available on Atlas Local or self-managed
deployments. `$rerank` is a Preview feature.

