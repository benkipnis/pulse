export type SalesZone =
  | "fleet"
  | "efficiency"
  | "pre_fault"
  | "contract"
  | "cohort"
  | "graph"
  | "catalog"
  | "pipeline"
  | "session";

export interface ToolEvent {
  id: string;
  tool: string;
  args: Record<string, unknown>;
  result?: Record<string, unknown>;
  latency_ms?: number;
  query_insight?: {
    operation?: string;
    collection?: string;
    index?: string;
    note?: string;
    pattern?: string;
  } | null;
  pattern?: string | null;
  timestamp: number;
  round?: number;
}

export interface EvidenceUpdate {
  zone: SalesZone;
  tool: string;
  summary: unknown;
  evidence_refs: Array<{ collection: string; id: string }>;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
}

export interface Opportunity {
  opportunity_id: string;
  customer_id?: string;
  customer_name?: string;
  site_id?: string;
  chiller_id?: string;
  scenario_type: string;
  title: string;
  evidence_summary: string;
  recommended_actions: string[];
  estimated_value_usd?: number;
  priority: "high" | "medium" | "low";
  status: string;
  rep_id?: string;
  rep_reaction?: string | null;
  created_at: string;
}

export interface FleetUnit {
  chiller_id: string;
  site_id: string;
  model_family: string;
  model_number: string;
  product_line: string;
  operating_status: string;
  install_date: string;
  rated_efficiency_kwpton: number;
  rated_capacity_tons: number;
  service_contract_expiry: string;
  customer_id?: string;
  site_name?: string;
  customer_name?: string;
  building_type?: string;
  service_contract_tier?: string;
}

export const SALES_SCENARIOS = [
  {
    id: "efficiency_drift",
    label: "Efficiency Drift",
    customer_id: "CUST-001",
    chiller_id: "CH-ATL-001",
    prompts: [
      "Review CH-ATL-001 for efficiency drift over the past 90 days and recommend relevant services.",
      "Analyze the full fleet for customer CUST-001 — identify any efficiency opportunities.",
    ],
  },
  {
    id: "pre_fault_indicator",
    label: "Pre-Fault Indicator",
    customer_id: "CUST-004",
    chiller_id: "CH-CHI-004",
    prompts: [
      "Scan CH-CHI-004 for pre-fault patterns and identify parts/services to recommend.",
      "Review the entire CUST-004 fleet for pre-fault risk and surface high-priority opportunities.",
    ],
  },
  {
    id: "high_approach_temp",
    label: "Condenser Fouling",
    customer_id: "CUST-002",
    chiller_id: "CH-DAL-002",
    prompts: [
      "Check CH-DAL-002 for condenser approach temperature drift and recommend a service bundle.",
      "Analyze condenser health for the Equinix account (CUST-002).",
    ],
  },
  {
    id: "contract_expiry",
    label: "Contract Expiry",
    customer_id: "CUST-003",
    chiller_id: "CH-ATL-003",
    prompts: [
      "What service contracts are expiring soon for Piedmont Healthcare? Suggest renewal options.",
      "Show me all lapsed and expiring contracts across the fleet.",
    ],
  },
  {
    id: "fleet_cohort_outlier",
    label: "Cohort Outlier",
    customer_id: "CUST-002",
    chiller_id: "CH-DAL-002",
    prompts: [
      "How does CH-DAL-002 compare to its install-year cohort? Identify upgrade opportunities.",
    ],
  },
];
