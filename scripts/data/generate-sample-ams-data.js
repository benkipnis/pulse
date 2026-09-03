#!/usr/bin/env node
/**
 * Generate sample data for the 5 new AMS-only collections:
 *   - parts_catalog        (~30 parts)
 *   - service_offerings    (~15 offerings)
 *   - equipment_topology   (chiller → subsystem graph for all 5 units)
 *   - sales_opportunities  (~8 seeded opportunities to show a live pipeline)
 *   - sales_sessions       (2 sample rep sessions)
 *
 * Output: writes JSON files to scripts/data/samples/ams/
 */

import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(__dirname, "samples", "ams");
mkdirSync(OUT_DIR, { recursive: true });

// ─── Parts Catalog ────────────────────────────────────────────────────────────

const PARTS_CATALOG = [
  // Maintenance
  {
    part_id: "PART-001",
    part_number: "30RB-FLTR-KIT-A",
    description: "Condenser coil cleaning kit — includes biodegradable coil cleaner (4L), foam brush applicator, and PPE",
    category: "maintenance",
    compatible_model_families: ["30RB", "30XA", "30GX"],
    typical_replacement_interval_years: 1,
    list_price_usd: 185.00,
    content: "condenser coil cleaning kit biodegradable cleaner maintenance air cooled chiller",
    tags: ["condenser", "cleaning", "maintenance", "air_cooled"],
    lead_time_days: 2,
  },
  {
    part_id: "PART-002",
    part_number: "30RB-RFGR-R410A-30LB",
    description: "R-410A refrigerant recharge cylinder 30 lb — factory-certified for AquaSnap / AquaForce series",
    category: "maintenance",
    compatible_model_families: ["30RB", "30XA"],
    typical_replacement_interval_years: 3,
    list_price_usd: 520.00,
    content: "refrigerant R-410A recharge cylinder refrigerant top-up efficiency restoration",
    tags: ["refrigerant", "R410A", "recharge", "efficiency"],
    lead_time_days: 3,
  },
  {
    part_id: "PART-003",
    part_number: "19XR-RFGR-R134A-50LB",
    description: "R-134a refrigerant cylinder 50 lb — for Evergreen 19XR centrifugal chillers",
    category: "maintenance",
    compatible_model_families: ["19XR"],
    typical_replacement_interval_years: 4,
    list_price_usd: 680.00,
    content: "refrigerant R-134a recharge cylinder centrifugal chiller Evergreen",
    tags: ["refrigerant", "R134a", "centrifugal", "recharge"],
    lead_time_days: 3,
  },
  {
    part_id: "PART-004",
    part_number: "30XA-FLTR-01",
    description: "Air inlet filter set (2-pack) — 30XA AquaForce, replaces every 12 months in typical commercial environments",
    category: "maintenance",
    compatible_model_families: ["30XA"],
    typical_replacement_interval_years: 1,
    list_price_usd: 95.00,
    content: "air inlet filter replacement annual maintenance AquaForce 30XA",
    tags: ["filter", "air_inlet", "annual_maintenance", "30XA"],
    lead_time_days: 2,
  },
  {
    part_id: "PART-005",
    part_number: "30RB-OIL-KIT",
    description: "Compressor oil and desiccant filter change kit — AquaSnap 30RB scroll compressor",
    category: "maintenance",
    compatible_model_families: ["30RB"],
    typical_replacement_interval_years: 2,
    list_price_usd: 245.00,
    content: "compressor oil change desiccant filter kit scroll compressor maintenance 30RB",
    tags: ["oil", "desiccant", "filter", "scroll_compressor"],
    lead_time_days: 3,
  },
  // Repair
  {
    part_id: "PART-006",
    part_number: "00PPG000012200A",
    description: "Motor temperature PTC sensor — Circuit A, compatible with 30XA AquaForce compressor circuits",
    category: "repair",
    compatible_model_families: ["30XA", "30RB"],
    typical_replacement_interval_years: 5,
    list_price_usd: 320.00,
    content: "motor temperature sensor PTC thermistor circuit A compressor protection",
    tags: ["sensor", "motor_temp", "PTC", "compressor_protection"],
    lead_time_days: 2,
  },
  {
    part_id: "PART-007",
    part_number: "30XA-COMP-A-SEAL",
    description: "Compressor shaft seal kit — 30XA Circuit A scroll compressor, recommended after high-temperature events",
    category: "repair",
    compatible_model_families: ["30XA"],
    typical_replacement_interval_years: 7,
    list_price_usd: 890.00,
    content: "shaft seal compressor repair kit scroll high temperature event 30XA",
    tags: ["seal", "shaft_seal", "compressor", "repair"],
    lead_time_days: 5,
  },
  {
    part_id: "PART-008",
    part_number: "30RB-BEAR-SET",
    description: "Compressor bearing replacement set — premium grade, extends service life vs OEM standard by 40%",
    category: "repair",
    compatible_model_families: ["30RB", "30XA"],
    typical_replacement_interval_years: 6,
    list_price_usd: 1240.00,
    content: "bearing replacement premium grade scroll compressor extended life repair",
    tags: ["bearing", "compressor", "premium", "extended_life"],
    lead_time_days: 7,
  },
  {
    part_id: "PART-009",
    part_number: "19XR-VANE-SET",
    description: "Inlet guide vane actuator assembly — 19XR centrifugal, commonly replaced after extended high-load operation",
    category: "repair",
    compatible_model_families: ["19XR"],
    typical_replacement_interval_years: 8,
    list_price_usd: 3200.00,
    content: "inlet guide vane actuator centrifugal compressor 19XR repair high load",
    tags: ["vane", "guide_vane", "actuator", "centrifugal"],
    lead_time_days: 10,
  },
  {
    part_id: "PART-010",
    part_number: "30RB-EXV-BODY",
    description: "Electronic expansion valve body assembly — 30RB / 30XA, replace when superheat control is erratic",
    category: "repair",
    compatible_model_families: ["30RB", "30XA"],
    typical_replacement_interval_years: 8,
    list_price_usd: 740.00,
    content: "electronic expansion valve EXV repair superheat control refrigerant circuit",
    tags: ["EXV", "expansion_valve", "superheat", "refrigerant_circuit"],
    lead_time_days: 4,
  },
  // Upgrade
  {
    part_id: "PART-011",
    part_number: "30RB-VFD-UPGRADE",
    description: "Variable frequency drive (VFD) fan motor upgrade kit — reduces fan energy 18-25% at part load. Retrofit for 30RB units installed before 2022.",
    category: "upgrade",
    compatible_model_families: ["30RB"],
    typical_replacement_interval_years: null,
    list_price_usd: 4800.00,
    content: "VFD variable frequency drive fan motor upgrade energy efficiency retrofit part load",
    tags: ["VFD", "fan_motor", "upgrade", "energy_efficiency", "retrofit"],
    lead_time_days: 14,
  },
  {
    part_id: "PART-012",
    part_number: "CTRL-OPTIVIEW-UPGRADE",
    description: "OptiView XE control panel upgrade — modern touch UI with remote diagnostics, energy dashboarding, and predictive alerts. Compatible with 30XA, 30RB, 19XR.",
    category: "upgrade",
    compatible_model_families: ["30XA", "30RB", "19XR"],
    typical_replacement_interval_years: null,
    list_price_usd: 7200.00,
    content: "OptiView XE controls upgrade modern touchscreen remote diagnostics energy dashboard predictive alerts",
    tags: ["controls", "OptiView", "touchscreen", "remote_diagnostics", "upgrade"],
    lead_time_days: 21,
  },
  {
    part_id: "PART-013",
    part_number: "30XA-HEATEX-ENHANCED",
    description: "Enhanced heat exchanger tube bundle — micro-grooved tubes improve heat transfer efficiency by 12% vs standard. Ideal for units showing high approach delta.",
    category: "upgrade",
    compatible_model_families: ["30XA", "30RB"],
    typical_replacement_interval_years: null,
    list_price_usd: 11500.00,
    content: "heat exchanger enhanced tube bundle micro-grooved heat transfer efficiency improvement approach delta upgrade",
    tags: ["heat_exchanger", "tube_bundle", "efficiency_upgrade", "approach_temp"],
    lead_time_days: 30,
  },
  {
    part_id: "PART-014",
    part_number: "19XR-IMPELLER-HI-EFF",
    description: "High-efficiency impeller set for 19XR centrifugal — factory-tuned for current refrigerant blend. Recovers 5-8% efficiency loss on units installed before 2022.",
    category: "upgrade",
    compatible_model_families: ["19XR"],
    typical_replacement_interval_years: null,
    list_price_usd: 15800.00,
    content: "impeller high efficiency centrifugal upgrade efficiency recovery refrigerant blend 19XR",
    tags: ["impeller", "centrifugal", "efficiency_upgrade", "refrigerant"],
    lead_time_days: 45,
  },
  {
    part_id: "PART-015",
    part_number: "CONN-REMOTELINK-KIT",
    description: "RemoteLink IoT gateway kit — adds remote monitoring, alarm notifications, and performance trending to any chiller with legacy controls.",
    category: "upgrade",
    compatible_model_families: ["30RB", "30XA", "19XR"],
    typical_replacement_interval_years: null,
    list_price_usd: 2400.00,
    content: "IoT gateway remote monitoring alarm notifications performance trending legacy controls connectivity",
    tags: ["IoT", "remote_monitoring", "connectivity", "upgrade"],
    lead_time_days: 5,
  },
  // Additional maintenance parts
  {
    part_id: "PART-016",
    part_number: "30XA-BELT-SET",
    description: "Condenser fan belt set (4-pack) — 30XA AquaForce, inspect every 12 months, replace at first sign of wear",
    category: "maintenance",
    compatible_model_families: ["30XA"],
    typical_replacement_interval_years: 2,
    list_price_usd: 140.00,
    content: "condenser fan belt set annual inspection replacement 30XA AquaForce",
    tags: ["belt", "fan", "maintenance", "inspection"],
    lead_time_days: 2,
  },
  {
    part_id: "PART-017",
    part_number: "19XR-TUBE-BRUSH-KIT",
    description: "Condenser tube brush cleaning kit — 19XR water-cooled. Removes scale and biofilm for restoring approach temperature delta.",
    category: "maintenance",
    compatible_model_families: ["19XR"],
    typical_replacement_interval_years: 1,
    list_price_usd: 310.00,
    content: "tube brush cleaning kit water cooled condenser scale biofilm approach temperature delta 19XR",
    tags: ["tube_brush", "condenser", "water_cooled", "scale", "approach_temp"],
    lead_time_days: 2,
  },
  {
    part_id: "PART-018",
    part_number: "30RB-CONTACTOR-KIT",
    description: "Compressor contactor and overload relay kit — 30RB dual-circuit. Replace at 40,000 hour intervals or following any electrical fault.",
    category: "repair",
    compatible_model_families: ["30RB"],
    typical_replacement_interval_years: 7,
    list_price_usd: 480.00,
    content: "compressor contactor overload relay electrical fault 30RB dual circuit replacement",
    tags: ["contactor", "overload_relay", "electrical", "repair"],
    lead_time_days: 3,
  },
];

