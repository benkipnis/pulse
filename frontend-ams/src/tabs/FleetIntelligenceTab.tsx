import { useEffect, useState } from "react";
import { useSales } from "../context/SalesContext";
import type { FleetUnit } from "../types";

const CUSTOMERS = [
  { id: "CUST-001", name: "Brookfield Office Properties" },
  { id: "CUST-002", name: "Equinix" },
  { id: "CUST-003", name: "Piedmont Healthcare" },
  { id: "CUST-004", name: "Northwestern University" },
  { id: "CUST-005", name: "Intel Corporation" },
];

const STATUS_COLOR: Record<string, string> = {
  running: "#00684a",
  fault: "#db3030",
  stopped: "#f47920",
  offline: "#5c6c75",
};

function contractBadge(expiryDate: string) {
  const today = new Date();
  const expiry = new Date(expiryDate);
  const daysLeft = Math.ceil((expiry.getTime() - today.getTime()) / 86400000);
  if (daysLeft < 0) return { label: `Expired ${-daysLeft}d ago`, color: "#db3030" };
  if (daysLeft <= 90) return { label: `Expires in ${daysLeft}d`, color: "#f47920" };
  return { label: `Active (${daysLeft}d left)`, color: "#00684a" };
}

export function FleetIntelligenceTab() {
  const { selectCustomer, selectChiller, selectedCustomerId } = useSales();
  const [fleet, setFleet] = useState<FleetUnit[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadFleet(customerId: string) {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/sales/fleet?customer_id=${customerId}`);
      if (!res.ok) throw new Error(`Server ${res.status}`);
      const data = await res.json();
      setFleet(data.fleet ?? []);
    } catch (e) {
      setError((e as Error).message);
      setFleet([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (selectedCustomerId) loadFleet(selectedCustomerId);
    else setFleet([]);
  }, [selectedCustomerId]);

  const totalValue = fleet.reduce((s) => s, 0);

  return (
    <div className="tab-body">
      <div className="fleet-controls">
        <div>
          <label className="form-label">Customer Account</label>
          <select
            className="form-select"
            value={selectedCustomerId ?? ""}
            onChange={(e) => {
              selectCustomer(e.target.value || null);
              selectChiller(null);
            }}
          >
            <option value="">— Select a customer —</option>
            {CUSTOMERS.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {!selectedCustomerId && (
        <div className="empty-zone">
          <div className="empty-zone-icon">🏭</div>
          <p>Select a customer account to view their installed fleet.</p>
        </div>
      )}

      {loading && <div className="loading-bar">Loading fleet data…</div>}
      {error && <div className="error-banner">{error}</div>}

      {fleet.length > 0 && (
        <>
          <div className="fleet-summary-row">
            <div className="fleet-summary-stat">
              <span className="stat-number">{fleet.length}</span>
              <span className="stat-label">Units</span>
            </div>
            <div className="fleet-summary-stat">
              <span className="stat-number">
                {fleet.filter((u) => contractBadge(u.service_contract_expiry).color === "#db3030").length}
              </span>
              <span className="stat-label">Expired Contracts</span>
            </div>
            <div className="fleet-summary-stat">
              <span className="stat-number">
                {fleet.filter((u) => contractBadge(u.service_contract_expiry).color === "#f47920").length}
              </span>
              <span className="stat-label">Expiring Soon</span>
            </div>
            <div className="fleet-summary-stat">
              <span className="stat-number">
                {fleet.filter((u) => u.operating_status === "fault" || u.operating_status === "stopped").length}
              </span>
              <span className="stat-label">Offline / Fault</span>
            </div>
          </div>

          <div className="fleet-grid">
            {fleet.map((unit) => {
              const contract = contractBadge(unit.service_contract_expiry);
              return (
                <div
                  key={unit.chiller_id}
                  className="fleet-card"
                  onClick={() => selectChiller(unit.chiller_id)}
                >
                  <div className="fleet-card-header">
                    <code className="unit-id">{unit.chiller_id}</code>
                    <span
                      style={{
                        width: 10,
                        height: 10,
                        borderRadius: "50%",
                        background: STATUS_COLOR[unit.operating_status] ?? "#5c6c75",
                        display: "inline-block",
                      }}
                    />
                  </div>
                  <div className="fleet-card-model">
                    {unit.model_number} · {unit.product_line}
                  </div>
                  <div className="fleet-card-site">{unit.site_name}</div>

                  <div className="fleet-card-stats">
                    <div>
                      <span className="fleet-stat-label">Capacity</span>
                      <span className="fleet-stat-value">{unit.rated_capacity_tons}T</span>
                    </div>
                    <div>
                      <span className="fleet-stat-label">Rated kW/T</span>
                      <span className="fleet-stat-value">{unit.rated_efficiency_kwpton}</span>
                    </div>
                    <div>
                      <span className="fleet-stat-label">Installed</span>
                      <span className="fleet-stat-value">{unit.install_date?.slice(0, 4)}</span>
                    </div>
                  </div>

                  <div
                    className="contract-badge"
                    style={{ color: contract.color, borderColor: contract.color + "55", background: contract.color + "11" }}
                  >
                    {contract.label}
                  </div>

                  {unit.service_contract_tier && (
                    <div className="fleet-tier">{unit.service_contract_tier}</div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}

      {!loading && selectedCustomerId && fleet.length === 0 && !error && (
        <div className="empty-zone">
          <p>No fleet units found for this customer. Make sure the seed script has been run.</p>
        </div>
      )}
      {totalValue > 0 && <div />}
    </div>
  );
}
