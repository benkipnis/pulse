import { useState } from "react";
import { ChatProvider } from "./context/ChatContext";
import { SalesProvider } from "./context/SalesContext";
// VE tabs
import { OverviewTab } from "./tabs/OverviewTab";
import { EvidenceBoardTab } from "./tabs/EvidenceBoardTab";
import { FieldChatTab } from "./tabs/FieldChatTab";
// AMS tabs
import { FleetIntelligenceTab } from "./tabs/FleetIntelligenceTab";
import { OpportunityBuilderTab } from "./tabs/OpportunityBuilderTab";
import { PipelineTab } from "./tabs/PipelineTab";
// Platform tab
import { PlatformTab } from "./tabs/PlatformTab";

type Section = "ve" | "ams" | "platform";
type VETab = "overview" | "evidence" | "field";
type AMSTab = "fleet" | "builder" | "pipeline";

const VE_TABS: { id: VETab; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "evidence", label: "Evidence Board" },
  { id: "field", label: "Field Chat" },
];

const AMS_TABS: { id: AMSTab; label: string }[] = [
  { id: "fleet", label: "Fleet Intelligence" },
  { id: "builder", label: "Opportunity Builder" },
  { id: "pipeline", label: "Pipeline" },
];

function AppShell() {
  const [section, setSection] = useState<Section>("ve");
  const [veTab, setVeTab] = useState<VETab>("overview");
  const [amsTab, setAmsTab] = useState<AMSTab>("fleet");

  return (
    <>
      <header className="app-header">
        <div>
          <h1>PULSE</h1>
          <div className="subtitle">Equipment Intelligence Platform · Powered by MongoDB Atlas</div>
        </div>
        <nav className="section-nav">
          <button
            className={`section-btn${section === "ve" ? " active" : ""}`}
            onClick={() => setSection("ve")}
          >
            Virtual Engineer
          </button>
          <button
            className={`section-btn${section === "ams" ? " active" : ""}`}
            onClick={() => setSection("ams")}
          >
            Sales Intelligence
          </button>
          <button
            className={`section-btn${section === "platform" ? " active" : ""}`}
            onClick={() => setSection("platform")}
          >
            Platform
          </button>
        </nav>
      </header>

      {section === "ve" && (
        <nav className="tab-bar">
          {VE_TABS.map((t) => (
            <button
              key={t.id}
              className={`tab-btn${veTab === t.id ? " active" : ""}`}
              onClick={() => setVeTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </nav>
      )}

      {section === "ams" && (
        <nav className="tab-bar">
          {AMS_TABS.map((t) => (
            <button
              key={t.id}
              className={`tab-btn${amsTab === t.id ? " active" : ""}`}
              onClick={() => setAmsTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </nav>
      )}

      <main className="tab-content">
        {section === "ve" && veTab === "overview" && (
          <OverviewTab onNavigate={(id) => setVeTab(id as VETab)} />
        )}
        {section === "ve" && veTab === "evidence" && <EvidenceBoardTab />}
        {section === "ve" && veTab === "field" && <FieldChatTab />}

        {section === "ams" && amsTab === "fleet" && <FleetIntelligenceTab />}
        {section === "ams" && amsTab === "builder" && <OpportunityBuilderTab />}
        {section === "ams" && amsTab === "pipeline" && <PipelineTab />}

        {section === "platform" && <PlatformTab />}
      </main>
    </>
  );
}

export default function App() {
  return (
    <ChatProvider>
      <SalesProvider>
        <AppShell />
      </SalesProvider>
    </ChatProvider>
  );
}