// ─── Service Offerings ────────────────────────────────────────────────────────

const SERVICE_OFFERINGS = [
  {
    offering_id: "SVC-001",
    name: "Annual Preventive Maintenance Agreement",
    description: "Full-scope annual PM: refrigerant check, oil analysis, coil cleaning, controls calibration, safety device test. Labor + materials included.",
    category: "contract",
    applicable_model_families: ["30RB", "30XA", "19XR"],
    list_price_usd: 4800.00,
    triggers: ["pm_overdue", "contract_expiry"],
    content: "annual preventive maintenance PM agreement refrigerant oil coil cleaning controls calibration labor materials",
    tags: ["PM", "annual", "maintenance", "contract", "full_scope"],
  },
  {
    offering_id: "SVC-002",
    name: "Efficiency Recovery Audit",
    description: "2-day on-site efficiency evaluation: current kW/ton benchmarking, refrigerant charge verification, heat exchanger inspection, controls tuning. Written report with prioritized improvement actions.",
    category: "inspection",
    applicable_model_families: ["30RB", "30XA", "19XR"],
    list_price_usd: 2200.00,
    triggers: ["efficiency_drift", "fleet_cohort_outlier"],
    content: "efficiency recovery audit kW per ton benchmarking refrigerant charge heat exchanger inspection controls tuning",
    tags: ["efficiency", "audit", "benchmarking", "kW_per_ton"],
  },
  {
    offering_id: "SVC-003",
    name: "Condenser Deep Clean Service",
    description: "Professional condenser cleaning: chemical degreasing + high-pressure rinse for air-cooled coils; tube bundle brushing + water treatment check for water-cooled units. Restores approach temperature delta.",
    category: "maintenance",
    applicable_model_families: ["30RB", "30XA", "19XR"],
    list_price_usd: 1400.00,
    triggers: ["high_approach_temp", "efficiency_drift"],
    content: "condenser deep clean chemical degreasing high pressure rinse air cooled tube bundle water treatment approach temperature",
    tags: ["condenser", "deep_clean", "approach_temp", "tube_bundle", "water_cooled"],
  },
  {
    offering_id: "SVC-004",
    name: "Predictive Motor Health Assessment",
    description: "Vibration analysis + thermal imaging on compressor motors and bearings. Identifies pre-fault conditions 30-60 days before failure. Includes written assessment and recommended spares.",
    category: "inspection",
    applicable_model_families: ["30RB", "30XA"],
    list_price_usd: 1800.00,
    triggers: ["pre_fault_indicator"],
    content: "predictive motor health assessment vibration analysis thermal imaging compressor bearing pre-fault early warning",
    tags: ["predictive", "vibration", "thermal_imaging", "bearing", "motor"],
  },
  {
    offering_id: "SVC-005",
    name: "Refrigerant Recharge & Leak Check",
    description: "Refrigerant charge verification using superheat/subcooling measurements, electronic leak check (all access points), top-up service. Restores rated capacity and efficiency.",
    category: "maintenance",
    applicable_model_families: ["30RB", "30XA", "19XR"],
    list_price_usd: 1100.00,
    triggers: ["efficiency_drift", "pm_overdue"],
    content: "refrigerant recharge leak check superheat subcooling charge verification capacity efficiency restoration",
    tags: ["refrigerant", "recharge", "leak_check", "efficiency"],
  },
  {
    offering_id: "SVC-006",
    name: "ServiceEdge Advance Contract",
    description: "Premium multi-year service agreement: 24/7 remote monitoring, 4-hour emergency response, 2 PM visits/year, all parts and labor covered. Includes Carrier Connect IQ remote diagnostics.",
    category: "contract",
    applicable_model_families: ["30RB", "30XA", "19XR"],
    list_price_usd: 18000.00,
    triggers: ["contract_expiry", "pm_overdue"],
    content: "ServiceEdge Advance premium multi-year service agreement remote monitoring emergency response PM parts labor Carrier Connect",
    tags: ["ServiceEdge", "premium", "contract", "remote_monitoring", "emergency_response"],
  },
  {
    offering_id: "SVC-007",
    name: "ServiceEdge Optimum Contract",
    description: "Standard multi-year service agreement: remote monitoring, 8-hour emergency response, 1 PM visit/year, labor included, parts at cost. Good for facilities with in-house technicians.",
    category: "contract",
    applicable_model_families: ["30RB", "30XA", "19XR"],
    list_price_usd: 9500.00,
    triggers: ["contract_expiry"],
    content: "ServiceEdge Optimum standard service agreement remote monitoring emergency response PM labor in-house",
    tags: ["ServiceEdge", "standard", "contract", "remote_monitoring"],
  },
  {
    offering_id: "SVC-008",
    name: "Controls & Connectivity Upgrade",
    description: "OptiView XE panel install + RemoteLink IoT gateway setup + onboarding to Carrier Connect dashboard. Provides real-time alerts, efficiency trending, and remote set-point adjustment.",
    category: "upgrade",
    applicable_model_families: ["30RB", "30XA", "19XR"],
    list_price_usd: 8900.00,
    triggers: ["efficiency_drift", "fleet_cohort_outlier"],
    content: "OptiView XE controls upgrade RemoteLink IoT gateway Carrier Connect dashboard real-time alerts efficiency trending remote setpoint",
    tags: ["controls", "upgrade", "IoT", "remote_monitoring", "OptiView"],
  },
  {
    offering_id: "SVC-009",
    name: "Tube Bundle Replacement",
    description: "Full condenser/evaporator tube bundle replacement with enhanced micro-grooved tubes. Recommended when approach delta has increased >5°F from baseline or scale deposits are confirmed.",
    category: "upgrade",
    applicable_model_families: ["19XR", "30XA"],
    list_price_usd: 22000.00,
    triggers: ["high_approach_temp"],
    content: "tube bundle replacement condenser evaporator micro-grooved approach delta scale deposits water cooled",
    tags: ["tube_bundle", "replacement", "micro-grooved", "approach_temp", "upgrade"],
  },
  {
    offering_id: "SVC-010",
    name: "Compressor Rebuild Service",
    description: "Full factory-authorized scroll compressor rebuild: rotor/stator inspection, bearing replacement, motor rewind if needed. Extends compressor life 8-12 years post-rebuild.",
    category: "repair",
    applicable_model_families: ["30RB", "30XA"],
    list_price_usd: 14500.00,
    triggers: ["pre_fault_indicator", "repeat_part_failure"],
    content: "compressor rebuild scroll factory authorized rotor stator bearing motor rewind extended life repair",
    tags: ["compressor", "rebuild", "factory_authorized", "scroll", "bearing"],
  },
  {
    offering_id: "SVC-011",
    name: "Root Cause Analysis Investigation",
    description: "Structured fault investigation for units with repeat alarms or repeat part failures. Includes oil analysis, vibration survey, refrigerant circuit analysis. Deliverable: RCA report + corrective action plan.",
    category: "inspection",
    applicable_model_families: ["30RB", "30XA", "19XR"],
    list_price_usd: 3500.00,
    triggers: ["repeat_part_failure"],
    content: "root cause analysis RCA repeat alarm fault investigation oil analysis vibration survey refrigerant circuit corrective action",
    tags: ["RCA", "root_cause", "repeat_failure", "fault_investigation"],
  },
  {
    offering_id: "SVC-012",
    name: "Fleet Efficiency Benchmarking Report",
    description: "Carrier-produced fleet performance report: kW/ton vs. peer cohort, seasonal efficiency trends, top 3 improvement opportunities per unit. Annual delivery; includes executive summary.",
    category: "inspection",
    applicable_model_families: ["30RB", "30XA", "19XR"],
    list_price_usd: 1600.00,
    triggers: ["fleet_cohort_outlier", "efficiency_drift"],
    content: "fleet efficiency benchmarking report kW per ton peer cohort seasonal trends improvement opportunities executive summary",
    tags: ["benchmarking", "fleet", "efficiency", "report", "cohort"],
  },
  {
    offering_id: "SVC-013",
    name: "Emergency Response Retainer",
    description: "Pre-paid emergency service hours (20h block) for unplanned outages. Guaranteed 4-hour dispatch, priority parts access. Valid 12 months from purchase.",
    category: "contract",
    applicable_model_families: ["30RB", "30XA", "19XR"],
    list_price_usd: 5800.00,
    triggers: ["contract_expiry", "pm_overdue"],
    content: "emergency response retainer prepaid hours unplanned outage 4-hour dispatch priority parts",
    tags: ["emergency", "retainer", "prepaid", "dispatch"],
  },
];

