/**
 * AMS Sales Orchestrator — same tool-use loop as VE orchestrator, different persona.
 *
 * The sales agent:
 *   1. Identifies the customer fleet
 *   2. Runs pattern detection tools (efficiency drift, approach temp, pre-fault)
 *   3. Cross-references the parts/services catalog
 *   4. Synthesizes a ranked list of sales opportunities with evidence
 *   5. Persists identified opportunities and session trace
 */

const SALES_SYSTEM_PROMPT = `You are the Aftermarket Sales Intelligence Agent — an AI assistant for Carrier commercial HVAC sales representatives.

Your mission is to identify proactive parts and services sales opportunities for existing customers with installed chiller equipment. You analyze telemetry patterns, service history, warranty/contract status, and fleet data to surface high-confidence, evidence-backed opportunities.

## Approach

**Phase 1 — Fleet Context**
- Start with startSalesSession to log the engagement.
- Use getCustomerFleet to enumerate the customer's units with health metadata.
- Use getServiceContractStatus to flag expired or expiring contracts immediately.

**Phase 2 — Pattern Detection (Data-Driven)**
For each unit in the fleet, run the relevant pattern tools:
- getUnitEfficiencyTrend: detect efficiency drift (rising kW/ton over time)
- getApproachTempTrend: detect condenser fouling (rising approach delta, especially on water-cooled units)
- scanForPreFaultPatterns: detect pre-fault leading indicators (sustained high motor/bearing temps)
- getFleetCohortAnalysis: identify units running worse than install-year peers

**Phase 3 — Catalog Match**
When a pattern is confirmed, match it to solutions:
- searchServiceOfferings: find relevant service programs (pass the pattern type as the trigger)
- searchPartsCatalog: find relevant replacement parts or upgrade components
- getRelatedPartsBundle: use the equipment graph to identify the full scope of parts affected

**Phase 4 — Opportunity Synthesis**
- Rank opportunities by: (1) risk to customer operations + (2) estimated deal value
- For each confirmed opportunity, call createSalesOpportunity to save it
- Close the session with storeSalesRecommendationTrace

## Rules
- Always cite specific evidence: telemetry trend figures, alarm codes, service ticket IDs, or contract dates.
- Never fabricate chiller IDs, part numbers, or telemetry values.
- Present dollar figures as estimates based on catalog list prices.
- Be direct and concise — the audience is a field sales rep, not a technician.
- When patterns are absent, clearly state no opportunity was found rather than inventing one.
- If the user gives you a specific chiller ID like CH-ATL-001, use it exactly in tool calls.

## Opportunity Types
- **efficiency_drift**: COP/kW-per-ton has worsened >5% vs 90-day baseline → refrigerant recharge, tube cleaning, or controls upgrade
- **pre_fault_indicator**: rising motor/bearing temps trending toward alarm threshold → preventive replacement before unplanned downtime
- **high_approach_temp**: condensing temp delta vs ambient rising → condenser cleaning service or tube bundle replacement
- **repeat_part_failure**: same part replaced ≥2x in 18 months → suggest higher-spec replacement or root-cause inspection
- **contract_expiry**: service contract expires within 90 days → renewal proposal
- **pm_overdue**: no PM ticket in >12 months → scheduled maintenance offering
- **fleet_cohort_outlier**: unit efficiency worse than same-vintage peers → targeted upgrade recommendation`;

const TOOL_ZONE_MAP = {
  getCustomerFleet: "fleet",
  getFleetAlarmSummary: "fleet",
  getUnitEfficiencyTrend: "efficiency",
  getApproachTempTrend: "efficiency",
  scanForPreFaultPatterns: "pre_fault",
  getServiceContractStatus: "contract",
  getFleetCohortAnalysis: "cohort",
  getConnectedEquipmentGraph: "graph",
  getRelatedPartsBundle: "graph",
  searchPartsCatalog: "catalog",
  searchServiceOfferings: "catalog",
  createSalesOpportunity: "pipeline",
  listOpenOpportunities: "pipeline",
  startSalesSession: "session",
  storeSalesRecommendationTrace: "session",
};

export function mapSalesToolToZone(toolName) {
  return TOOL_ZONE_MAP[toolName] || null;
}

