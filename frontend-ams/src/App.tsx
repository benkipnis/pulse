import { useState } from "react";
import { SalesProvider } from "./context/SalesContext";
import { FleetIntelligenceTab } from "./tabs/FleetIntelligenceTab";
import { OpportunityBuilderTab } from "./tabs/OpportunityBuilderTab";
import { PipelineTab } from "./tabs/PipelineTab";

const TABS = [
  { id: "fleet", label: "Fleet Intelligence" },
  { id: "builder", label: "Opportunity Builder" },
  { id: "pipeline", label: "Pipeline" },
] as const;

type TabId = (typeof TABS)[number]["id"];

function AppShell() {
  const [tab, setTab] = useState<TabId>("fleet");

  return (
    <>
      <header className="app-header">
        <div>
          <h1>Aftermarket Sales Intelligence</h1>
          <div className="subtitle">Powered by MongoDB Atlas · Virtual Engineer v2.0</div>
        </div>
        <div className="header-badge">
          <span className="header-badge-ve">VE API :3100</span>
        </div>
      </header>

      <nav className="tab-bar">
        {TABS.map((t) => (
          <button
            key={t.id}
            className={`tab-btn ${tab === t.id ? "active" : ""}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </nav>

      <main className="tab-content">
        {tab === "fleet" && <FleetIntelligenceTab />}
        {tab === "builder" && <OpportunityBuilderTab />}
        {tab === "pipeline" && <PipelineTab />}
      </main>
    </>
  );
}

export default function App() {
  return (
    <SalesProvider>
      <AppShell />
    </SalesProvider>
  );
}
