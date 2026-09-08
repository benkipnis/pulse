import { useState } from "react";
import ReactMarkdown from "react-markdown";
import { useSales } from "../context/SalesContext";
import { SalesFlowTimeline } from "../components/SalesFlowTimeline";
import { ZoneBadge } from "../components/ZoneBadge";
import { SALES_SCENARIOS } from "../types";
import type { ToolEvent } from "../types";

const CUSTOMERS = [
  { id: "CUST-001", name: "Brookfield Office Properties" },
  { id: "CUST-002", name: "Equinix" },
  { id: "CUST-003", name: "Piedmont Healthcare" },
  { id: "CUST-004", name: "Northwestern University" },
  { id: "CUST-005", name: "Intel Corporation" },
];

export function OpportunityBuilderTab() {
  const {
    messages,
    toolEvents,
    isStreaming,
    selectedCustomerId,
    sendMessage,
    selectCustomer,
    clearChat,
  } = useSales();

  const [input, setInput] = useState("");
  const [selectedScenario, setSelectedScenario] = useState<string | null>(null);
  const [selectedInsight, setSelectedInsight] = useState<ToolEvent | null>(null);

  const activeToolCount = toolEvents.filter((e) => !e.result).length;

  function handleSubmit() {
    if (!input.trim() || isStreaming) return;
    sendMessage(input.trim(), selectedCustomerId);
    setInput("");
  }

  function applyScenario(scenarioId: string, promptIdx: number) {
    const scenario = SALES_SCENARIOS.find((s) => s.id === scenarioId);
    if (!scenario) return;
    setSelectedScenario(scenarioId);
    selectCustomer(scenario.customer_id);
    setInput(scenario.prompts[promptIdx]);
  }

  function handleClear() {
    clearChat();
    setSelectedInsight(null);
  }

  return (
    <div className="builder-layout">
      {/* Left: Chat */}
      <div className="builder-chat">
        <div className="builder-chat-header">
          <div>
            <label className="form-label">Customer Context</label>
            <select
              className="form-select"
              value={selectedCustomerId ?? ""}
              onChange={(e) => selectCustomer(e.target.value || null)}
            >
              <option value="">— No customer selected —</option>
              {CUSTOMERS.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <button className="btn-secondary" onClick={handleClear} disabled={isStreaming}>
            Clear
          </button>
        </div>

        {/* Scenario Picker */}
        <div className="scenario-picker">
          <span className="scenario-picker-label">Scenarios:</span>
          {SALES_SCENARIOS.map((s) => (
            <button
              key={s.id}
              className={`scenario-btn ${selectedScenario === s.id ? "active" : ""}`}
              onClick={() => applyScenario(s.id, 0)}
              title={s.prompts[0]}
            >
              <span className="scenario-label">{s.label}</span>
              <span className="scenario-sub">{s.customerName} · {s.chiller_id}</span>
            </button>
          ))}
        </div>

        {/* Activity strip */}
        <div className="activity-strip">
          {isStreaming && <span className="activity-pulse">Agent working…</span>}
          {activeToolCount > 0 && (
            <span className="activity-badge">
              {activeToolCount} tool{activeToolCount > 1 ? "s" : ""} running
            </span>
          )}
          {!isStreaming && toolEvents.length > 0 && (
            <span className="activity-complete">
              {toolEvents.filter((e) => e.result).length} calls completed
            </span>
          )}
        </div>

        {/* Messages */}
        <div className="chat-messages">
          {messages.length === 0 && (
            <div className="empty-zone" style={{ padding: "3rem 1rem", textAlign: "center" }}>
              <div style={{ fontSize: "2rem", marginBottom: "0.75rem" }}>💼</div>
              <p>Select a scenario above or type a customer inquiry to identify sales opportunities.</p>
            </div>
          )}
          {messages.map((m) => (
            <div key={m.id} className={m.role === "user" ? "message-user" : "message-assistant"}>
              {m.role === "assistant" ? (
                <ReactMarkdown>{m.content}</ReactMarkdown>
              ) : (
                m.content
              )}
            </div>
          ))}
        </div>

        {/* Input */}
        <div className="chat-input-row">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="e.g. Analyze CH-ATL-001 for efficiency opportunities…"
            rows={2}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSubmit();
              }
            }}
          />
          <button
            className="btn-primary"
            onClick={handleSubmit}
            disabled={isStreaming || !input.trim()}
          >
            {isStreaming ? "…" : "Send"}
          </button>
        </div>
      </div>

      {/* Right: Agent Reasoning Flow */}
      <div className="builder-evidence">
        <div className="evidence-header">
          <h3>Agent Reasoning Flow</h3>
          <span style={{ fontSize: "0.8rem", color: "var(--mongo-gray)" }}>
            {toolEvents.length > 0
              ? `${toolEvents.filter((e) => e.result).length} / ${toolEvents.length} calls`
              : ""}
          </span>
        </div>

        <SalesFlowTimeline
          toolEvents={toolEvents}
          selectedInsight={selectedInsight}
          onSelect={setSelectedInsight}
        />

        {/* Query Inspector — appears when a card is clicked */}
        {selectedInsight && (
          <div className="sft-inspector">
            <div className="sft-inspector-header">
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                {selectedInsight.pattern && (
                  <ZoneBadge zone={selectedInsight.pattern} small />
                )}
                <span className="sft-inspector-tool">{selectedInsight.tool}</span>
              </div>
              <button
                className="sft-inspector-close"
                onClick={() => setSelectedInsight(null)}
              >
                ✕
              </button>
            </div>

            {selectedInsight.args && Object.keys(selectedInsight.args).length > 0 && (
              <div className="sft-inspector-section">
                <div className="sft-inspector-label">Arguments</div>
                <pre className="sft-inspector-pre">
                  {JSON.stringify(selectedInsight.args, null, 2)}
                </pre>
              </div>
            )}

            {selectedInsight.query_insight && (
              <div className="sft-inspector-section">
                <div className="sft-inspector-label">MongoDB Query</div>
                <div className="sft-inspector-query">
                  {selectedInsight.query_insight.operation && (
                    <span className="sft-inspector-op">
                      {selectedInsight.query_insight.operation}
                    </span>
                  )}
                  {selectedInsight.query_insight.collection && (
                    <span>
                      {" "}on <code>{selectedInsight.query_insight.collection}</code>
                    </span>
                  )}
                  {selectedInsight.query_insight.index && (
                    <span className="sft-inspector-index">
                      {" "}· index: {selectedInsight.query_insight.index}
                    </span>
                  )}
                  {selectedInsight.query_insight.note && (
                    <div className="sft-inspector-note">
                      {selectedInsight.query_insight.note}
                    </div>
                  )}
                </div>
              </div>
            )}

            {selectedInsight.result && (
              <div className="sft-inspector-section">
                <div className="sft-inspector-label">
                  Result
                  {selectedInsight.latency_ms != null && (
                    <span className="sft-inspector-latency">
                      {" "}· {selectedInsight.latency_ms}ms
                    </span>
                  )}
                </div>
                <pre className="sft-inspector-pre sft-inspector-result">
                  {(() => {
                    const s = JSON.stringify(selectedInsight.result, null, 2);
                    return s.length > 2000 ? s.slice(0, 2000) + "\n…(truncated)" : s;
                  })()}
                </pre>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
