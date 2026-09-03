import type { SalesZone } from "../types";

const ZONE_META: Record<SalesZone, { label: string; color: string }> = {
  fleet: { label: "Fleet Query", color: "#00ed64" },
  efficiency: { label: "$setWindowFields", color: "#0072c3" },
  pre_fault: { label: "Pre-Fault Scan", color: "#f47920" },
  contract: { label: "Contract Status", color: "#9b59b6" },
  cohort: { label: "Cohort $group", color: "#1abc9c" },
  graph: { label: "$graphLookup", color: "#e74c3c" },
  catalog: { label: "Atlas Search", color: "#00684a" },
  pipeline: { label: "Pipeline Write", color: "#5c6c75" },
  session: { label: "Session", color: "#8e9eab" },
};

export function ZoneBadge({ zone, small }: { zone: string; small?: boolean }) {
  const meta = ZONE_META[zone as SalesZone] ?? { label: zone, color: "#5c6c75" };
  return (
    <span
      style={{
        display: "inline-block",
        background: meta.color + "22",
        color: meta.color,
        border: `1px solid ${meta.color}55`,
        borderRadius: "4px",
        padding: small ? "1px 6px" : "2px 8px",
        fontSize: small ? "0.7rem" : "0.75rem",
        fontWeight: 600,
        fontFamily: "monospace",
        whiteSpace: "nowrap",
      }}
    >
      {meta.label}
    </span>
  );
}
