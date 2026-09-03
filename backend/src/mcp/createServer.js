import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  getChillerById,
  getSiteContextForChiller,
} from "../repositories/chillers.js";
import {
  getActiveAlarms,
  getAlarmHistory,
  getAlarmDefinition,
} from "../repositories/alarms.js";
import { getLatestTelemetry, getTelemetryWindow } from "../repositories/telemetry.js";
import {
  filterCases,
  getPartsHistory,
  getServiceHistory,
  searchCaseNotesHybrid,
} from "../repositories/serviceTickets.js";
import { searchKnowledge } from "../repositories/knowledge.js";
import {
  captureEngineerReaction,
  captureResolutionOutcome,
  startSession,
  storeRecommendationTrace,
} from "../repositories/sessions.js";
import {
  getCustomerFleet,
  getUnitEfficiencyTrend,
  getApproachTempTrend,
  scanForPreFaultPatterns,
  getFleetCohortAnalysis,
  getFleetAlarmSummary,
  getServiceContractStatus,
} from "../repositories/fleet.js";
import { searchPartsCatalog, searchServiceOfferings } from "../repositories/catalog.js";
import { getConnectedEquipmentGraph, getRelatedPartsBundle } from "../repositories/graph.js";
import {
  createSalesOpportunity,
  listOpenOpportunities,
  captureRepReaction,
  startSalesSession,
  storeSalesRecommendationTrace,
} from "../repositories/salesPipeline.js";
import { rerankInsightMeta } from "../lib/rerank.js";
import { asMcpText, toolDegraded, toolNotConfigured, toolNotFound, toolOk } from "../lib/response.js";
import {
  insightForActiveAlarms,
  insightForAlarmDefinition,
  insightForAlarmHistory,
  insightForCaseSearch,
  insightForChillerById,
  insightForFilterCases,
  insightForKnowledgeSearch,
  insightForLatestTelemetry,
  insightForNotConfigured,
  insightForPartsHistory,
  insightForServiceHistory,
  insightForSessionWrite,
  insightForSiteContext,
  insightForTelemetryWindow,
} from "../lib/queryInsight.js";

export const MCP_TOOL_COUNT = 36; // 20 VE + 16 AMS

async function tryKnowledgeSearch(query, type, filters) {
  const intendedRerank = rerankInsightMeta();
  try {
    const { results, rerankApplied, rerankError } = await searchKnowledge({ query, type, filters });
    const scoreDetails = results[0]?.score_details?.details || null;
    const insight = insightForKnowledgeSearch(
      query,
      type,
      filters,
      scoreDetails,
      rerankApplied ? intendedRerank : null
    );
    const refs = results.map((r) => ({ collection: "knowledge_documents", id: r.doc_id }));
    if (rerankError) {
      return toolDegraded(
        { results, type },
        `Voyage $rerank unavailable; returning $rankFusion order. ${rerankError}`,
        refs,
        { query_insight: insight }
      );
    }
    if (results.length > 0) {
      return toolOk({ results, type }, refs, { query_insight: insight });
    }
    return toolDegraded({ results: [], type }, "No knowledge matches found", [], {
      query_insight: insight,
    });
  } catch (err) {
    return toolDegraded(
      { results: [], type },
      `Hybrid search unavailable: ${err.message}`,
      [],
      { query_insight: insightForKnowledgeSearch(query, type, filters, null, intendedRerank) }
    );
  }
}

