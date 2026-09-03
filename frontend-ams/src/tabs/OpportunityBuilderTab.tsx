import { useState } from "react";
import ReactMarkdown from "react-markdown";
import { useSales } from "../context/SalesContext";
import { EvidencePanel } from "../components/EvidencePanel";
import { ZoneBadge } from "../components/ZoneBadge";
import { SALES_SCENARIOS } from "../types";

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
    evidenceByZone,
    isStreaming,
    selectedCustomerId,
    sendMessage,
    selectCustomer,
    clearChat,
  } = useSales();

  const [input, setInput] = useState("");
  const [showXray, setShowXray] = useState(false);
  const [selectedScenario, setSelectedScenario] = useState<string | null>(null);

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
    const prompt = scenario.prompts[promptIdx];
    setInput(prompt);
  }

  const completedToolRounds = new Map<number, typeof toolEvents>();
  for (const ev of toolEvents) {
    const r = ev.round ?? 0;
    if (!completedToolRounds.has(r)) completedToolRounds.set(r, []);
    completedToolRounds.get(r)!.push(ev);
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
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <button className="btn-secondary" onClick={() => setShowXray(!showXray)}>
              {showXray ? "Hide" : "X-ray"}
            </button>
            <button className="btn-secondary" onClick={clearChat} disabled={isStreaming}>
              Clear
            </button>
          </div>
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
              {s.label}
            </button>
          ))}
        </div>

        {/* Activity strip */}
        <div className="activity-strip">
          {isStreaming && (
            <span className="activity-pulse">Agent working…</span>
          )}
          {activeToolCount > 0 && (
            <span className="activity-badge">{activeToolCount} tool{activeToolCount > 1 ? "s" : ""} running</span>
          )}
          {!isStreaming && toolEvents.length > 0 && (
            <span className="activity-complete">{toolEvents.filter((e) => e.result).length} calls completed</span>
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
          <button className="btn-primary" onClick={handleSubmit} disabled={isStreaming || !input.trim()}>
            {isStreaming ? "…" : "Send"}
          </button>
        </div>
      </div>

      {/* Right: Evidence + X-ray */}
      <div className="builder-evidence">
        <div className="evidence-header">
          <h3>Evidence Board</h3>
          <span style={{ fontSize: "0.8rem", color: "var(--mongo-gray)" }}>
            {Object.keys(evidenceByZone).length} zones populated
          </span>
        </div>
        <EvidencePanel evidence={evidenceByZone} />

        {showXray && toolEvents.length > 0 && (
          <div className="xray-panel">
            <div className="xray-panel-title">MongoDB X-ray</div>
            {[...completedToolRounds.entries()]
              .sort(([a], [b]) => a - b)
              .map(([round, events]) => (
                <div key={round} className="xray-round">
                  <div className="xray-round-label">Round {round}</div>
                  {events.map((e) => (
                    <div key={e.id} className="xray-item">
                      <div className="xray-item-header">
                        <strong>{e.tool}</strong>
                        <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                          {e.pattern && <ZoneBadge zone={e.pattern} small />}
                          {e.latency_ms != null && (
                            <span className="xray-latency">{e.latency_ms}ms</span>
                          )}
                        </div>
                      </div>
                      {e.query_insight && (
                        <div className="xray-insight">
                          <span style={{ fontWeight: 600 }}>{e.query_insight.operation}</span>
                          {e.query_insight.collection && (
                            <span> on <code>{e.query_insight.collection}</code></span>
                          )}
                          {e.query_insight.note && (
                            <div style={{ marginTop: "0.2rem", color: "#aaa" }}>{e.query_insight.note}</div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ))}
          </div>
        )}
      </div>
    </div>
  );
}
