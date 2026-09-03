#!/usr/bin/env node
/**
 * Load Virtual Engineer v2.0 sample data into MongoDB.
 *
 * Includes all original VE data PLUS the 5 new AMS-only collections:
 *   parts_catalog, service_offerings, equipment_topology,
 *   sales_opportunities, sales_sessions
 *
 * Usage:
 *   MONGODB_URI="mongodb+srv://..." node scripts/data/seed/load-sample-data.js
 *   MONGODB_URI="..." node scripts/data/seed/load-sample-data.js --drop
 *
 * Behavior:
 *   - Default (no --drop): upserts VE docs by natural key; skips non-empty collections.
 *     New AMS fields are additive — existing VE data is not broken.
 *   - --drop: drops and recreates all VE + AMS collections before inserting.
 *
 * Environment:
 *   MONGODB_URI  — required connection string
 *   MONGODB_DB   — database name (default: virtual_engineer)
 */

import { config } from "dotenv";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { MongoClient } from "mongodb";
import { generateTelemetry } from "../generate-telemetry.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = join(__dirname, "..", "..", "..");

config({ path: join(ROOT_DIR, ".env") });

const SAMPLES_DIR = join(__dirname, "..", "samples");
const AMS_SAMPLES_DIR = join(SAMPLES_DIR, "ams");

const DB_NAME = process.env.MONGODB_DB || "virtual_engineer";
const DROP = process.argv.includes("--drop");
const REGENERATE_TELEMETRY = !process.argv.includes("--no-regenerate-telemetry");

// ─── VE collections (unchanged from original) ─────────────────────────────────
const VE_COLLECTIONS = [
  "sites",
  "chillers",
  "alarm_definitions",
  "alarm_events",
  "telemetry",
  "service_tickets",
  "knowledge_documents",
];

// ─── AMS-only collections ─────────────────────────────────────────────────────
const AMS_COLLECTIONS = [
  "parts_catalog",
  "service_offerings",
  "equipment_topology",
  "sales_opportunities",
  "sales_sessions",
];

// Natural key per collection for idempotent upserts
const NATURAL_KEY = {
  sites: "site_id",
  chillers: "chiller_id",
  alarm_definitions: "alarm_code",
  alarm_events: "event_id",
  service_tickets: "ticket_id",
  knowledge_documents: "doc_id",
  parts_catalog: "part_id",
  service_offerings: "offering_id",
  equipment_topology: "equipment_id",
  sales_opportunities: "opportunity_id",
  sales_sessions: "session_id",
};

const DATE_FIELDS = {
  alarm_events: ["raised_at", "cleared_at"],
  service_tickets: ["opened_at", "closed_at"],
};

function toDate(value) {
  if (value == null) return null;
  return value instanceof Date ? value : new Date(value);
}

function buildSearchableNarrative(ticket) {
  const sections = [
    ticket.reported_symptom,
    ticket.work_performed,
    ticket.resolution,
    ticket.root_cause,
  ].filter((value) => typeof value === "string" && value.trim().length > 0);
  if (sections.length === 0) return "";
  return sections.join("\n\n");
}

function withSearchableNarrative(ticket) {
  return {
    ...ticket,
    searchable_narrative: ticket.searchable_narrative || buildSearchableNarrative(ticket),
  };
}

function prepareDateFields(docs, fields) {
  return docs.map((doc) => {
    const next = { ...doc };
    for (const field of fields) {
      if (field in next) next[field] = toDate(next[field]);
    }
    return next;
  });
}

function loadJson(filePath) {
  const raw = readFileSync(filePath, "utf8");
  return JSON.parse(raw);
}

function prepareTelemetryDocs(docs) {
  return docs.map((doc) => ({
    ...doc,
    timestamp: doc.timestamp instanceof Date ? doc.timestamp : new Date(doc.timestamp),
  }));
}

function prepareDocsForCollection(name, docs) {
  if (name === "telemetry") return prepareTelemetryDocs(docs);
  if (name === "service_tickets") {
    return docs.map((doc) =>
      withSearchableNarrative(prepareDateFields([doc], DATE_FIELDS.service_tickets)[0])
    );
  }
  if (DATE_FIELDS[name]) return prepareDateFields(docs, DATE_FIELDS[name]);
  return docs;
}

async function ensureTelemetryTimeSeries(db) {
  const existing = await db.listCollections({ name: "telemetry" }).toArray();
  if (existing.length > 0) return;
  await db.createCollection("telemetry", {
    timeseries: {
      timeField: "timestamp",
      metaField: "chiller_id",
      granularity: "minutes",
    },
  });
  console.log("Created time series collection: telemetry");
}