// ─── Equipment Topology ───────────────────────────────────────────────────────

function buildTopology() {
  const docs = [];

  const chillers = [
    { id: "CH-ATL-001", label: "CH-ATL-001 (30RB-250)", model: "30RB-250", type: "30RB" },
    { id: "CH-DAL-002", label: "CH-DAL-002 (19XR-500)", model: "19XR-500", type: "19XR" },
    { id: "CH-ATL-003", label: "CH-ATL-003 (30XA080)", model: "30XA080", type: "30XA" },
    { id: "CH-CHI-004", label: "CH-CHI-004 (30XA120)", model: "30XA120", type: "30XA" },
    { id: "CH-PHX-005", label: "CH-PHX-005 (30RB-400)", model: "30RB-400", type: "30RB" },
  ];

  // For each chiller, create root + subsystem nodes
  for (const ch of chillers) {
    // Root node (chiller itself)
    docs.push({
      equipment_id: ch.id,
      parent_equipment_id: null,
      equipment_type: "chiller",
      label: ch.label,
      model: ch.model,
      associated_parts: ch.type === "19XR"
        ? ["PART-003", "PART-017"]
        : ["PART-001", "PART-002"],
    });

    const circuitCount = ch.type === "19XR" ? 1 : 2;

    for (let c = 1; c <= circuitCount; c++) {
      const circuitId = `${ch.id}-CIRC-${String.fromCharCode(64 + c)}`;
      // Circuit
      docs.push({
        equipment_id: circuitId,
        parent_equipment_id: ch.id,
        equipment_type: "refrigerant_circuit",
        label: `Circuit ${String.fromCharCode(64 + c)}`,
        model: null,
        associated_parts: ["PART-002", "PART-010"],
      });

      // Compressor
      const compId = `${ch.id}-COMP-${String.fromCharCode(64 + c)}`;
      const compParts = ch.type === "30RB"
        ? ["PART-006", "PART-008", "PART-018", "PART-005"]
        : ch.type === "19XR"
          ? ["PART-009", "PART-003"]
          : ["PART-006", "PART-007", "PART-008"];
      docs.push({
        equipment_id: compId,
        parent_equipment_id: circuitId,
        equipment_type: ch.type === "19XR" ? "centrifugal_compressor" : "scroll_compressor",
        label: `Compressor ${String.fromCharCode(64 + c)}`,
        model: ch.type === "19XR" ? "Evergreen Centrifugal" : `${ch.type} Scroll`,
        associated_parts: compParts,
      });

      // Heat exchanger (evaporator)
      const evapId = `${ch.id}-EVAP-${String.fromCharCode(64 + c)}`;
      docs.push({
        equipment_id: evapId,
        parent_equipment_id: circuitId,
        equipment_type: "evaporator",
        label: `Evaporator ${String.fromCharCode(64 + c)}`,
        model: null,
        associated_parts: ch.type === "19XR" ? ["PART-017", "PART-013"] : ["PART-004"],
      });

      // Condenser
      const condId = `${ch.id}-COND-${String.fromCharCode(64 + c)}`;
      const condType = ch.type === "19XR" ? "water_cooled_condenser" : "air_cooled_condenser";
      docs.push({
        equipment_id: condId,
        parent_equipment_id: circuitId,
        equipment_type: condType,
        label: `Condenser ${String.fromCharCode(64 + c)}`,
        model: null,
        associated_parts: ch.type === "19XR"
          ? ["PART-017", "PART-009", "PART-013"]
          : ["PART-001", "PART-004", "PART-016"],
      });
    }

    // Controls node
    const ctrlId = `${ch.id}-CTRL`;
    docs.push({
      equipment_id: ctrlId,
      parent_equipment_id: ch.id,
      equipment_type: "controls",
      label: "Control Panel",
      model: ch.type === "19XR" ? "ICVC v4.8.3" : "Touch Pilot / NetCtrl",
      associated_parts: ["PART-012", "PART-015"],
    });
  }

  return docs;
}

