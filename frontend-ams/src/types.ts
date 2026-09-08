// ─── Shared Query Pattern types (from VE) ────────────────────────────────────

export type QueryPattern =
  | "exact_find"
  | "aggregation_lookup"
  | "time_series_window"
  | "vector_search"
  | "atlas_search"
  | "hybrid_search"
  | "voyage_rerank"
  | "write"
  | "not_configured";

export interface RankFusionLegDetail {
  pipeline: string;
  rank: number | null;
  weight: number;
}

export interface RerankDetail {
  model: string;
  path: string;
  numDocsToRerank: number;
}

export interface QueryInsight {
  pattern: QueryPattern;
  collection: string;
  index?: string;
  query_excerpt: string;
  rank_fusion_legs?: RankFusionLegDetail[];
  rerank?: RerankDetail;
  /** AMS tools may emit an operation label instead of/alongside pattern */
  operation?: string;
  /** AMS tools may emit a human-readable note */
  note?: string;
}

// ─── Shared ToolEvent (superset of VE + AMS shapes) ──────────────────────────

export interface ToolEvent {
  id: string;
  tool: string;
  args: Record<string, unknown>;
  result?: Record<string, unknown>;
  latency_ms?: number;
  query_insight?: QueryInsight | null;
  /** AMS-specific: coarse pattern string emitted by sales orchestrator */
  pattern?: string | null;
  timestamp: number;
  round?: number;
}

// ─── VE-specific types ────────────────────────────────────────────────────────

export interface EvidenceZone {
  asset?: unknown;
  alarms?: unknown;
  telemetry?: unknown;
  service_history?: unknown;
  knowledge?: unknown;
  similar_cases?: unknown;
  recommendation?: unknown;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
}

export interface Scenario {
  chillerId: string;
  label: string;
  alarm: string;
  description: string;
  prompts: string[];
}

export const SCENARIOS: Scenario[] = [
  {
    chillerId: "CH-ATL-003",
    label: "Hero — Motor Temperature",
    alarm: "A1.01",
    description: "30XA at Piedmont Hospital — repeat compressor motor temp fault with prior PTC replacement.",
    prompts: [
      "I'm on site at CH-ATL-003. What should I check first?",
      "Show me telemetry trends and prior service history for CH-ATL-003.",
    ],
  },
  {
    chillerId: "CH-DAL-002",
    label: "High Condenser Pressure",
    alarm: "207",
    description: "19XR water-cooled unit — alarm 207, cooling tower fan issue suspected.",
    prompts: [
      "CH-DAL-002 tripped on alarm 207. Data hall temps are rising. Help me troubleshoot.",
      "Have we seen this condenser pressure issue on CH-DAL-002 before?",
    ],
  },
  {
    chillerId: "CH-PHX-005",
    label: "Communication Fault",
    alarm: "Co.A1",
    description: "30RB at semiconductor fab — Co.A1 LEN bus communication loss.",
    prompts: [
      "CH-PHX-005 is offline with Co.A1 communication fault. What's the likely cause?",
      "Find similar communication fault cases and relevant technical bulletins for CH-PHX-005.",
    ],
  },
  {
    chillerId: "CH-ATL-001",
    label: "Stable Unit (PM)",
    alarm: "—",
    description: "Healthy 30RB — preventive maintenance history, no active faults.",
    prompts: [
      "Check the status of CH-ATL-001. Any active alarms or recent issues?",
      "Summarize service history and current operating state for CH-ATL-001.",
    ],
  },
];

// ─── AMS-specific types ───────────────────────────────────────────────────────

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

export interface EvidenceUpdate {
  zone: SalesZone;
  tool: string;
  summary: unknown;
  evidence_refs: Array<{ collection: string; id: string }>;
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

export const SALES_SCENARIOS: {
  id: string;
  label: string;
  customerName: string;
  siteName: string;
  customer_id: string;
  chiller_id: string;
  prompts: string[];
}[] = [
  {
    id: "efficiency_drift",
    label: "Efficiency Drift",
    customerName: "Brookfield",
    siteName: "Peachtree Tower",
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
    customerName: "Northwestern",
    siteName: "Tech Institute",
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
    customerName: "Equinix",
    siteName: "Lone Star DC",
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
    customerName: "Piedmont Healthcare",
    siteName: "Medical Center",
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
    customerName: "Equinix",
    siteName: "Lone Star DC",
    customer_id: "CUST-002",
    chiller_id: "CH-DAL-002",
    prompts: [
      "How does CH-DAL-002 compare to its install-year cohort? Identify upgrade opportunities.",
    ],
  },
];
