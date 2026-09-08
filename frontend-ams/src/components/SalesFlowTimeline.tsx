import { ZoneBadge } from "./ZoneBadge";
import type { ToolEvent } from "../types";

interface Props {
  toolEvents: ToolEvent[];
  selectedInsight: ToolEvent | null;
  onSelect: (event: ToolEvent) => void;
}

function groupByRound(events: ToolEvent[]): Map<number, ToolEvent[]> {
  const rounds = new Map<number, ToolEvent[]>();
  for (const ev of events) {
    const r = ev.round ?? 0;
    if (!rounds.has(r)) rounds.set(r, []);
    rounds.get(r)!.push(ev);
  }
  return rounds;
}

function ResultSummary({ result }: { result: Record<string, unknown> }) {
  const data = (result?.data ?? result) as Record<string, unknown> | null;
  if (!data) return <span className="sft-no-result">no data</span>;

  // Surface the most useful top-level fields
  const interesting: string[] = [];
  for (const [k, v] of Object.entries(data)) {
    if (v == null || k === "evidence_refs" || k === "query_insight") continue;
    if (typeof v === "number") {
      interesting.push(`${k}: ${v}`);
    } else if (Array.isArray(v)) {
      interesting.push(`${k}: ${v.length} items`);
    } else if (typeof v === "string" && v.length < 60) {
      interesting.push(`${k}: ${v}`);
    } else if (typeof v === "object") {
      const keys = Object.keys(v as object);
      interesting.push(`${k}: {${keys.slice(0, 2).join(", ")}${keys.length > 2 ? "…" : ""}}`);
    }
    if (interesting.length >= 4) break;
  }
  return <span className="sft-result-summary">{interesting.join(" · ") || JSON.stringify(data).slice(0, 100)}</span>;
}

export function SalesFlowTimeline({ toolEvents, selectedInsight, onSelect }: Props) {
  if (toolEvents.length === 0) {
    return (
      <div className="sft-empty">
        Agent tool calls will appear here as the agent works…
      </div>
    );
  }

  const rounds = groupByRound(toolEvents);
  const sortedRounds = [...rounds.entries()].sort(([a], [b]) => a - b);

  return (
    <div className="sft-timeline">
      {sortedRounds.map(([round, events], roundIdx) => (
        <div key={round} className="sft-round">
          <div className="sft-round-label">Round {round}</div>
          <div className="sft-cards">
            {events.map((ev) => {
              const inFlight = !ev.result;
              const isDegraded = (ev.result as { degraded?: boolean } | undefined)?.degraded;
              const isSelected = selectedInsight?.id === ev.id;

              return (
                <button
                  key={ev.id}
                  className={[
                    "sft-card",
                    isSelected ? "selected" : "",
                    inFlight ? "in-flight" : "",
                    isDegraded ? "degraded" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  onClick={() => onSelect(ev)}
                  title={ev.tool}
                >
                  <div className="sft-card-top">
                    {ev.pattern && <ZoneBadge zone={ev.pattern} small />}
                    <span className="sft-tool-name">{ev.tool}</span>
                  </div>
                  <div className="sft-card-bottom">
                    {inFlight ? (
                      <span className="sft-spinner" />
                    ) : isDegraded ? (
                      <span className="sft-degraded-badge">degraded</span>
                    ) : ev.latency_ms != null ? (
                      <span className="sft-latency">{ev.latency_ms}ms</span>
                    ) : null}
                    {!inFlight && ev.result && (
                      <ResultSummary result={ev.result} />
                    )}
                  </div>
                </button>
              );
            })}
          </div>
          {roundIdx < sortedRounds.length - 1 && (
            <div className="sft-arrow">↓ LLM decides next steps</div>
          )}
        </div>
      ))}
    </div>
  );
}
