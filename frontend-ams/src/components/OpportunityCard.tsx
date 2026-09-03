import type { Opportunity } from "../types";

const PRIORITY_COLOR = { high: "#db3030", medium: "#f47920", low: "#00684a" };
const STATUS_COLOR: Record<string, string> = {
  open: "#0072c3",
  quoted: "#f47920",
  won: "#00684a",
  lost: "#5c6c75",
};

interface Props {
  opp: Opportunity;
  onReaction?: (id: string, reaction: "thumbs_up" | "thumbs_down") => void;
}

export function OpportunityCard({ opp, onReaction }: Props) {
  const priorityColor = PRIORITY_COLOR[opp.priority] ?? "#5c6c75";
  const statusColor = STATUS_COLOR[opp.status] ?? "#5c6c75";

  return (
    <div className="opp-card">
      <div className="opp-card-header">
        <div style={{ flex: 1 }}>
          <span className="opp-scenario-badge">{opp.scenario_type.replace(/_/g, " ")}</span>
          <h3 className="opp-title">{opp.title}</h3>
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "0.4rem" }}>
          <span style={{ color: priorityColor, fontWeight: 700, fontSize: "0.8rem", textTransform: "uppercase" }}>
            {opp.priority}
          </span>
          <span style={{ color: statusColor, fontSize: "0.8rem", fontWeight: 600 }}>
            {opp.status}
          </span>
        </div>
      </div>

      <p className="opp-evidence">{opp.evidence_summary}</p>

      {opp.recommended_actions?.length > 0 && (
        <div className="opp-actions">
          {opp.recommended_actions.map((a) => (
            <span key={a} className="opp-action-tag">
              {a.replace(/_/g, " ")}
            </span>
          ))}
        </div>
      )}

      <div className="opp-footer">
        <div>
          {opp.chiller_id && <code className="opp-meta">{opp.chiller_id}</code>}
          {opp.estimated_value_usd != null && (
            <span className="opp-meta opp-value">
              ${opp.estimated_value_usd.toLocaleString()}
            </span>
          )}
        </div>
        {onReaction && opp.status === "open" && (
          <div className="opp-reactions">
            <span style={{ fontSize: "0.8rem", color: "var(--mongo-gray)" }}>Relevant?</span>
            <button
              className={`reaction-btn ${opp.rep_reaction === "thumbs_up" ? "active-positive" : ""}`}
              onClick={() => onReaction(opp.opportunity_id, "thumbs_up")}
            >
              👍
            </button>
            <button
              className={`reaction-btn ${opp.rep_reaction === "thumbs_down" ? "active-negative" : ""}`}
              onClick={() => onReaction(opp.opportunity_id, "thumbs_down")}
            >
              👎
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