async function upsertCollection(db, name, docs) {
  const key = NATURAL_KEY[name];
  if (!key) {
    // No natural key — just insert
    const result = await db.collection(name).insertMany(docs, { ordered: false });
    return result.insertedCount;
  }

  const ops = docs.map((doc) => ({
    replaceOne: {
      filter: { [key]: doc[key] },
      replacement: doc,
      upsert: true,
    },
  }));

  const result = await db.collection(name).bulkWrite(ops, { ordered: false });
  return (result.upsertedCount || 0) + (result.modifiedCount || 0);
}

async function seedCollection(db, name, docs) {
  if (docs.length === 0) {
    console.log(`  ${name}: (no docs)`);
    return 0;
  }

  const prepared = prepareDocsForCollection(name, docs);

  if (DROP || (await db.collection(name).countDocuments()) === 0) {
    // Fresh insert
    if (name === "telemetry") {
      const result = await db.collection(name).insertMany(prepared);
      return result.insertedCount;
    }
    const result = await db.collection(name).insertMany(prepared, { ordered: false });
    return result.insertedCount;
  }

  // Upsert mode — add new fields without touching existing data
  if (name === "telemetry") {
    // Time-series collections don't support upserts; skip if non-empty
    const count = await db.collection(name).countDocuments();
    console.log(`  ${name}: collection has ${count} docs — skipping (use --drop to replace)`);
    return 0;
  }

  const touched = await upsertCollection(db, name, prepared);
  return touched;
}

async function createVeIndexes(db) {
  await db.collection("sites").createIndex({ site_id: 1 }, { unique: true });

  await db.collection("chillers").createIndex({ chiller_id: 1 }, { unique: true });
  await db.collection("chillers").createIndex({ site_id: 1 });
  await db.collection("chillers").createIndex({ serial_number: 1 });
  await db.collection("chillers").createIndex({ model_family: 1 });
  // AMS-added fields
  await db.collection("chillers").createIndex({ customer_id: 1 });
  await db.collection("chillers").createIndex({ service_contract_expiry: 1 });

  await db.collection("alarm_definitions").createIndex({ alarm_code: 1 }, { unique: true });
  await db.collection("alarm_definitions").createIndex({ model_families: 1, subsystem: 1 });

  await db.collection("alarm_events").createIndex({ chiller_id: 1, status: 1 });
  await db.collection("alarm_events").createIndex({ chiller_id: 1, raised_at: -1 });
  await db.collection("alarm_events").createIndex({ alarm_code: 1 });

  await db.collection("service_tickets").createIndex({ chiller_id: 1, opened_at: -1 });
  await db.collection("service_tickets").createIndex({ status: 1 });
  await db.collection("service_tickets").createIndex({ related_alarm_codes: 1 });

  await db.collection("knowledge_documents").createIndex({ doc_id: 1 }, { unique: true });
  await db.collection("knowledge_documents").createIndex({ type: 1, model_families: 1 });
}

async function createAmsIndexes(db) {
  await db.collection("parts_catalog").createIndex({ part_id: 1 }, { unique: true });
  await db.collection("parts_catalog").createIndex({ category: 1 });
  await db.collection("parts_catalog").createIndex({ compatible_model_families: 1 });

  await db.collection("service_offerings").createIndex({ offering_id: 1 }, { unique: true });
  await db.collection("service_offerings").createIndex({ category: 1 });
  await db.collection("service_offerings").createIndex({ triggers: 1 });

  await db.collection("equipment_topology").createIndex({ equipment_id: 1 }, { unique: true });
  await db.collection("equipment_topology").createIndex({ parent_equipment_id: 1 });
  await db.collection("equipment_topology").createIndex({ equipment_type: 1 });

  await db.collection("sales_opportunities").createIndex({ opportunity_id: 1 }, { unique: true });
  await db.collection("sales_opportunities").createIndex({ customer_id: 1, status: 1 });
  await db.collection("sales_opportunities").createIndex({ chiller_id: 1 });
  await db.collection("sales_opportunities").createIndex({ scenario_type: 1 });
  await db.collection("sales_opportunities").createIndex({ created_at: -1 });

  await db.collection("sales_sessions").createIndex({ session_id: 1 }, { unique: true });
  await db.collection("sales_sessions").createIndex({ customer_id: 1 });
  await db.collection("sales_sessions").createIndex({ rep_id: 1 });
}

