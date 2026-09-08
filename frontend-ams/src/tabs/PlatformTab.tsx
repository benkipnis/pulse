import { useChat } from "../context/ChatContext";
import { useSales } from "../context/SalesContext";

// ─── Platform Diagram ─────────────────────────────────────────────────────────

function PlatformDiagram() {
  const box = (
    bg: string,
    border: string,
    text: string,
    sub?: string,
    textColor = "#023430"
  ) => (
    <div
      style={{
        background: bg,
        border: `1.5px solid ${border}`,
        borderRadius: 8,
        padding: "10px 16px",
        textAlign: "center",
        color: textColor,
        minWidth: 0,
        flex: "1 1 0",
      }}
    >
      <div style={{ fontWeight: 700, fontSize: "0.88rem" }}>{text}</div>
      {sub && (
        <div style={{ fontSize: "0.68rem", opacity: 0.75, marginTop: 2 }}>{sub}</div>
      )}
    </div>
  );

  const arrow = (label: string, vertical = false) => (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
        color: "#5c6c75",
        fontSize: "0.65rem",
        gap: 2,
        padding: vertical ? "4px 8px" : "0 6px",
      }}
    >
      {label && <span style={{ whiteSpace: "nowrap" }}>{label}</span>}
      <span style={{ fontSize: "1rem" }}>{vertical ? "↓" : "⇄"}</span>
    </div>
  );

  return (
    <div style={{ fontFamily: "inherit" }}>
      {/* Top row: two agents */}
      <div style={{ display: "flex", gap: "1rem", marginBottom: "0.5rem" }}>
        <div
          style={{
            flex: 1,
            border: "1.5px solid #00684a",
            borderRadius: 10,
            padding: "12px 14px",
            background: "#e8faf0",
          }}
        >
          <div
            style={{
              fontSize: "0.65rem",
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              color: "#00684a",
              marginBottom: 8,
            }}
          >
            Virtual Engineer Agent · 20 tools (6 shared + 14 VE-only)
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 0, flexWrap: "wrap" }}>
            {box("#fff", "#90a4ae", "Field Engineer", "on-site")}
            {arrow("prompt")}
            {box("#e8faf0", "#00684a", "VE UI", "Virtual Engineer section")}
            {arrow("SSE")}
            {box("#fff8e1", "#f57f17", "LLM Agent", "OpenAI / Anthropic")}
            {arrow("tool calls")}
            {box("#e8faf0", "#00684a", "MCP", "20 tools")}
          </div>
        </div>

        <div
          style={{
            flex: 1,
            border: "1.5px solid #7b1fa2",
            borderRadius: 10,
            padding: "12px 14px",
            background: "#f3e5f5",
          }}
        >
          <div
            style={{
              fontSize: "0.65rem",
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              color: "#7b1fa2",
              marginBottom: 8,
            }}
          >
            Sales Intelligence Agent · 22 tools (6 shared + 16 AMS-only)
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 0, flexWrap: "wrap" }}>
            {box("#fff", "#90a4ae", "Sales Rep", "strategic")}
            {arrow("prompt")}
            {box("#f3e5f5", "#7b1fa2", "AMS UI", "Sales Intelligence section")}
            {arrow("SSE")}
            {box("#fff8e1", "#f57f17", "LLM Agent", "OpenAI / Anthropic")}
            {arrow("tool calls")}
            {box("#f3e5f5", "#7b1fa2", "MCP", "22 tools")}
          </div>
        </div>
      </div>

      {/* Arrow down to shared layer */}
      <div style={{ display: "flex", justifyContent: "center", margin: "2px 0" }}>
        {arrow("same Express server :3100", true)}
      </div>

      {/* Middle: shared MCP + backend */}
      <div
        style={{
          border: "2px dashed #00ed64",
          borderRadius: 10,
          padding: "12px 14px",
          background: "rgba(0,237,100,0.04)",
          marginBottom: "0.5rem",
        }}
      >
        <div
          style={{
            fontSize: "0.65rem",
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: "0.08em",
            color: "#00684a",
            marginBottom: 8,
          }}
        >
          Shared MCP Server · Node.js + Express · :3100 · 36 unique tools
        </div>
        <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
          {box("#e8faf0", "#00684a", "6 Shared Tools", "asset lookup · alarms · service history\nboth agents use these")}
          {box("#e8faf0", "#00684a", "14 VE-Only Tools", "diagnostics · manuals · cases\nfield-service specific")}
          {box("#f3e5f5", "#7b1fa2", "16 AMS-Only Tools", "fleet trends · catalog · pipeline\ncommercial specific")}
        </div>
      </div>

      {/* Arrow down to Atlas */}
      <div style={{ display: "flex", justifyContent: "center", margin: "2px 0" }}>
        {arrow("MongoDB Node.js driver", true)}
      </div>

      {/* Bottom: MongoDB Atlas */}
      <div
        style={{
          border: "2px solid #00684a",
          borderRadius: 10,
          padding: "12px 14px",
          background: "#023430",
          color: "#fff",
        }}
      >
        <div
          style={{
            fontSize: "0.65rem",
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: "0.08em",
            color: "#00ed64",
            marginBottom: 8,
          }}
        >
          MongoDB Atlas · virtual_engineer database · 12 collections
        </div>
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
          {[
            ["Database", "chillers · sites · alarms · telemetry · tickets"],
            ["Time-Series", "telemetry collection\nhourly readings"],
            ["Vector Search", "autoEmbed · voyage-4\nknowledge + parts"],
            ["Atlas Search", "$rankFusion + $rerank\nhybrid recall"],
            ["$graphLookup", "equipment_topology\nconnected assets"],
            ["Aggregations", "$setWindowFields\n$group · $lookup"],
          ].map(([title, sub]) => (
            <div
              key={title}
              style={{
                background: "rgba(255,255,255,0.07)",
                border: "1px solid rgba(0,237,100,0.3)",
                borderRadius: 6,
                padding: "6px 10px",
                fontSize: "0.75rem",
                color: "#c8e6c9",
                flex: "1 1 120px",
                minWidth: 0,
              }}
            >
              <div style={{ fontWeight: 700, color: "#00ed64", marginBottom: 2 }}>{title}</div>
              <div style={{ fontSize: "0.65rem", opacity: 0.8, whiteSpace: "pre-line" }}>{sub}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

const SHARED_TOOLS = [
  {
    name: "getChillerById",
    desc: "Resolve a unit's model, install date, rated capacity, and configuration",
    veUse: "First step in every diagnostic — establish the asset before reasoning",
    amsUse: "Unit-level context before running pattern detection",
  },
  {
    name: "getSiteContext",
    desc: "Retrieve site metadata, building type, and customer association",
    veUse: "Grounds the field engineer in the physical site and operating environment",
    amsUse: "Customer context for opportunity framing and prioritization",
  },
  {
    name: "getActiveAlarms",
    desc: "Current active alarms on a unit with severity and codes",
    veUse: "Core diagnostic signal — alarms drive the troubleshooting path",
    amsUse: "Active alarms surface urgent sales opportunities (immediate downtime risk)",
  },
  {
    name: "getAlarmHistory",
    desc: "Historical alarm events filtered by unit, category, and time window",
    veUse: "Identify recurring fault patterns and confirm intermittent issues",
    amsUse: "Recurring alarm patterns reinforce pre-fault and repeat-failure opportunities",
  },
  {
    name: "getServiceHistory",
    desc: "Full maintenance and repair ticket history for a unit",
    veUse: "Prior tickets reveal root causes and technician notes for current fault",
    amsUse: "Service timeline shows age of last repair, PM gaps, and repeat-failure risk",
  },
  {
    name: "getPartsHistory",
    desc: "All parts replaced across a unit's service history",
    veUse: "Confirms prior component replacements and guides part selection",
    amsUse: "Repeated part replacements signal design-limit failures — upgrade opportunity",
  },
];

function SharedToolsSection() {
  return (
    <div
      style={{
        background: "var(--mongo-white)",
        border: "2px solid #00684a",
        borderRadius: 10,
        padding: "1.1rem 1.25rem",
      }}
    >
      <div style={{ display: "flex", alignItems: "baseline", gap: "0.75rem", marginBottom: "0.85rem" }}>
        <h3 style={{ margin: 0, fontSize: "0.95rem", fontWeight: 700, color: "#00684a" }}>
          6 Shared Foundation Tools
        </h3>
        <span style={{ fontSize: "0.78rem", color: "var(--mongo-gray)" }}>
          Used by both Virtual Engineer and Sales Intelligence — inherited by every future agent
        </span>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gap: "0.65rem" }}>
        {SHARED_TOOLS.map((t) => (
          <div
            key={t.name}
            style={{
              background: "#f0faf6",
              border: "1px solid #b2dfdb",
              borderRadius: 7,
              padding: "0.65rem 0.85rem",
              display: "flex",
              flexDirection: "column",
              gap: "0.35rem",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <code style={{ fontSize: "0.8rem", fontWeight: 700, color: "#00684a" }}>{t.name}</code>
              <span
                style={{
                  fontSize: "0.62rem",
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: "0.07em",
                  background: "#00684a",
                  color: "#fff",
                  borderRadius: 3,
                  padding: "1px 5px",
                }}
              >
                shared
              </span>
            </div>
            <div style={{ fontSize: "0.78rem", color: "var(--mongo-slate)", lineHeight: 1.4 }}>
              {t.desc}
            </div>
            <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginTop: "0.15rem" }}>
              <div
                style={{
                  fontSize: "0.7rem",
                  background: "#e8faf0",
                  border: "1px solid #00684a30",
                  borderRadius: 4,
                  padding: "2px 6px",
                  color: "#00684a",
                  lineHeight: 1.4,
                  flex: "1 1 0",
                }}
              >
                <strong>VE:</strong> {t.veUse}
              </div>
              <div
                style={{
                  fontSize: "0.7rem",
                  background: "#f3e5f5",
                  border: "1px solid #7b1fa230",
                  borderRadius: 4,
                  padding: "2px 6px",
                  color: "#7b1fa2",
                  lineHeight: 1.4,
                  flex: "1 1 0",
                }}
              >
                <strong>AMS:</strong> {t.amsUse}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}



const CAPABILITIES = [
  {
    title: "Time-Series Analysis",
    icon: "📈",
    color: "#e8f5e9",
    border: "#2e7d32",
    textColor: "#1b5e20",
    agents: ["Virtual Engineer", "Sales Intelligence"],
    tools: ["getTelemetry", "getUnitEfficiencyTrend", "getApproachTempTrend", "getFleetCohortAnalysis"],
    query: "$setWindowFields rolling averages over configurable lookback windows",
    pattern: "time_series_window",
  },
  {
    title: "Atlas Full-Text Search",
    icon: "🔍",
    color: "#fce4ec",
    border: "#c62828",
    textColor: "#4a0010",
    agents: ["Virtual Engineer", "Sales Intelligence"],
    tools: ["searchManuals", "searchTroubleshootingGuides", "searchPartsCatalog", "searchServiceOfferings"],
    query: "$search compound operator with fuzzy matching on text + token fields",
    pattern: "atlas_search",
  },
  {
    title: "Vector + Hybrid Search",
    icon: "🧠",
    color: "#fff3e0",
    border: "#e65100",
    textColor: "#4e2600",
    agents: ["Virtual Engineer", "Sales Intelligence"],
    tools: ["searchManuals", "searchCaseNotes", "searchPartsCatalog"],
    query: "$vectorSearch + $rankFusion + Voyage $rerank — semantic recall with precision reranking",
    pattern: "hybrid_search",
  },
  {
    title: "Graph Traversal",
    icon: "🔗",
    color: "#f3e5f5",
    border: "#7b1fa2",
    textColor: "#4a148c",
    agents: ["Sales Intelligence"],
    tools: ["getConnectedEquipmentGraph", "getRelatedPartsBundle"],
    query: "$graphLookup on equipment_topology — surfaces related assets, downstream dependencies",
    pattern: "aggregation_lookup",
  },
  {
    title: "Aggregation Pipelines",
    icon: "⚙️",
    color: "#e3f2fd",
    border: "#1565c0",
    textColor: "#0d47a1",
    agents: ["Virtual Engineer", "Sales Intelligence"],
    tools: ["getFleetAlarmSummary", "scanForPreFaultPatterns", "getFleetCohortAnalysis", "getAlarmHistory"],
    query: "Multi-stage $match → $group → $sort → $limit with $lookup joins across collections",
    pattern: "aggregation_lookup",
  },
  {
    title: "Indexed CRUD",
    icon: "🗄️",
    color: "#e8faf0",
    border: "#00684a",
    textColor: "#023430",
    agents: ["Virtual Engineer", "Sales Intelligence"],
    tools: ["getChillerById", "getCustomerFleet", "getServiceHistory", "createSalesOpportunity"],
    query: "Compound indexes on chiller_id, customer_id, status — sub-millisecond asset resolution",
    pattern: "exact_find",
  },
];

function CapabilityCard({
  cap,
}: {
  cap: (typeof CAPABILITIES)[number];
}) {
  return (
    <div
      style={{
        background: cap.color,
        border: `1.5px solid ${cap.border}`,
        borderRadius: 10,
        padding: "1rem 1.1rem",
        display: "flex",
        flexDirection: "column",
        gap: "0.5rem",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
        <span style={{ fontSize: "1.2rem" }}>{cap.icon}</span>
        <strong style={{ color: cap.textColor, fontSize: "0.92rem" }}>{cap.title}</strong>
      </div>

      <div style={{ display: "flex", gap: "0.3rem", flexWrap: "wrap" }}>
        {cap.agents.map((a) => (
          <span
            key={a}
            style={{
              fontSize: "0.68rem",
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              background: "rgba(0,0,0,0.08)",
              color: cap.textColor,
              borderRadius: 4,
              padding: "1px 6px",
            }}
          >
            {a === "Virtual Engineer" ? "VE" : "AMS"}
          </span>
        ))}
      </div>

      <div
        style={{
          fontSize: "0.78rem",
          color: cap.textColor,
          opacity: 0.85,
          fontStyle: "italic",
          lineHeight: 1.45,
        }}
      >
        {cap.query}
      </div>

      <div style={{ display: "flex", gap: "0.25rem", flexWrap: "wrap" }}>
        {cap.tools.map((t) => (
          <code
            key={t}
            style={{
              fontSize: "0.68rem",
              background: "rgba(0,0,0,0.06)",
              borderRadius: 3,
              padding: "1px 5px",
              color: cap.textColor,
            }}
          >
            {t}
          </code>
        ))}
      </div>
    </div>
  );
}

// ─── Future Agents ────────────────────────────────────────────────────────────

const FUTURE_AGENTS = [
  {
    name: "Procurement Intelligence",
    icon: "📦",
    tagline: "Optimize spare parts inventory and supplier selection based on fleet failure patterns",
    collectionsReused: ["parts_catalog", "service_tickets", "chillers", "telemetry"],
    collectionsNew: ["purchase_orders", "supplier_catalog"],
    toolsNeeded: "Inherits 6 shared tools + ~8 new tools",
    color: "#e3f2fd",
    border: "#1565c0",
    textColor: "#0d47a1",
  },
  {
    name: "Warranty Claims AI",
    icon: "🛡️",
    tagline: "Automatically qualify warranty claims against service history and alarm events",
    collectionsReused: ["alarm_events", "service_tickets", "chillers", "knowledge_documents"],
    collectionsNew: ["warranty_contracts", "claims"],
    toolsNeeded: "Inherits 6 shared tools + ~6 new tools",
    color: "#fff8e1",
    border: "#f57f17",
    textColor: "#5d4037",
  },
  {
    name: "Executive Intelligence",
    icon: "📊",
    tagline: "Fleet-level KPIs, energy benchmarking, and portfolio health scoring for leadership",
    collectionsReused: ["all 12 existing collections"],
    collectionsNew: ["energy_benchmarks"],
    toolsNeeded: "Inherits 6 shared tools + ~4 new tools",
    color: "#f3e5f5",
    border: "#7b1fa2",
    textColor: "#4a148c",
  },
];

function FutureAgentCard({ agent }: { agent: (typeof FUTURE_AGENTS)[number] }) {
  return (
    <div
      style={{
        background: agent.color,
        border: `1.5px dashed ${agent.border}`,
        borderRadius: 10,
        padding: "1rem 1.1rem",
        display: "flex",
        flexDirection: "column",
        gap: "0.6rem",
        flex: "1 1 0",
        minWidth: 240,
        opacity: 0.9,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
        <span style={{ fontSize: "1.3rem" }}>{agent.icon}</span>
        <div>
          <div style={{ fontWeight: 700, fontSize: "0.9rem", color: agent.textColor }}>
            {agent.name}
          </div>
          <div
            style={{
              fontSize: "0.68rem",
              fontWeight: 600,
              textTransform: "uppercase",
              letterSpacing: "0.06em",
              color: agent.border,
              marginTop: 1,
            }}
          >
            Coming soon
          </div>
        </div>
      </div>

      <p style={{ margin: 0, fontSize: "0.82rem", color: agent.textColor, lineHeight: 1.5 }}>
        {agent.tagline}
      </p>

      <div>
        <div
          style={{
            fontSize: "0.68rem",
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: "0.05em",
            color: agent.textColor,
            opacity: 0.7,
            marginBottom: 4,
          }}
        >
          Reuses existing collections
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.25rem" }}>
          {agent.collectionsReused.map((c) => (
            <code
              key={c}
              style={{
                fontSize: "0.68rem",
                background: "rgba(0,0,0,0.08)",
                borderRadius: 3,
                padding: "1px 5px",
                color: agent.textColor,
              }}
            >
              {c}
            </code>
          ))}
        </div>
      </div>

      <div>
        <div
          style={{
            fontSize: "0.68rem",
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: "0.05em",
            color: agent.textColor,
            opacity: 0.7,
            marginBottom: 4,
          }}
        >
          New collections needed
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.25rem" }}>
          {agent.collectionsNew.map((c) => (
            <code
              key={c}
              style={{
                fontSize: "0.68rem",
                background: "rgba(0,0,0,0.12)",
                borderRadius: 3,
                padding: "1px 5px",
                color: agent.textColor,
                fontStyle: "italic",
              }}
            >
              {c}
            </code>
          ))}
        </div>
      </div>

      <div
        style={{
          fontSize: "0.78rem",
          fontWeight: 600,
          color: agent.border,
          borderTop: `1px solid ${agent.border}30`,
          paddingTop: "0.5rem",
          marginTop: "auto",
        }}
      >
        {agent.toolsNeeded} · no DB schema changes required
      </div>
    </div>
  );
}

// ─── Live Session Counter ─────────────────────────────────────────────────────

function SessionCounter() {
  const { toolEvents: veEvents } = useChat();
  const { toolEvents: amsEvents } = useSales();

  const veCount = veEvents.filter((e) => e.result).length;
  const amsCount = amsEvents.filter((e) => e.result).length;
  const total = veCount + amsCount;

  const capabilities = new Set<string>();
  [...veEvents, ...amsEvents].forEach((e) => {
    const p = e.query_insight?.pattern;
    if (p) capabilities.add(p);
  });

  const stats = [
    { label: "Agents Active", value: "2" },
    { label: "MCP Tools Total", value: "36" },
    { label: "Shared Tools", value: "6", highlight: true },
    { label: "VE-Only Tools", value: "14" },
    { label: "AMS-Only Tools", value: "16" },
    { label: "Collections", value: "12" },
    { label: "Tool Calls This Session", value: String(total), highlight: total > 0 },
    { label: "Query Patterns Used", value: String(capabilities.size), highlight: capabilities.size > 0 },
  ];

  return (
    <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
      {stats.map((s) => (
        <div
          key={s.label}
          style={{
            background: s.highlight ? "#e8faf0" : "var(--mongo-white)",
            border: `1px solid ${s.highlight ? "#00684a" : "var(--mongo-border)"}`,
            borderRadius: 8,
            padding: "0.65rem 1.1rem",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 2,
            minWidth: 100,
          }}
        >
          <span
            style={{
              fontSize: "1.6rem",
              fontWeight: 700,
              lineHeight: 1,
              color: s.highlight ? "#00684a" : "var(--mongo-slate)",
            }}
          >
            {s.value}
          </span>
          <span
            style={{
              fontSize: "0.68rem",
              color: "var(--mongo-gray)",
              textTransform: "uppercase",
              letterSpacing: "0.04em",
              fontWeight: 600,
              textAlign: "center",
            }}
          >
            {s.label}
          </span>
        </div>
      ))}
    </div>
  );
}

// ─── Main PlatformTab ─────────────────────────────────────────────────────────

export function PlatformTab() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>
      {/* ── Hero intro ── */}
      <div
        style={{
          background: "var(--mongo-slate)",
          borderRadius: 12,
          padding: "1.5rem 2rem",
          color: "#fff",
        }}
      >
        <h2 style={{ margin: "0 0 0.5rem", fontSize: "1.3rem", color: "#00ed64" }}>
          One Platform. Any Agent.
        </h2>
        <p style={{ margin: 0, fontSize: "0.9rem", lineHeight: 1.65, maxWidth: 780, color: "#c8e6c9" }}>
        Both agents — Virtual Engineer and Sales Intelligence — share a single MongoDB Atlas
        database, a single MCP server, and <strong style={{ color: "#00ed64" }}>6 shared foundation tools</strong> that
        any equipment agent would use. Adding a third agent means inheriting those 6 tools
        immediately and only building the domain-specific ones. The 36 unique tools today break
        down as: 6 shared, 14 VE-only, 16 AMS-only. MongoDB's multi-model capabilities make
        this possible: time-series, vector search, full-text search, graph traversal, and
        complex aggregations all live in one cluster.
        </p>
      </div>

      {/* ── Live session stats ── */}
      <div>
        <h3
          style={{
            margin: "0 0 0.75rem",
            fontSize: "0.78rem",
            textTransform: "uppercase",
            letterSpacing: "0.05em",
            color: "var(--mongo-gray)",
          }}
        >
          Platform Stats · Live Session
        </h3>
        <SessionCounter />
      </div>

      {/* ── Architecture diagram ── */}
      <div>
        <h3
          style={{
            margin: "0 0 0.75rem",
            fontSize: "0.78rem",
            textTransform: "uppercase",
            letterSpacing: "0.05em",
            color: "var(--mongo-gray)",
          }}
        >
          Architecture
        </h3>
        <PlatformDiagram />
      </div>

      {/* ── Shared foundation tools ── */}
      <div>
        <SharedToolsSection />
      </div>

      {/* ── MongoDB capabilities ── */}
      <div>
        <h3
          style={{
            margin: "0 0 0.75rem",
            fontSize: "0.78rem",
            textTransform: "uppercase",
            letterSpacing: "0.05em",
            color: "var(--mongo-gray)",
          }}
        >
          MongoDB Capabilities in Use
        </h3>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
            gap: "1rem",
          }}
        >
          {CAPABILITIES.map((cap) => (
            <CapabilityCard key={cap.title} cap={cap} />
          ))}
        </div>
      </div>

      {/* ── Future agents ── */}
      <div>
        <h3
          style={{
            margin: "0 0 0.4rem",
            fontSize: "0.78rem",
            textTransform: "uppercase",
            letterSpacing: "0.05em",
            color: "var(--mongo-gray)",
          }}
        >
          What's Next — Future Agents
        </h3>
        <p
          style={{
            margin: "0 0 0.85rem",
            fontSize: "0.85rem",
            color: "var(--mongo-gray)",
            maxWidth: 680,
          }}
        >
          Each future agent reuses the existing database and MCP infrastructure. New agents only
          need new tool implementations — the platform scales horizontally without architectural
          changes.
        </p>
        <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap" }}>
          {FUTURE_AGENTS.map((a) => (
            <FutureAgentCard key={a.name} agent={a} />
          ))}
        </div>
      </div>
    </div>
  );
}
