import { ZoneBadge } from "./ZoneBadge";
import type { EvidenceUpdate } from "../types";

const ZONE_ORDER = ["session", "fleet", "contract", "efficiency", "pre_fault", "cohort", "graph", "catalog", "pipeline"];

interface Props {
  evidence: Record<string, EvidenceUpdate>;
}

function renderSummary(summary: unknown): string {
  if (summary == null) return "";
  if (typeof summary === "string") return summary;
  if (typeof summary === "number") return String(summary);
  if (Array.isArray(summary)) {
    if (summary.length === 0) return "(empty)";
    return `${summary.length} items`;
  }
  if (typeof summary === "object") {
    const entries = Object.entries(summary as Record<string, unknown>)
      .filter(([, v]) => v != null && v !== "")
      .slice(0, 4)
      .map(([k, v]) => `${k}: ${typeof v === "object" ? JSON.stringify(v).slice(0, 60) : v}`);
    return entries.join(" · ") || JSON.stringify(summary).slice(0, 120);
  }
  return String(summary);
}

export function EvidencePanel({ evidence }: Props) {
  const zones = ZONE_ORDER.filter((z) => evidence[z]);

  if (zones.length === 0) {
    return (
      <div className="evidence-empty">
        <p>Evidence will appear here as the agent runs tool calls.</p>
      </div>
    );
  }

  return (
    <div className="evidence-panel">
      {zones.map((zone) => {
        const ev = evidence[zone];
        return (
          <div key={zone} className="evidence-zone">
            <div className="evidence-zone-header">
              <ZoneBadge zone={zone} />
              <span className="evidence-tool-name">{ev.tool}</span>
            </div>
            <div className="evidence-zone-summary">{renderSummary(ev.summary)}</div>
            {ev.evidence_refs?.length > 0 && (
              <div className="evidence-refs">
                {ev.evidence_refs.slice(0, 3).map((r, i) => (
                  <span key={i} className="evidence-ref-chip">
                    {r.collection}/{r.id}
                  </span>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