export function buildSalesEvidenceUpdate(toolName, toolResult) {
  const zone = mapSalesToolToZone(toolName);
  if (!zone || !toolResult?.data) return null;

  const data = toolResult.data;
  let summary = null;

  switch (zone) {
    case "fleet":
      summary = data.fleet || data;
      break;
    case "efficiency":
      summary = data.readings
        ? { count: data.readings.length, drift_pct: data.drift_pct, approach_drift_f: data.approach_drift_f }
        : data;
      break;
    case "pre_fault":
      summary = Array.isArray(data) ? data.filter((u) => u.flag_count > 0) : data;
      break;
    case "contract":
      summary = Array.isArray(data) ? data : data;
      break;
    case "cohort":
      summary = { percentile: data.percentile, cohort_size: data.cohort_size };
      break;
    case "graph":
      summary = data.total_nodes ? { total_nodes: data.total_nodes } : data;
      break;
    case "catalog":
      summary = data.results?.slice(0, 3) || data;
      break;
    case "pipeline":
      summary = data.opportunity_id ? { opportunity_id: data.opportunity_id, title: data.title } : data;
      break;
    case "session":
      summary = data.session_id ? { session_id: data.session_id } : data;
      break;
    default:
      summary = data;
  }

  return { zone, tool: toolName, summary, evidence_refs: toolResult.evidence_refs || [] };
}

async function callOpenAi({ baseUrl, headers, model, messages, tools }) {
  const url = `${baseUrl.replace(/\/$/, "")}/chat/completions`;
  const res = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify({ model, messages, tools, tool_choice: "auto", stream: true }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`OpenAI API error ${res.status}: ${err.slice(0, 500)}`);
  }
  return res.body;
}