async function tryCaseSearch(query, filters) {
  const intendedRerank = rerankInsightMeta();
  try {
    const { results, rerankApplied, rerankError } = await searchCaseNotesHybrid(query, filters);
    const scoreDetails = results[0]?.score_details?.details || null;
    const insight = insightForCaseSearch(
      query,
      filters,
      scoreDetails,
      rerankApplied ? intendedRerank : null
    );
    if (rerankError) {
      return toolDegraded(
        { results },
        `Voyage $rerank unavailable; returning $rankFusion order. ${rerankError}`,
        [],
        { query_insight: insight }
      );
    }
    if (results.length > 0) {
      return toolOk({ results }, [], { query_insight: insight });
    }
    return toolDegraded({ results: [] }, "No similar cases found", [], {
      query_insight: insight,
    });
  } catch (err) {
    return toolDegraded(
      { results: [] },
      `Hybrid search unavailable: ${err.message}`,
      [],
      { query_insight: insightForCaseSearch(query, filters, null, intendedRerank) }
    );
  }
}

const filtersSchema = z
  .object({
    model_family: z.string().optional(),
    subsystem: z.string().optional(),
    alarm_codes: z.array(z.string()).optional(),
  })
  .optional();

export function createMcpServer() {
  const server = new McpServer({
    name: "virtual-engineer",
    version: "0.1.0",
  });

  server.registerTool(
    "getChillerById",
    {
      description: "Resolve exact chiller asset record by chiller_id",
      inputSchema: { chiller_id: z.string() },
    },
    async ({ chiller_id }) => {
      const chiller = await getChillerById(chiller_id);
      if (!chiller) {
        return asMcpText(
          toolNotFound(`Chiller ${chiller_id} not found`, {
            query_insight: insightForChillerById(chiller_id),
          })
        );
      }
      return asMcpText(
        toolOk(chiller, [{ collection: "chillers", id: chiller_id }], {
          query_insight: insightForChillerById(chiller_id),
        })
      );
    }
  );

  server.registerTool(
    "getChillerConfiguration",
    {
      description: "Get chiller configuration subset for a unit",
      inputSchema: { chiller_id: z.string() },
    },
    async ({ chiller_id }) => {
      const chiller = await getChillerById(chiller_id);
      if (!chiller) {
        return asMcpText(
          toolNotFound(`Chiller ${chiller_id} not found`, {
            query_insight: insightForChillerById(chiller_id),
          })
        );
      }
      const data = {
        chiller_id: chiller.chiller_id,
        model_family: chiller.model_family,
        model_number: chiller.model_number,
        product_line: chiller.product_line,
        configuration: chiller.configuration,
        current_setpoints: chiller.current_setpoints,
        firmware_version: chiller.firmware_version,
      };
      return asMcpText(
        toolOk(data, [{ collection: "chillers", id: chiller_id }], {
          query_insight: insightForChillerById(chiller_id),
        })
      );
    }
  );

  server.registerTool(
    "getSiteContext",
    {
      description: "Get installation site context for a chiller",
      inputSchema: { chiller_id: z.string() },
    },
    async ({ chiller_id }) => {
      const { chiller, site } = await getSiteContextForChiller(chiller_id);
      if (!chiller) {
        return asMcpText(
          toolNotFound(`Chiller ${chiller_id} not found`, {
            query_insight: insightForSiteContext(chiller_id),
          })
        );
      }
      const refs = [{ collection: "chillers", id: chiller_id }];
      if (site) refs.push({ collection: "sites", id: site.site_id });
      return asMcpText(
        toolOk({ chiller, site }, refs, { query_insight: insightForSiteContext(chiller_id) })
      );
    }
  );

  server.registerTool(
    "getActiveAlarms",
    {
      description: "Get active alarms for a chiller enriched with alarm definitions",
      inputSchema: { chiller_id: z.string() },
    },
    async ({ chiller_id }) => {
      const alarms = await getActiveAlarms(chiller_id);
      return asMcpText(
        toolOk(
          { alarms },
          alarms.map((a) => ({ collection: "alarm_events", id: a.event_id })),
          { query_insight: insightForActiveAlarms(chiller_id) }
        )
      );
    }
  );

  server.registerTool(
    "getAlarmHistory",
    {
      description: "Get alarm history for a chiller within lookback window",
      inputSchema: {
        chiller_id: z.string(),
        lookback_hours: z.number().optional().default(168),
      },
    },
    async ({ chiller_id, lookback_hours }) => {
      const alarms = await getAlarmHistory(chiller_id, lookback_hours);
      return asMcpText(
        toolOk(
          { alarms, lookback_hours },
          alarms.map((a) => ({ collection: "alarm_events", id: a.event_id })),
          { query_insight: insightForAlarmHistory(chiller_id, lookback_hours) }
        )
      );
    }
  );

  server.registerTool(
    "getAlarmDetails",
    {
      description: "Get alarm reference definition by alarm_code",
      inputSchema: { alarm_code: z.string() },
    },
    async ({ alarm_code }) => {
      const def = await getAlarmDefinition(alarm_code);
      if (!def) {
        return asMcpText(
          toolNotFound(`Alarm code ${alarm_code} not found`, {
            query_insight: insightForAlarmDefinition(alarm_code),
          })
        );
      }
      return asMcpText(
        toolOk(def, [{ collection: "alarm_definitions", id: alarm_code }], {
          query_insight: insightForAlarmDefinition(alarm_code),
        })
      );
    }
  );

  server.registerTool(
    "getCurrentDeviceState",
    {
      description: "Get current operating state snapshot for a chiller",
      inputSchema: { chiller_id: z.string() },
    },
    async ({ chiller_id }) => {
      const chiller = await getChillerById(chiller_id);
      if (!chiller) {
        return asMcpText(
          toolNotFound(`Chiller ${chiller_id} not found`, {
            query_insight: insightForChillerById(chiller_id),
          })
        );
      }
      const latest = await getLatestTelemetry(chiller_id);
      return asMcpText(
        toolOk(
          {
            chiller_id,
            operating_status: chiller.operating_status,
            connectivity: chiller.connectivity,
            current_setpoints: chiller.current_setpoints,
            latest_telemetry: latest,
          },
          [{ collection: "chillers", id: chiller_id }],
          { query_insight: insightForLatestTelemetry(chiller_id) }
        )
      );
    }
  );

  server.registerTool(
    "getTelemetry",
    {
      description: "Get telemetry readings for a chiller within a time window",
      inputSchema: {
        chiller_id: z.string(),
        start_time: z.string(),
        end_time: z.string(),
      },
    },
    async ({ chiller_id, start_time, end_time }) => {
      const readings = await getTelemetryWindow(chiller_id, start_time, end_time);
      return asMcpText(
        toolOk(
          { readings, start_time, end_time, count: readings.length },
          readings.map((r) => ({ collection: "telemetry", id: `${chiller_id}:${r.timestamp}` })),
          { query_insight: insightForTelemetryWindow(chiller_id, start_time, end_time) }
        )
      );
    }
  );

  server.registerTool(
    "getServiceHistory",
    {
      description: "Get service ticket history for a chiller",
      inputSchema: {
        chiller_id: z.string(),
        limit: z.number().optional().default(20),
      },
    },
    async ({ chiller_id, limit }) => {
      const tickets = await getServiceHistory(chiller_id, limit);
      return asMcpText(
        toolOk(
          { tickets },
          tickets.map((t) => ({ collection: "service_tickets", id: t.ticket_id })),
          { query_insight: insightForServiceHistory(chiller_id) }
        )
      );
    }
  );

  server.registerTool(
    "getPartsHistory",
    {
      description: "Get aggregated parts replacement history for a chiller",
      inputSchema: { chiller_id: z.string() },
    },
    async ({ chiller_id }) => {
      const parts = await getPartsHistory(chiller_id);
      return asMcpText(
        toolOk({ parts }, [], { query_insight: insightForPartsHistory(chiller_id) })
      );
    }
  );

  server.registerTool(
    "getFaultEvents",
    {
      description: "Get fault events for a chiller (stub until fault_events collection exists)",
      inputSchema: {
        chiller_id: z.string(),
        start_time: z.string().optional(),
        end_time: z.string().optional(),
      },
    },
    async () => {
      return asMcpText(
        toolNotConfigured(
          "fault_events collection not yet provisioned. Planned fields: event_id, chiller_id, event_type, severity, timestamp, description",
          { query_insight: insightForNotConfigured("fault_events") }
        )
      );
    }
  );

  const registerKnowledgeTool = (name, type, description) => {
    server.registerTool(
      name,
      {
        description,
        inputSchema: {
          query: z.string(),
          filters: filtersSchema,
        },
      },
      async ({ query, filters }) => asMcpText(await tryKnowledgeSearch(query, type, filters || {}))
    );
  };

  registerKnowledgeTool(
    "searchManuals",
    "manual",
    "Hybrid search product manuals ($rankFusion vector + lexical, then Voyage $rerank). Pass filters.model_family, filters.subsystem, and filters.alarm_codes when known — they prefilter recall and instruct the reranker."
  );
  registerKnowledgeTool(
    "searchTroubleshootingGuides",
    "troubleshooting_guide",
    "Hybrid search troubleshooting guides ($rankFusion then Voyage $rerank). Pass model/alarm/subsystem filters when known."
  );
  registerKnowledgeTool(
    "searchTechnicalBulletins",
    "technical_bulletin",
    "Hybrid search technical bulletins ($rankFusion then Voyage $rerank). Pass model/alarm/subsystem filters when known."
  );

  server.registerTool(
    "filterCases",
    {
      description: "Deterministically filter prior service cases",
      inputSchema: {
        product_family: z.string().optional(),
        alarm_category: z.string().optional(),
        status: z.string().optional(),
        limit: z.number().optional().default(20),
      },
    },
    async ({ product_family, alarm_category, status, limit }) => {
      const cases = await filterCases({
        productFamily: product_family,
        alarmCategory: alarm_category,
        status,
        limit,
      });
      return asMcpText(
        toolOk(
          { cases },
          cases.map((c) => ({ collection: "service_tickets", id: c.ticket_id })),
          {
            query_insight: insightForFilterCases({
              productFamily: product_family,
              alarmCategory: alarm_category,
              status,
            }),
          }
        )
      );
    }
  );

  server.registerTool(
    "searchCaseNotes",
    {
      description: "Hybrid case note search ($rankFusion vector + lexical, then Voyage $rerank). Pass related_alarm_codes in filters when known.",
      inputSchema: {
        query: z.string(),
        filters: z
          .object({
            status: z.string().optional(),
            chiller_id: z.string().optional(),
            related_alarm_codes: z.array(z.string()).optional(),
          })
          .optional(),
      },
    },
    async ({ query, filters }) => asMcpText(await tryCaseSearch(query, filters || {}))
  );

  server.registerTool(
    "startTroubleshootingSession",
    {
      description: "Start a troubleshooting session for a chiller",
      inputSchema: {
        chiller_id: z.string(),
        user_id: z.string(),
        problem_context: z.string().optional(),
      },
    },
    async ({ chiller_id, user_id, problem_context }) => {
      const session = await startSession({
        chillerId: chiller_id,
        userId: user_id,
        problemContext: problem_context,
      });
      return asMcpText(
        toolOk(session, [{ collection: "troubleshooting_sessions", id: session.session_id }], {
          query_insight: insightForSessionWrite("troubleshooting_sessions", "insertOne"),
        })
      );
    }
  );

  server.registerTool(
    "storeRecommendationTrace",
    {
      description: "Store recommendation trace with source evidence refs",
      inputSchema: {
        session_id: z.string(),
        source_data_refs: z.array(z.record(z.string())),
        inferred_outputs: z.record(z.unknown()),
      },
    },
    async ({ session_id, source_data_refs, inferred_outputs }) => {
      const trace = await storeRecommendationTrace({
        sessionId: session_id,
        sourceDataRefs: source_data_refs,
        inferredOutputs: inferred_outputs,
      });
      return asMcpText(
        toolOk(trace, [{ collection: "recommendation_traces", id: trace.trace_id }], {
          query_insight: insightForSessionWrite("recommendation_traces", "insertOne"),
        })
      );
    }
  );

  server.registerTool(
    "captureEngineerReaction",
    {
      description: "Capture engineer positive/negative reaction to a recommendation",
      inputSchema: {
        session_id: z.string(),
        signal: z.enum(["positive", "negative"]),
        notes: z.string().optional(),
      },
    },
    async ({ session_id, signal, notes }) => {
      const feedback = await captureEngineerReaction({ sessionId: session_id, signal, notes });
      return asMcpText(
        toolOk(feedback, [{ collection: "engineer_feedback", id: feedback.feedback_id }], {
          query_insight: insightForSessionWrite("engineer_feedback", "insertOne"),
        })
      );
    }
  );

  server.registerTool(
    "captureResolutionOutcome",
    {
      description: "Capture final diagnosis and resolution for a session",
      inputSchema: {
        session_id: z.string(),
        diagnosis: z.string(),
        repair_notes: z.string(),
        resolution: z.string(),
      },
    },
    async ({ session_id, diagnosis, repair_notes, resolution }) => {
      const feedback = await captureResolutionOutcome({
        sessionId: session_id,
        diagnosis,
        repairNotes: repair_notes,
        resolution,
      });
      return asMcpText(
        toolOk(feedback, [{ collection: "engineer_feedback", id: feedback.feedback_id }], {
          query_insight: insightForSessionWrite("engineer_feedback", "insertOne"),
        })
      );
    }
  );

  // ─── AMS Tools ────────────────────────────────────────────────────────────

  server.registerTool(
    "getCustomerFleet",
    {
      description: "Get all chiller units for a customer or site, enriched with site info and AMS fields (install date, rated efficiency, service contract expiry)",
      inputSchema: {
        customer_id: z.string().optional(),
        site_id: z.string().optional(),
      },
    },
    async ({ customer_id, site_id }) => {
      const fleet = await getCustomerFleet({ customerId: customer_id, siteId: site_id });
      return asMcpText(
        toolOk(
          { fleet, count: fleet.length },
          fleet.map((u) => ({ collection: "chillers", id: u.chiller_id })),
          { query_insight: { operation: "$aggregate", collection: "chillers", note: "fleet overview with $lookup on sites" } }
        )
      );
    }
  );

  server.registerTool(
    "getServiceContractStatus",
    {
      description: "Get service contract / warranty expiry status for a unit or customer's full fleet. Returns contract_status: expired | expiring_soon | active and days_until_expiry.",
      inputSchema: {
        chiller_id: z.string().optional(),
        customer_id: z.string().optional(),
      },
    },
    async ({ chiller_id, customer_id }) => {
      const units = await getServiceContractStatus({ chillerId: chiller_id, customerId: customer_id });
      return asMcpText(
        toolOk(
          { units, count: units.length },
          units.map((u) => ({ collection: "chillers", id: u.chiller_id })),
          { query_insight: { operation: "$aggregate", collection: "chillers", note: "$addFields with $dateDiff for contract_status and days_until_expiry" } }
        )
      );
    }
  );

  server.registerTool(
    "getUnitEfficiencyTrend",
    {
      description: "Compute rolling efficiency (kW/ton) trend for a unit over a lookback window using $setWindowFields. Returns per-day readings with rolling average and overall drift_pct.",
      inputSchema: {
        chiller_id: z.string(),
        lookback_days: z.number().optional().default(90),
      },
    },
    async ({ chiller_id, lookback_days }) => {
      const trend = await getUnitEfficiencyTrend({ chillerId: chiller_id, lookbackDays: lookback_days });
      return asMcpText(
        toolOk(
          trend,
          [{ collection: "telemetry", id: chiller_id }],
          { query_insight: { operation: "$aggregate + $setWindowFields", collection: "telemetry", note: "15-point rolling avg efficiency; drift_pct = (avg_last - avg_first) / avg_first" } }
        )
      );
    }
  );

  server.registerTool(
    "getApproachTempTrend",
    {
      description: "Compute condenser approach temperature trend (condensing_temp - ambient_temp) using $setWindowFields. Rising approach_delta_f indicates condenser fouling or scaling.",
      inputSchema: {
        chiller_id: z.string(),
        lookback_days: z.number().optional().default(90),
      },
    },
    async ({ chiller_id, lookback_days }) => {
      const trend = await getApproachTempTrend({ chillerId: chiller_id, lookbackDays: lookback_days });
      return asMcpText(
        toolOk(
          trend,
          [{ collection: "telemetry", id: chiller_id }],
          { query_insight: { operation: "$aggregate + $setWindowFields", collection: "telemetry", note: "7-point rolling avg approach delta; approach_drift_f = recent - early average" } }
        )
      );
    }
  );

  server.registerTool(
    "scanForPreFaultPatterns",
    {
      description: "Scan one or all fleet units for pre-fault leading indicators using $setWindowFields: sustained high motor/bearing temps, rising discharge pressure. Returns flag_count per unit.",
      inputSchema: {
        chiller_id: z.string().optional(),
        lookback_days: z.number().optional().default(60),
      },
    },
    async ({ chiller_id, lookback_days }) => {
      const patterns = await scanForPreFaultPatterns({ chillerId: chiller_id, lookbackDays: lookback_days });
      const flagged = patterns.filter((p) => p.flag_count > 0);
      return asMcpText(
        toolOk(
          { patterns, flagged_units: flagged.length },
          patterns.map((p) => ({ collection: "telemetry", id: p.chiller_id })),
          { query_insight: { operation: "$aggregate + $setWindowFields + $group", collection: "telemetry", note: "rolling 7-point avg motor/bearing temp; flags: motor>168°F, bearing>120°F, discharge>185psi" } }
        )
      );
    }
  );

  server.registerTool(
    "getFleetAlarmSummary",
    {
      description: "Get alarm count summary per unit for a customer fleet over a lookback window. Groups by severity.",
      inputSchema: {
        customer_id: z.string(),
        lookback_days: z.number().optional().default(30),
      },
    },
    async ({ customer_id, lookback_days }) => {
      const summary = await getFleetAlarmSummary({ customerId: customer_id, lookbackDays: lookback_days });
      return asMcpText(
        toolOk(
          { summary, count: summary.length },
          summary.map((s) => ({ collection: "alarm_events", id: s.chiller_id })),
          { query_insight: { operation: "$aggregate $group", collection: "alarm_events", note: "group by chiller_id + severity; $lookup on chillers for customer filter" } }
        )
      );
    }
  );

  server.registerTool(
    "getFleetCohortAnalysis",
    {
      description: "Compare a unit's 30-day average efficiency to same install-year cohort peers using $group + $lookup. Returns percentile rank and cohort members.",
      inputSchema: { chiller_id: z.string() },
    },
    async ({ chiller_id }) => {
      const analysis = await getFleetCohortAnalysis({ chillerId: chiller_id });
      if (!analysis) {
        return asMcpText(toolNotFound(`Chiller ${chiller_id} not found`));
      }
      return asMcpText(
        toolOk(
          analysis,
          [{ collection: "chillers", id: chiller_id }],
          { query_insight: { operation: "$aggregate $group $lookup", collection: "telemetry + chillers", note: "avg kW/ton per unit over 30 days; $lookup for install year; rank within install_year cohort" } }
        )
      );
    }
  );

  server.registerTool(
    "getConnectedEquipmentGraph",
    {
      description: "Traverse equipment topology graph from a root equipment_id using $graphLookup. Returns root node + all descendant subsystems (compressors, heat exchangers, VFDs, etc.).",
      inputSchema: {
        equipment_id: z.string(),
        max_depth: z.number().optional().default(4),
      },
    },
    async ({ equipment_id, max_depth }) => {
      const graph = await getConnectedEquipmentGraph({ equipmentId: equipment_id, maxDepth: max_depth });
      if (!graph) {
        return asMcpText(toolNotFound(`Equipment ${equipment_id} not found in topology graph`));
      }
      return asMcpText(
        toolOk(
          graph,
          [{ collection: "equipment_topology", id: equipment_id }],
          { query_insight: { operation: "$graphLookup", collection: "equipment_topology", note: "recursive traversal connectFromField: equipment_id → connectToField: parent_equipment_id" } }
        )
      );
    }
  );

  server.registerTool(
    "getRelatedPartsBundle",
    {
      description: "Get a recommended parts bundle for an equipment_id by traversing the equipment topology graph with $graphLookup and joining with parts_catalog. Returns all parts across the full equipment tree with pricing.",
      inputSchema: { equipment_id: z.string() },
    },
    async ({ equipment_id }) => {
      const bundle = await getRelatedPartsBundle({ equipmentId: equipment_id });
      return asMcpText(
        toolOk(
          bundle,
          bundle.parts.map((p) => ({ collection: "parts_catalog", id: p.part_id })),
          { query_insight: { operation: "$graphLookup + $lookup + $unwind + $group", collection: "equipment_topology + parts_catalog", note: "graph traversal to collect all associated_parts; $lookup join with parts_catalog for pricing" } }
        )
      );
    }
  );

  server.registerTool(
    "searchPartsCatalog",
    {
      description: "Search the parts catalog using Atlas Full-Text Search. Pass category (maintenance/repair/upgrade) and model_family filters when known.",
      inputSchema: {
        query: z.string(),
        category: z.string().optional(),
        model_family: z.string().optional(),
        limit: z.number().optional().default(10),
      },
    },
    async ({ query, category, model_family, limit }) => {
      const { results, search_type } = await searchPartsCatalog({ query, category, modelFamily: model_family, limit });
      return asMcpText(
        toolOk(
          { results, count: results.length, search_type },
          results.map((r) => ({ collection: "parts_catalog", id: r.part_id })),
          { query_insight: { operation: "$search", collection: "parts_catalog", index: "parts_catalog_search", note: "Atlas Full-Text Search compound query on description, content, tags" } }
        )
      );
    }
  );

  server.registerTool(
    "searchServiceOfferings",
    {
      description: "Search service offerings using Atlas Full-Text Search. Pass trigger (e.g. efficiency_drift, pre_fault_indicator) to find matching service programs.",
      inputSchema: {
        query: z.string(),
        category: z.string().optional(),
        trigger: z.string().optional(),
        limit: z.number().optional().default(10),
      },
    },
    async ({ query, category, trigger, limit }) => {
      const { results, search_type } = await searchServiceOfferings({ query, category, trigger, limit });
      return asMcpText(
        toolOk(
          { results, count: results.length, search_type },
          results.map((r) => ({ collection: "service_offerings", id: r.offering_id })),
          { query_insight: { operation: "$search", collection: "service_offerings", index: "service_offerings_search", note: "Atlas Full-Text Search on name, description, content fields" } }
        )
      );
    }
  );

  server.registerTool(
    "createSalesOpportunity",
    {
      description: "Persist a confirmed sales opportunity to the pipeline. Call this after confirming a pattern and matching it to catalog offerings.",
      inputSchema: {
        customer_id: z.string(),
        customer_name: z.string().optional(),
        site_id: z.string().optional(),
        chiller_id: z.string().optional(),
        scenario_type: z.string(),
        title: z.string(),
        evidence_summary: z.string(),
        recommended_actions: z.array(z.string()).optional(),
        estimated_value_usd: z.number().optional(),
        priority: z.enum(["high", "medium", "low"]).optional(),
        rep_id: z.string().optional(),
      },
    },
    async ({ customer_id, customer_name, site_id, chiller_id, scenario_type, title, evidence_summary, recommended_actions, estimated_value_usd, priority, rep_id }) => {
      const opp = await createSalesOpportunity({
        customerId: customer_id,
        customersName: customer_name,
        siteId: site_id,
        chillerId: chiller_id,
        scenarioType: scenario_type,
        title,
        evidenceSummary: evidence_summary,
        recommendedActions: recommended_actions,
        estimatedValueUsd: estimated_value_usd,
        priority,
        repId: rep_id,
      });
      return asMcpText(
        toolOk(opp, [{ collection: "sales_opportunities", id: opp.opportunity_id }], {
          query_insight: { operation: "insertOne", collection: "sales_opportunities" },
        })
      );
    }
  );

  server.registerTool(
    "listOpenOpportunities",
    {
      description: "List open (or filtered status) sales opportunities for a customer or chiller.",
      inputSchema: {
        customer_id: z.string().optional(),
        chiller_id: z.string().optional(),
        scenario_type: z.string().optional(),
        status: z.string().optional().default("open"),
        limit: z.number().optional().default(20),
      },
    },
    async ({ customer_id, chiller_id, scenario_type, status, limit }) => {
      const opps = await listOpenOpportunities({ customerId: customer_id, chillerId: chiller_id, scenarioType: scenario_type, status, limit });
      return asMcpText(
        toolOk(
          { opportunities: opps, count: opps.length },
          opps.map((o) => ({ collection: "sales_opportunities", id: o.opportunity_id })),
          { query_insight: { operation: "find", collection: "sales_opportunities" } }
        )
      );
    }
  );

  server.registerTool(
    "captureRepReaction",
    {
      description: "Capture a sales rep thumbs-up or thumbs-down reaction to a generated opportunity.",
      inputSchema: {
        opportunity_id: z.string(),
        reaction: z.enum(["thumbs_up", "thumbs_down"]),
        notes: z.string().optional(),
      },
    },
    async ({ opportunity_id, reaction, notes }) => {
      const result = await captureRepReaction({ opportunityId: opportunity_id, reaction, notes });
      return asMcpText(
        toolOk(result, [{ collection: "sales_opportunities", id: opportunity_id }], {
          query_insight: { operation: "updateOne", collection: "sales_opportunities" },
        })
      );
    }
  );

  server.registerTool(
    "startSalesSession",
    {
      description: "Start a new sales session for a rep reviewing a customer account.",
      inputSchema: {
        customer_id: z.string(),
        rep_id: z.string().optional(),
        focus: z.string().optional(),
      },
    },
    async ({ customer_id, rep_id, focus }) => {
      const session = await startSalesSession({ customerId: customer_id, repId: rep_id, focus });
      return asMcpText(
        toolOk(session, [{ collection: "sales_sessions", id: session.session_id }], {
          query_insight: { operation: "insertOne", collection: "sales_sessions" },
        })
      );
    }
  );

  server.registerTool(
    "storeSalesRecommendationTrace",
    {
      description: "Append a recommendation trace entry to a sales session (evidence refs + inferred outputs).",
      inputSchema: {
        session_id: z.string(),
        source_data_refs: z.array(z.record(z.string())),
        inferred_outputs: z.record(z.unknown()),
      },
    },
    async ({ session_id, source_data_refs, inferred_outputs }) => {
      const trace = await storeSalesRecommendationTrace({
        sessionId: session_id,
        sourceDataRefs: source_data_refs,
        inferredOutputs: inferred_outputs,
      });
      return asMcpText(
        toolOk(trace, [{ collection: "sales_sessions", id: session_id }], {
          query_insight: { operation: "updateOne $push", collection: "sales_sessions" },
        })
      );
    }
  );

  return server;
}
