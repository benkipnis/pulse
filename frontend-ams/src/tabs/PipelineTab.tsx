import { useEffect, useState } from "react";
import { useSales } from "../context/SalesContext";
import { OpportunityCard } from "../components/OpportunityCard";
import type { Opportunity } from "../types";

const CUSTOMERS = [
  { id: "CUST-001", name: "Brookfield Office Properties" },
  { id: "CUST-002", name: "Equinix" },
  { id: "CUST-003", name: "Piedmont Healthcare" },
  { id: "CUST-004", name: "Northwestern University" },
  { id: "CUST-005", name: "Intel Corporation" },
];

const SCENARIO_TYPES = [
  "all",
  "efficiency_drift",
  "pre_fault_indicator",
  "high_approach_temp",
  "contract_expiry",
  "fleet_cohort_outlier",
  "repeat_part_failure",
];

export function PipelineTab() {
  const { sendReaction } = useSales();
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [loading, setLoading] = useState(false);
  const [filterCustomer, setFilterCustomer] = useState("");
  const [filterScenario, setFilterScenario] = useState("all");
  const [filterStatus, setFilterStatus] = useState("open");

  async function loadOpps() {
    setLoading(true);
    const params = new URLSearchParams();
    if (filterCustomer) params.set("customer_id", filterCustomer);
    if (filterScenario !== "all") params.set("scenario_type", filterScenario);
    params.set("status", filterStatus);
    params.set("limit", "50");

    try {
      const res = await fetch(`/api/sales/opportunities?${params.toString()}`);
      if (!res.ok) throw new Error(`${res.status}`);
      const data = await res.json();
      setOpportunities(data.opportunities ?? []);
    } catch {
      setOpportunities([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadOpps();
  }, [filterCustomer, filterScenario, filterStatus]);

  async function handleReaction(opportunityId: string, reaction: "thumbs_up" | "thumbs_down") {
    await sendReaction(opportunityId, reaction);
    // Optimistically update local state
    setOpportunities((prev) =>
      prev.map((o) => (o.opportunity_id === opportunityId ? { ...o, rep_reaction: reaction } : o))
    );
  }

  const totalValue = opportunities.reduce((s, o) => s + (o.estimated_value_usd ?? 0), 0);
  const highPriority = opportunities.filter((o) => o.priority === "high").length;

  return (
    <div className="tab-body">
      {/* Pipeline story banner */}
      <div className="pipeline-banner">
        <strong>How this works:</strong> Opportunities are created by the Sales Agent (in the Opportunity Builder tab) and written to the <code>sales_opportunities</code> collection in MongoDB. 8 representative opportunities are pre-seeded across all scenario types to demonstrate the full pipeline. Use <strong>thumbs-up / thumbs-down</strong> to record rep qualification — this writes <code>rep_reaction</code> directly to the document in real time.
      </div>

      {/* Filters */}
      <div className="pipeline-filters">
        <div>
          <label className="form-label">Customer</label>
          <select
            className="form-select"
            value={filterCustomer}
            onChange={(e) => setFilterCustomer(e.target.value)}
          >
            <option value="">All Customers</option>
            {CUSTOMERS.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="form-label">Scenario</label>
          <select
            className="form-select"
            value={filterScenario}
            onChange={(e) => setFilterScenario(e.target.value)}
          >
            {SCENARIO_TYPES.map((s) => (
              <option key={s} value={s}>
                {s === "all" ? "All Scenarios" : s.replace(/_/g, " ")}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="form-label">Status</label>
          <select
            className="form-select"
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
          >
            <option value="open">Open</option>
            <option value="quoted">Quoted</option>
            <option value="won">Won</option>
            <option value="lost">Lost</option>
          </select>
        </div>
        <button className="btn-secondary" onClick={loadOpps} style={{ alignSelf: "flex-end" }}>
          Refresh
        </button>
      </div>

      {/* Summary stats */}
      {opportunities.length > 0 && (
        <div className="pipeline-stats">
          <div className="stat-chip">
            <span className="stat-chip-number">{opportunities.length}</span>
            <span className="stat-chip-label">Opportunities</span>
          </div>
          <div className="stat-chip">
            <span className="stat-chip-number" style={{ color: "#db3030" }}>{highPriority}</span>
            <span className="stat-chip-label">High Priority</span>
          </div>
          <div className="stat-chip">
            <span className="stat-chip-number" style={{ color: "#00684a" }}>
              ${totalValue.toLocaleString()}
            </span>
            <span className="stat-chip-label">Est. Pipeline Value</span>
          </div>
        </div>
      )}

      {loading && <div className="loading-bar">Loading pipeline…</div>}

      {!loading && opportunities.length === 0 && (
        <div className="empty-zone">
          <div className="empty-zone-icon">📋</div>
          {filterCustomer || filterScenario !== "all" ? (
            <p>No {filterStatus} opportunities match these filters.{" "}
              <button className="link-btn" onClick={() => { setFilterCustomer(""); setFilterScenario("all"); }}>
                Clear filters
              </button>{" "}to see all seeded data.
            </p>
          ) : (
            <p>
              No {filterStatus} opportunities found.{" "}
              {filterStatus === "open"
                ? "Run npm run seed:drop to load the 8 pre-seeded opportunities, or use the Opportunity Builder to generate new ones."
                : `Switch to "Open" status to see seeded opportunities.`}
            </p>
          )}
        </div>
      )}

      <div className="opp-list">
        {opportunities.map((opp) => (
          <OpportunityCard key={opp.opportunity_id} opp={opp} onReaction={handleReaction} />
        ))}
      </div>
    </div>
  );
}