async function callAnthropic({ baseUrl, headers, model, messages, tools, system }) {
  const url = `${baseUrl.replace(/\/$/, "")}/messages`;
  const res = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify({ model, max_tokens: 4096, system, messages, tools, stream: true }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Anthropic API error ${res.status}: ${err.slice(0, 500)}`);
  }
  return res.body;
}

async function* parseOpenAiStream(body) {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";
    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      const payload = line.slice(6).trim();
      if (payload === "[DONE]") return;
      try { yield JSON.parse(payload); } catch { /* skip */ }
    }
  }
}

async function* parseAnthropicStream(body) {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";
    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      try { yield JSON.parse(line.slice(6)); } catch { /* skip */ }
    }
  }
}

export async function runSalesAgent({ mcpClient, llmConfig, userMessage, customerId, onEvent }) {
  const emit = (type, payload) => onEvent?.({ type, ...payload });

  const tools =
    llmConfig.protocol === "anthropic"
      ? mcpClient.toAnthropicTools()
      : mcpClient.toOpenAiTools();

  const contextNote = customerId
    ? `\n\nThe sales rep is reviewing customer ID: ${customerId}. Use this customer_id in fleet tool calls.`
    : "";

  const messages =
    llmConfig.protocol === "openai"
      ? [
          { role: "system", content: SALES_SYSTEM_PROMPT + contextNote },
          { role: "user", content: userMessage },
        ]
      : [{ role: "user", content: userMessage }];

  let sessionId = null;
  let step = 0;

  while (step < (llmConfig.maxSteps ?? 12)) {
    step += 1;

    const streamBody =
      llmConfig.protocol === "anthropic"
        ? await callAnthropic({
            baseUrl: llmConfig.baseUrl,
            headers: llmConfig.headers,
            model: llmConfig.model,
            messages,
            tools,
            system: SALES_SYSTEM_PROMPT + contextNote,
          })
        : await callOpenAi({
            baseUrl: llmConfig.baseUrl,
            headers: llmConfig.headers,
            model: llmConfig.model,
            messages,
            tools,
          });

    const stream =
      llmConfig.protocol === "anthropic"
        ? parseAnthropicStream(streamBody)
        : parseOpenAiStream(streamBody);

    let assistantText = "";
    const toolCalls = [];

    if (llmConfig.protocol === "openai") {
      const toolCallAccum = {};

      for await (const chunk of stream) {
        const delta = chunk.choices?.[0]?.delta;
        if (!delta) continue;

        if (delta.content) {
          assistantText += delta.content;
          emit("assistant_delta", { text: delta.content });
        }

        if (delta.tool_calls) {
          for (const tc of delta.tool_calls) {
            const idx = tc.index ?? 0;
            if (!toolCallAccum[idx]) {
              toolCallAccum[idx] = { id: tc.id, name: "", arguments: "" };
            }
            if (tc.id) toolCallAccum[idx].id = tc.id;
            if (tc.function?.name) toolCallAccum[idx].name += tc.function.name;
            if (tc.function?.arguments) toolCallAccum[idx].arguments += tc.function.arguments;
          }
        }
      }

      if (Object.keys(toolCallAccum).length > 0) {
        for (const tc of Object.values(toolCallAccum)) {
          if (!tc.name) continue;
          let args = {};
          try { args = JSON.parse(tc.arguments || "{}"); } catch { args = {}; }
          toolCalls.push({ id: tc.id, name: tc.name, arguments: args });
        }
      }

      if (toolCalls.length === 0) {
        emit("done", { session_id: sessionId, summary: assistantText });
        return { text: assistantText, sessionId };
      }

      messages.push({
        role: "assistant",
        content: assistantText || null,
        tool_calls: toolCalls.map((tc) => ({
          id: tc.id,
          type: "function",
          function: { name: tc.name, arguments: JSON.stringify(tc.arguments) },
        })),
      });

      for (const tc of toolCalls) {
        emit("tool_start", { tool: tc.name, args: tc.arguments, pattern: mapSalesToolToZone(tc.name), round: step });

        const { result, latencyMs } = await mcpClient.callTool(tc.name, tc.arguments);

        if (tc.name === "startSalesSession" && result?.data?.session_id) {
          sessionId = result.data.session_id;
        }

        emit("tool_result", {
          tool: tc.name,
          args: tc.arguments,
          result,
          latency_ms: latencyMs,
          query_insight: result.query_insight || null,
          round: step,
        });

        const evidence = buildSalesEvidenceUpdate(tc.name, result);
        if (evidence) emit("evidence_update", evidence);

        messages.push({
          role: "tool",
          tool_call_id: tc.id,
          content: JSON.stringify(result),
        });
      }
    } else {
      // Anthropic streaming
      let currentTool = null;
      let toolInputJson = "";

      for await (const event of stream) {
        if (event.type === "content_block_delta" && event.delta?.type === "text_delta") {
          assistantText += event.delta.text;
          emit("assistant_delta", { text: event.delta.text });
        }

        if (event.type === "content_block_start" && event.content_block?.type === "tool_use") {
          currentTool = { id: event.content_block.id, name: event.content_block.name, arguments: {} };
          toolInputJson = "";
        }

        if (event.type === "content_block_delta" && event.delta?.type === "input_json_delta") {
          toolInputJson += event.delta.partial_json;
        }

        if (event.type === "content_block_stop" && currentTool) {
          try { currentTool.arguments = JSON.parse(toolInputJson || "{}"); } catch { currentTool.arguments = {}; }
          toolCalls.push(currentTool);
          currentTool = null;
          toolInputJson = "";
        }

        if (event.type === "message_stop") break;
      }

      if (toolCalls.length === 0) {
        emit("done", { session_id: sessionId, summary: assistantText });
        return { text: assistantText, sessionId };
      }

      const assistantContent = [];
      if (assistantText) assistantContent.push({ type: "text", text: assistantText });
      for (const tc of toolCalls) {
        assistantContent.push({ type: "tool_use", id: tc.id, name: tc.name, input: tc.arguments });
      }
      messages.push({ role: "assistant", content: assistantContent });

      const toolResults = [];
      for (const tc of toolCalls) {
        emit("tool_start", { tool: tc.name, args: tc.arguments, pattern: mapSalesToolToZone(tc.name), round: step });

        const { result, latencyMs } = await mcpClient.callTool(tc.name, tc.arguments);

        if (tc.name === "startSalesSession" && result?.data?.session_id) {
          sessionId = result.data.session_id;
        }

        emit("tool_result", {
          tool: tc.name,
          args: tc.arguments,
          result,
          latency_ms: latencyMs,
          query_insight: result.query_insight || null,
          round: step,
        });

        const evidence = buildSalesEvidenceUpdate(tc.name, result);
        if (evidence) emit("evidence_update", evidence);

        toolResults.push({ type: "tool_result", tool_use_id: tc.id, content: JSON.stringify(result) });
      }

      messages.push({ role: "user", content: toolResults });
    }
  }

  emit("done", { session_id: sessionId, summary: "Reached maximum agent steps." });
  return { text: "Reached maximum agent steps.", sessionId };
}
