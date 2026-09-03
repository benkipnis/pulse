/**
 * Sales Pipeline repository — sales_opportunities and sales_sessions.
 */
import { randomUUID } from "node:crypto";
import { getDb } from "../db/client.js";

/**
 * Create or upsert a sales opportunity.
 */
export async function createSalesOpportunity({
  customerId,
  customersName,
  siteId,
  chillerId,
  scenarioType,
  title,
  evidenceSummary,
  recommendedActions = [],
  estimatedValueUsd = 0,
  priority = "medium",
  repId = "AMS-AGENT",
}) {
  const db = await getDb();
  const opportunityId = `OPP-${Date.now().toString(36).toUpperCase()}`;

  const doc = {
    opportunity_id: opportunityId,
    customer_id: customerId,
    customer_name: customersName,
    site_id: siteId,
    chiller_id: chillerId,
    scenario_type: scenarioType,
    title,
    evidence_summary: evidenceSummary,
    recommended_actions: recommendedActions,
    estimated_value_usd: estimatedValueUsd,
    priority,
    status: "open",
    rep_id: repId,
    rep_reaction: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  await db.collection("sales_opportunities").insertOne(doc);
  const { _id, ...rest } = doc;
  return rest;
}

/**
 * List open opportunities with optional filters.
 */
export async function listOpenOpportunities({
  customerId,
  chillerId,
  scenarioType,
  status = "open",
  limit = 20,
} = {}) {
  const db = await getDb();

  const match = { status };
  if (customerId) match.customer_id = customerId;
  if (chillerId) match.chiller_id = chillerId;
  if (scenarioType) match.scenario_type = scenarioType;

  const opportunities = await db
    .collection("sales_opportunities")
    .find(match)
    .sort({ created_at: -1 })
    .limit(limit)
    .project({ _id: 0 })
    .toArray();

  return opportunities;
}

/**
 * Capture rep reaction to an opportunity (thumbs up/down).
 */
export async function captureRepReaction({ opportunityId, reaction, notes }) {
  const db = await getDb();
  await db.collection("sales_opportunities").updateOne(
    { opportunity_id: opportunityId },
    {
      $set: {
        rep_reaction: reaction,
        rep_notes: notes || null,
        updated_at: new Date().toISOString(),
      },
    }
  );
  return { opportunity_id: opportunityId, reaction, updated: true };
}

/**
 * Start a sales session for a rep.
 */
export async function startSalesSession({ customerId, repId, focus }) {
  const db = await getDb();
  const sessionId = `SALES-${randomUUID().slice(0, 8).toUpperCase()}`;

  const doc = {
    session_id: sessionId,
    customer_id: customerId,
    rep_id: repId || "unknown",
    focus: focus || "fleet_review",
    started_at: new Date().toISOString(),
    trace: [],
  };

  await db.collection("sales_sessions").insertOne(doc);
  const { _id, ...rest } = doc;
  return rest;
}

/**
 * Append a recommendation trace entry to a sales session.
 */
export async function storeSalesRecommendationTrace({
  sessionId,
  sourceDataRefs,
  inferredOutputs,
}) {
  const db = await getDb();
  const traceId = `STRACE-${randomUUID().slice(0, 8).toUpperCase()}`;

  const entry = {
    trace_id: traceId,
    session_id: sessionId,
    source_data_refs: sourceDataRefs,
    inferred_outputs: inferredOutputs,
    created_at: new Date().toISOString(),
  };

  await db.collection("sales_sessions").updateOne(
    { session_id: sessionId },
    { $push: { trace: entry } }
  );

  return entry;
}
