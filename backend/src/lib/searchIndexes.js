/**
 * Startup Atlas Search / Vector Search index check and provisioning.
 *
 * Covers ALL indexes required by the platform — both Virtual Engineer (VE)
 * and Aftermarket Sales Intelligence (AMS). Called once at server startup.
 *
 * Non-blocking: missing indexes are created (async build on Atlas side) and
 * their status is logged. Tools degrade gracefully until indexes are READY.
 *
 * Driver-based Search Index management requires M10+ or Atlas Search Nodes.
 * On M0/M2/M5 shared tiers the create call will fail with a clear warning —
 * provision those indexes manually via the Atlas UI instead.
 */

import { env } from "../config/env.js";

function buildIndexSpecs() {
  return [
    // ── Virtual Engineer — knowledge_documents ──────────────────────────────
    {
      collection: "knowledge_documents",
      name: env.knowledgeVectorIndex,
      type: "vectorSearch",
      definition: {
        fields: [
          { type: "autoEmbed", modality: "text", path: "content", model: "voyage-4" },
          { type: "filter", path: "type" },
          { type: "filter", path: "model_families" },
          { type: "filter", path: "subsystem" },
          { type: "filter", path: "alarm_codes" },
        ],
      },
    },
    {
      collection: "knowledge_documents",
      name: env.knowledgeSearchIndex,
      type: "search",
      definition: {
        mappings: {
          dynamic: false,
          fields: {
            title:         { type: "string", analyzer: "lucene.english" },
            content:       { type: "string", analyzer: "lucene.english" },
            type:          { type: "token" },
            model_families:{ type: "token" },
            subsystem:     { type: "token" },
            alarm_codes:   { type: "token" },
          },
        },
      },
    },

    // ── Virtual Engineer — service_tickets ──────────────────────────────────
    {
      collection: "service_tickets",
      name: env.ticketsVectorIndex,
      type: "vectorSearch",
      definition: {
        fields: [
          { type: "autoEmbed", modality: "text", path: "searchable_narrative", model: "voyage-4-lite" },
          { type: "filter", path: "status" },
          { type: "filter", path: "related_alarm_codes" },
          { type: "filter", path: "chiller_id" },
          { type: "filter", path: "type" },
        ],
      },
    },
    {
      collection: "service_tickets",
      name: env.ticketsSearchIndex,
      type: "search",
      definition: {
        mappings: {
          dynamic: false,
          fields: {
            reported_symptom:     { type: "string", analyzer: "lucene.english" },
            work_performed:       { type: "string", analyzer: "lucene.english" },
            resolution:           { type: "string", analyzer: "lucene.english" },
            root_cause:           { type: "string", analyzer: "lucene.english" },
            searchable_narrative: { type: "string", analyzer: "lucene.english" },
            related_alarm_codes:  { type: "token" },
            status:               { type: "token" },
            type:                 { type: "token" },
            chiller_id:           { type: "token" },
            ticket_id:            { type: "token" },
          },
        },
      },
    },

    // ── AMS — parts_catalog ────────────────────────────────────────────────
    {
      collection: "parts_catalog",
      name: "parts_catalog_search",
      type: "search",
      definition: {
        mappings: {
          dynamic: false,
          fields: {
            description: { type: "string", analyzer: "lucene.english" },
            content:     { type: "string", analyzer: "lucene.english" },
            tags:        { type: "string", analyzer: "lucene.english" },
            part_id:     { type: "token" },
            part_number: { type: "token" },
            category:    { type: "token" },
            compatible_model_families: { type: "token" },
          },
        },
      },
    },
    {
      collection: "parts_catalog",
      name: "parts_catalog_vector_index",
      type: "vectorSearch",
      definition: {
        fields: [
          { type: "autoEmbed", modality: "text", path: "content", model: "voyage-4-lite" },
          { type: "filter", path: "category" },
          { type: "filter", path: "compatible_model_families" },
        ],
      },
    },

    // ── AMS — service_offerings ────────────────────────────────────────────
    {
      collection: "service_offerings",
      name: "service_offerings_search",
      type: "search",
      definition: {
        mappings: {
          dynamic: false,
          fields: {
            name:        { type: "string", analyzer: "lucene.english" },
            description: { type: "string", analyzer: "lucene.english" },
            content:     { type: "string", analyzer: "lucene.english" },
            offering_id: { type: "token" },
            category:    { type: "token" },
            triggers:    { type: "token" },
            applicable_model_families: { type: "token" },
          },
        },
      },
    },
    {
      collection: "service_offerings",
      name: "service_offerings_vector_index",
      type: "vectorSearch",
      definition: {
        fields: [
          { type: "autoEmbed", modality: "text", path: "content", model: "voyage-4-lite" },
          { type: "filter", path: "category" },
          { type: "filter", path: "triggers" },
        ],
      },
    },
  ];
}

/**
 * Check every platform search index. Create any that are missing.
 * Logs status for each index. Never throws — failures are warnings only.
 *
 * @param {import("mongodb").Db} db
 * @returns {Promise<{ name: string, collection: string, status: string }[]>}
 */
export async function ensureSearchIndexes(db) {
  const specs = buildIndexSpecs();
  const results = [];

  for (const spec of specs) {
    const label = `${spec.collection}/${spec.name}`;
    try {
      const existing = await db
        .collection(spec.collection)
        .listSearchIndexes(spec.name)
        .toArray();

      if (existing.length > 0) {
        const idx = existing[0];
        const status = idx.status ?? (idx.queryable ? "READY" : "BUILDING");
        console.log(`  Search index ${label}: ${status}`);
        results.push({ name: spec.name, collection: spec.collection, status });
        continue;
      }

      // Not found — attempt creation
      await db.collection(spec.collection).createSearchIndex({
        name: spec.name,
        type: spec.type,
        definition: spec.definition,
      });
      console.log(`  Search index ${label}: CREATED (building — may take a few minutes)`);
      results.push({ name: spec.name, collection: spec.collection, status: "CREATED" });
    } catch (err) {
      // Shared-tier clusters (M0/M2/M5) do not support driver-based index management.
      // Log a clear warning and continue — provision via Atlas UI manually.
      const hint = err.message?.includes("not supported")
        ? " (shared tier — provision via Atlas UI or upgrade to M10+)"
        : ` — ${err.message}`;
      console.warn(`  Search index ${label}: UNAVAILABLE${hint}`);
      results.push({ name: spec.name, collection: spec.collection, status: "UNAVAILABLE" });
    }
  }

  return results;
}