// ─── Seeded Sales Opportunities ───────────────────────────────────────────────

const NOW = new Date().toISOString();

const SALES_OPPORTUNITIES = [
  {
    opportunity_id: "OPP-SEED-001",
    customer_id: "CUST-001",
    customer_name: "Brookfield Office Properties",
    site_id: "SITE-ATL-001",
    chiller_id: "CH-ATL-001",
    scenario_type: "efficiency_drift",
    title: "Efficiency Recovery — CH-ATL-001 (Peachtree Tower)",
    evidence_summary: "kW/ton has drifted from 1.22 to 1.33 (+9%) over 180 days. Rolling 15-point average confirms sustained trend rather than noise. Refrigerant recharge + coil clean estimated to recover 6-7%.",
    recommended_actions: ["quote_refrigerant_recharge", "schedule_coil_clean", "propose_efficiency_audit"],
    estimated_value_usd: 3700,
    priority: "medium",
    status: "open",
    rep_id: "REP-001",
    rep_reaction: null,
    created_at: NOW,
    updated_at: NOW,
  },
  {
    opportunity_id: "OPP-SEED-002",
    customer_id: "CUST-003",
    customer_name: "Piedmont Healthcare",
    site_id: "SITE-ATL-003",
    chiller_id: "CH-ATL-003",
    scenario_type: "contract_expiry",
    title: "Service Contract Renewal — CH-ATL-003 expires Sep 30",
    evidence_summary: "SVC-ATL-2022-00317 expires in 27 days. Unit is currently in fault (A1.01 repeat). Healthcare criticality makes lapse high risk. Recommend ServiceEdge Advance renewal.",
    recommended_actions: ["propose_ServiceEdge_Advance", "priority_renewal_call"],
    estimated_value_usd: 18000,
    priority: "high",
    status: "open",
    rep_id: "REP-002",
    rep_reaction: null,
    created_at: NOW,
    updated_at: NOW,
  },
  {
    opportunity_id: "OPP-SEED-003",
    customer_id: "CUST-005",
    customer_name: "Intel Corporation",
    site_id: "SITE-PHX-005",
    chiller_id: "CH-PHX-005",
    scenario_type: "contract_expiry",
    title: "Lapsed Contract — CH-PHX-005 (Intel Ocotillo)",
    evidence_summary: "Contract SVC-PHX-2021-00763 expired 2025-12-31 (9 months ago). Unit is currently stopped. Intel fab cooling is business critical. Immediate re-engagement recommended.",
    recommended_actions: ["emergency_contract_call", "propose_ServiceEdge_Optimum", "schedule_restart_inspection"],
    estimated_value_usd: 12000,
    priority: "high",
    status: "open",
    rep_id: "REP-001",
    rep_reaction: null,
    created_at: NOW,
    updated_at: NOW,
  },
  {
    opportunity_id: "OPP-SEED-004",
    customer_id: "CUST-002",
    customer_name: "Equinix",
    site_id: "SITE-DAL-002",
    chiller_id: "CH-DAL-002",
    scenario_type: "high_approach_temp",
    title: "Condenser Fouling — CH-DAL-002 (Lone Star DC)",
    evidence_summary: "Approach temp delta has widened from 14°F (baseline) to 22°F over the past 90 days. $setWindowFields analysis shows progressive rise. Tube bundle cleaning + water treatment check recommended.",
    recommended_actions: ["schedule_tube_clean", "quote_water_treatment", "assess_tube_bundle_condition"],
    estimated_value_usd: 5400,
    priority: "medium",
    status: "open",
    rep_id: "REP-003",
    rep_reaction: null,
    created_at: NOW,
    updated_at: NOW,
  },
  {
    opportunity_id: "OPP-SEED-005",
    customer_id: "CUST-004",
    customer_name: "Northwestern University",
    site_id: "SITE-CHI-004",
    chiller_id: "CH-CHI-004",
    scenario_type: "pre_fault_indicator",
    title: "Pre-Fault Alert — CH-CHI-004 Motor Temps Rising",
    evidence_summary: "Motor winding temp has risen +18°F over the last 90 days (from 152°F to 170°F rolling avg). Discharge pressure also elevated. Pre-fault pattern matches bearing/seal degradation profile. Recommend predictive motor assessment before semester start.",
    recommended_actions: ["schedule_motor_health_assessment", "quote_bearing_replacement", "preventive_seal_inspection"],
    estimated_value_usd: 6200,
    priority: "high",
    status: "open",
    rep_id: "REP-002",
    rep_reaction: "thumbs_up",
    created_at: NOW,
    updated_at: NOW,
  },
  {
    opportunity_id: "OPP-SEED-006",
    customer_id: "CUST-001",
    customer_name: "Brookfield Office Properties",
    site_id: "SITE-ATL-001",
    chiller_id: "CH-ATL-001",
    scenario_type: "contract_expiry",
    title: "Contract Renewal — CH-ATL-001 expires Oct 31",
    evidence_summary: "ServiceEdge Advance contract SVC-ATL-2024-00891 expires in 58 days. Combined with active efficiency drift opportunity, a full renewal + efficiency audit bundle represents strong value.",
    recommended_actions: ["bundle_renewal_with_audit", "propose_ServiceEdge_Advance"],
    estimated_value_usd: 22800,
    priority: "medium",
    status: "quoted",
    rep_id: "REP-001",
    rep_reaction: "thumbs_up",
    created_at: NOW,
    updated_at: NOW,
  },
  {
    opportunity_id: "OPP-SEED-007",
    customer_id: "CUST-002",
    customer_name: "Equinix",
    site_id: "SITE-DAL-002",
    chiller_id: "CH-DAL-002",
    scenario_type: "fleet_cohort_outlier",
    title: "Cohort Efficiency Gap — CH-DAL-002 vs 2019 Peer Fleet",
    evidence_summary: "CH-DAL-002 (installed 2019) is running at 0.72 kW/ton avg vs cohort avg of 0.61 kW/ton — 18% worse than peers. Impeller wear and refrigerant blend mismatch likely contributors.",
    recommended_actions: ["quote_impeller_upgrade", "refrigerant_blend_assessment", "propose_fleet_benchmarking_report"],
    estimated_value_usd: 28000,
    priority: "medium",
    status: "open",
    rep_id: "REP-003",
    rep_reaction: null,
    created_at: NOW,
    updated_at: NOW,
  },
  {
    opportunity_id: "OPP-SEED-008",
    customer_id: "CUST-003",
    customer_name: "Piedmont Healthcare",
    site_id: "SITE-ATL-003",
    chiller_id: "CH-ATL-003",
    scenario_type: "repeat_part_failure",
    title: "Repeat Sensor Failure — CH-ATL-003 (Root Cause Investigation)",
    evidence_summary: "Motor temp sensor (00PPG000012200A) replaced Nov 2025; same failure recurred Jul 2026. Repeat failure within 8 months suggests underlying root cause (wiring degradation or moisture ingress). RCA investigation recommended before next replacement.",
    recommended_actions: ["schedule_RCA_investigation", "inspect_wiring_harness", "quote_compressor_rebuild_assessment"],
    estimated_value_usd: 7500,
    priority: "high",
    status: "open",
    rep_id: "REP-002",
    rep_reaction: null,
    created_at: NOW,
    updated_at: NOW,
  },
];