async function backfillSearchableNarrative(db) {
  const coll = db.collection("service_tickets");
  const tickets = await coll.find({}).toArray();
  if (tickets.length === 0) return 0;

  const ops = [];
  for (const ticket of tickets) {
    const narrative = buildSearchableNarrative(ticket);
    if (ticket.searchable_narrative !== narrative) {
      ops.push({
        updateOne: {
          filter: { _id: ticket._id },
          update: { $set: { searchable_narrative: narrative } },
        },
      });
    }
  }

  if (ops.length > 0) await coll.bulkWrite(ops);
  return ops.length;
}

async function loadAmsData() {
  const amsFiles = {
    parts_catalog: "parts_catalog.json",
    service_offerings: "service_offerings.json",
    equipment_topology: "equipment_topology.json",
    sales_opportunities: "sales_opportunities.json",
    sales_sessions: "sales_sessions.json",
  };

  // Auto-generate if files don't exist
  const missingFiles = Object.values(amsFiles).filter(
    (f) => !existsSync(join(AMS_SAMPLES_DIR, f))
  );

  if (missingFiles.length > 0) {
    console.log("AMS sample files not found — generating...");
    const { execSync } = await import("node:child_process");
    execSync(`node ${join(__dirname, "..", "generate-sample-ams-data.js")}`, {
      stdio: "inherit",
    });
  }

  const result = {};
  for (const [name, filename] of Object.entries(amsFiles)) {
    result[name] = loadJson(join(AMS_SAMPLES_DIR, filename));
  }
  return result;
}

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error("Error: MONGODB_URI environment variable is required");
    process.exit(1);
  }

  const client = new MongoClient(uri);

  try {
    await client.connect();
    const db = client.db(DB_NAME);
    console.log(`Connected to database: ${DB_NAME}`);
    console.log(`Mode: ${DROP ? "--drop (full re-seed)" : "upsert (additive)"}\n`);

    if (DROP) {
      for (const name of [...VE_COLLECTIONS, ...AMS_COLLECTIONS]) {
        const exists = await db.listCollections({ name }).toArray();
        if (exists.length > 0) {
          await db.collection(name).drop();
          console.log(`Dropped: ${name}`);
        }
      }
    }

    await ensureTelemetryTimeSeries(db);

    // ─── Telemetry (extended: 180d daily + 7d hourly) ─────────────────────────
    let telemetryDocs = null;
    if (REGENERATE_TELEMETRY) {
      telemetryDocs = generateTelemetry({ includeHistorical: true });
      console.log(
        `\nGenerated ${telemetryDocs.length} telemetry docs ` +
          `(${telemetryDocs.filter((d) => d.interval === "1d").length} daily historical + ` +
          `${telemetryDocs.filter((d) => d.interval !== "1d").length} hourly recent)`
      );
    }

    // ─── VE collections ───────────────────────────────────────────────────────
    console.log("\n── VE Collections ──────────────────────────────────────────");
    const veResults = {};
    for (const name of VE_COLLECTIONS) {
      let docs;
      if (name === "telemetry" && telemetryDocs) {
        docs = telemetryDocs;
      } else {
        const filePath = join(SAMPLES_DIR, `${name}.json`);
        docs = existsSync(filePath) ? loadJson(filePath) : [];
      }
      const count = await seedCollection(db, name, docs);
      veResults[name] = count;
      console.log(`  ${name}: ${count}`);
    }

    // ─── AMS collections ─────────────────────────────────────────────────────
    console.log("\n── AMS Collections ─────────────────────────────────────────");
    const amsData = await loadAmsData();
    const amsResults = {};
    for (const name of AMS_COLLECTIONS) {
      const docs = amsData[name] || [];
      const count = await seedCollection(db, name, docs);
      amsResults[name] = count;
      console.log(`  ${name}: ${count}`);
    }

    // ─── Indexes ──────────────────────────────────────────────────────────────
    console.log("\nCreating indexes...");
    await createVeIndexes(db);
    await createAmsIndexes(db);
    console.log("  Indexes: done");

    // ─── Backfill ─────────────────────────────────────────────────────────────
    const narrativeUpdates = await backfillSearchableNarrative(db);
    if (narrativeUpdates > 0) {
      console.log(`  Backfilled searchable_narrative: ${narrativeUpdates} tickets`);
    }

    console.log("\n── Summary ─────────────────────────────────────────────────");
    const all = { ...veResults, ...amsResults };
    for (const [name, count] of Object.entries(all)) {
      console.log(`  ${name}: ${count}`);
    }
    console.log("\nDone. ✓");
  } finally {
    await client.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
