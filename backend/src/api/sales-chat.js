/**
 * AMS Sales Chat API — mirrors VE chat.js with sales agent persona.
 * Route: /api/sales/chat  (POST)
 */
import { Router } from "express";
import { getLlmConfig } from "../config/env.js";
import { McpHttpClient } from "../agent/mcpClient.js";
import { runSalesAgent } from "../agent/sales-orchestrator.js";
import { getCustomerFleet, getServiceContractStatus } from "../repositories/fleet.js";
import { listOpenOpportunities, captureRepReaction } from "../repositories/salesPipeline.js";

const router = Router();

function sseWrite(res, event, data) {
  res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

router.get("/health", (_req, res) => {
  try {
    const llm = getLlmConfig();
    res.json({
      status: "ok",
      service: "ams-sales-chat",
      llm: {
        provider: llm.provider,
        protocol: llm.protocol,
        gateway: llm.gateway,
        model: llm.model,
      },
    });
  } catch (err) {
    res.status(503).json({ status: "error", message: err.message });
  }
});

router.post("/chat", async (req, res) => {
  const { message, customer_id: customerId } = req.body || {};

  if (!message || typeof message !== "string") {
    res.status(400).json({ error: "message is required" });
    return;
  }

  let llmConfig;
  try {
    llmConfig = { ...getLlmConfig(), maxSteps: Number(process.env.AGENT_MAX_STEPS || 14) };
  } catch (err) {
    res.status(503).json({ error: err.message });
    return;
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders?.();

  const mcpClient = new McpHttpClient();

  // Step 1: MCP connect (isolated so errors are clearly labelled)
  try {
    await mcpClient.connect();
  } catch (err) {
    sseWrite(res, "error", { message: `MCP connection failed: ${err.message}` });
    res.end();
    return;
  }

  // Step 2: Run agent (LLM calls)
  try {
    await runSalesAgent({
      mcpClient,
      llmConfig,
      userMessage: message,
      customerId: customerId || null,
      onEvent: (event) => {
        const { type, ...payload } = event;
        if (type === "tool_start" && payload.tool) {
          sseWrite(res, type, { ...payload, pattern: payload.pattern || null });
        } else {
          sseWrite(res, type, payload);
        }
      },
    });
  } catch (err) {
    sseWrite(res, "error", { message: err.message });
  } finally {
    res.end();
  }
});

/**
 * Capture rep thumbs-up/down on a generated sales opportunity.
 */
router.post("/reaction", async (req, res) => {
  const { opportunity_id: opportunityId, reaction, notes } = req.body || {};
  if (!opportunityId || !reaction) {
    res.status(400).json({ error: "opportunity_id and reaction are required" });
    return;
  }

  const mcpClient = new McpHttpClient();
  try {
    await mcpClient.connect();
    const { result } = await mcpClient.callTool("captureRepReaction", {
      opportunity_id: opportunityId,
      reaction,
      notes: notes || "",
    });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/sales/fleet?customer_id=... — fleet overview for the AMS frontend Fleet Intelligence tab.
 */
router.get("/fleet", async (req, res) => {
  const { customer_id: customerId, site_id: siteId } = req.query;
  try {
    const fleet = await getCustomerFleet({ customerId: customerId || undefined, siteId: siteId || undefined });
    res.json({ fleet, count: fleet.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/sales/contracts?customer_id=... — contract status check.
 */
router.get("/contracts", async (req, res) => {
  const { customer_id: customerId, chiller_id: chillerId } = req.query;
  try {
    const units = await getServiceContractStatus({ customerId: customerId || undefined, chillerId: chillerId || undefined });
    res.json({ units, count: units.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/sales/opportunities?customer_id=...&status=...&scenario_type=...&limit=...
 */
router.get("/opportunities", async (req, res) => {
  const { customer_id, chiller_id, scenario_type, status, limit } = req.query;
  try {
    const opportunities = await listOpenOpportunities({
      customerId: customer_id || undefined,
      chillerId: chiller_id || undefined,
      scenarioType: scenario_type || undefined,
      status: status || "open",
      limit: Number(limit || 50),
    });
    res.json({ opportunities, count: opportunities.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/sales/reaction — capture rep reaction (called from Pipeline tab).
 * Also accessible through MCP tool captureRepReaction.
 */
router.post("/reaction-direct", async (req, res) => {
  const { opportunity_id: opportunityId, reaction, notes } = req.body || {};
  if (!opportunityId || !reaction) {
    res.status(400).json({ error: "opportunity_id and reaction are required" });
    return;
  }
  try {
    const result = await captureRepReaction({ opportunityId, reaction, notes });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