// ─── Sample Sales Sessions ────────────────────────────────────────────────────

const SALES_SESSIONS = [
  {
    session_id: "SALES-SEED01",
    customer_id: "CUST-001",
    rep_id: "REP-001",
    focus: "fleet_review",
    started_at: new Date(Date.now() - 2 * 24 * 3600000).toISOString(),
    trace: [
      {
        trace_id: "STRACE-SEED001",
        session_id: "SALES-SEED01",
        source_data_refs: [
          { collection: "chillers", id: "CH-ATL-001" },
          { collection: "telemetry", id: "CH-ATL-001" },
        ],
        inferred_outputs: {
          identified_patterns: ["efficiency_drift"],
          recommended_offerings: ["SVC-002", "SVC-001"],
          estimated_total_value_usd: 22800,
        },
        created_at: new Date(Date.now() - 2 * 24 * 3600000).toISOString(),
      },
    ],
  },
  {
    session_id: "SALES-SEED02",
    customer_id: "CUST-004",
    rep_id: "REP-002",
    focus: "pre_fault_review",
    started_at: new Date(Date.now() - 1 * 24 * 3600000).toISOString(),
    trace: [
      {
        trace_id: "STRACE-SEED002",
        session_id: "SALES-SEED02",
        source_data_refs: [
          { collection: "chillers", id: "CH-CHI-004" },
          { collection: "telemetry", id: "CH-CHI-004" },
        ],
        inferred_outputs: {
          identified_patterns: ["pre_fault_indicator"],
          recommended_offerings: ["SVC-004", "SVC-010"],
          estimated_total_value_usd: 6200,
        },
        created_at: new Date(Date.now() - 1 * 24 * 3600000).toISOString(),
      },
    ],
  },
];

// ─── Write Files ──────────────────────────────────────────────────────────────

const files = {
  "parts_catalog.json": PARTS_CATALOG,
  "service_offerings.json": SERVICE_OFFERINGS,
  "equipment_topology.json": buildTopology(),
  "sales_opportunities.json": SALES_OPPORTUNITIES,
  "sales_sessions.json": SALES_SESSIONS,
};

for (const [filename, data] of Object.entries(files)) {
  const path = join(OUT_DIR, filename);
  writeFileSync(path, JSON.stringify(data, null, 2) + "\n");
  console.log(`Wrote ${data.length} docs → ${path}`);
}
