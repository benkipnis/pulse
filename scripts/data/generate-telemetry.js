#!/usr/bin/env node
/**
 * Generate telemetry for all demo chillers.
 *
 * Extended for AMS v2.0:
 *   - 180-day daily historical window (for trend analysis)
 *   - 7-day hourly recent window (for real-time VE diagnostics)
 *   - New fields per reading: power_kw, cooling_tons, ambient_temp_f
 *   - Engineered trends per unit:
 *       CH-ATL-001: efficiency drift — flat for first 90 days, ramps +20% in last 90 days
 *                   produces ~9-10% measured drift_pct in the 90-day analysis window
 *       CH-CHI-004: pre-fault indicator — motor_winding_temp_f rising +18°F in last 90 days
 *       CH-DAL-002: condenser approach delta widening (high ambient in Dallas summer)
 *
 * Usage:
 *   node scripts/data/generate-telemetry.js
 *   node scripts/data/generate-telemetry.js --days 7 --interval-hours 1 --seed 42
 *   node scripts/data/generate-telemetry.js --output scripts/data/samples/telemetry.json
 *   node scripts/data/generate-telemetry.js --end-time 2026-07-17T17:00:00Z
 */

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const CHILLERS_PATH = join(__dirname, "samples", "chillers.json");
const DEFAULT_OUTPUT = join(__dirname, "samples", "telemetry.json");

/**
 * Alarm trip times expressed as milliseconds before the window end.
 * This keeps the narrative fixed relative to "now" regardless of when the
 * data was generated.
 *
 * CH-ATL-003  A1.01   trips ~2 h 38 m before end  (hero scenario)
 * CH-DAL-002  207     trips ~18 h 52 m before end
 * CH-PHX-005  Co.A1   trips ~4 h 55 m before end
 */
const ALARM_OFFSETS_MS = {
  "CH-ATL-003": { code: "A1.01",  msBeforeEnd:  9_462_000 },
  "CH-DAL-002": { code: "207",    msBeforeEnd: 67_920_000 },
  "CH-PHX-005": { code: "Co.A1", msBeforeEnd: 17_700_000 },
};

/** Truncate a millisecond timestamp to the start of the current UTC hour. */
function truncateToHour(ms) {
  return ms - (ms % 3_600_000);
}

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = {
    days: 7,
    intervalHours: 1,
    seed: 42,
    output: DEFAULT_OUTPUT,
    endTime: truncateToHour(Date.now()),
  };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--days") opts.days = Number(args[++i]);
    else if (args[i] === "--interval-hours") opts.intervalHours = Number(args[++i]);
    else if (args[i] === "--seed") opts.seed = Number(args[++i]);
    else if (args[i] === "--output") opts.output = args[++i];
    else if (args[i] === "--end-time") opts.endTime = Date.parse(args[++i]);
  }
  return opts;
}

function mulberry32(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function round1(n) {
  return Math.round(n * 10) / 10;
}

function round2(n) {
  return Math.round(n * 100) / 100;
}

function diurnal(hourUtc, amplitude) {
  return Math.sin(((hourUtc - 14) / 24) * Math.PI * 2) * amplitude;
}

function loadChillers() {
  return JSON.parse(readFileSync(CHILLERS_PATH, "utf8"));
}

function baseProfile(chiller) {
  const sp = chiller.current_setpoints.leaving_chilled_water_f;
  const waterCooled = chiller.configuration.condenser_type === "water_cooled";
  const ratedCapacity = chiller.rated_capacity_tons || chiller.configuration.cooling_capacity_tons;
  const ratedEfficiency = chiller.rated_efficiency_kwpton || 1.2;

  const runHoursBase =
    {
      "CH-ATL-001": 31200,
      "CH-DAL-002": 52880,
      "CH-ATL-003": 42150,
      "CH-CHI-004": 28440,
      "CH-PHX-005": 18200,
      // New chillers — healthy baselines
      "CH-ATL-002": 12800,  // 2023 install, newest Brookfield unit
      "CH-ATL-007": 37400,  // 2020 install, Brookfield
      "CH-DAL-003": 52200,  // 2019, same vintage as CH-DAL-002
      "CH-DAL-004": 40600,  // 2020, Equinix
      "CH-DAL-005": 23500,  // 2022, Equinix air-cooled
      "CH-DAL-006": 63100,  // 2018, oldest Equinix unit
      "CH-ATL-004": 38900,  // 2020, Piedmont backup
      "CH-ATL-005": 49700,  // 2019, Piedmont second backup
      "CH-ATL-006": 20300,  // 2022, Piedmont newest
    }[chiller.chiller_id] ?? 20000;

  const startsBase =
    {
      "CH-ATL-001": 2100,
      "CH-DAL-002": 890,
      "CH-ATL-003": 1840,
      "CH-CHI-004": 1565,
      "CH-PHX-005": 985,
      // New chillers
      "CH-ATL-002": 780,
      "CH-ATL-007": 1920,
      "CH-DAL-003": 870,
      "CH-DAL-004": 840,
      "CH-DAL-005": 1210,
      "CH-DAL-006": 760,
      "CH-ATL-004": 1680,
      "CH-ATL-005": 2050,
      "CH-ATL-006": 880,
    }[chiller.chiller_id] ?? 1000;

  return {
    sp,
    waterCooled,
    runHoursBase,
    startsBase,
    loadMid: waterCooled ? 0.88 : 0.72,
    loadAmp: waterCooled ? 0.08 : 0.12,
    ratedCapacity,
    ratedEfficiency,
  };
}

/**
 * Compute engineered trend multipliers for AMS scenarios.
 * Returns a delta factor (0 = no drift, 1 = full drift applied at end of window).
 *
 * @param {string} chillerId
 * @param {number} ts        - current timestamp ms
 * @param {number} startTime - start of 180-day window ms
 * @param {number} endTime   - end of window ms
 */
function amsTrendFactor(chillerId, ts, startTime, endTime) {
  const totalMs = endTime - startTime;
  const progress = (ts - startTime) / totalMs; // 0 → 1 over the window

  switch (chillerId) {
    case "CH-ATL-001": {
      // Efficiency drift: flat for first 90 days, then ramps strongly in last 90 days.
      // This concentrates the trend in the analysis window so getUnitEfficiencyTrend
      // measures ~9-10% drift_pct (well above the 5% threshold).
      const ramp = Math.max(0, (progress - 0.5) / 0.5); // 0 in first 90d, 0→1 in last 90d
      return { efficiencyDrift: 1.0 + ramp * 0.20 };
    }
    case "CH-CHI-004": {
      // Pre-fault: motor_winding_temp_f rises +18°F in the last 50% of the window
      const ramp = Math.max(0, (progress - 0.5) / 0.5); // 0 in first half, 0→1 in second half
      return { motorTempRise: ramp * 18 };
    }
    case "CH-DAL-002": {
      // Approach temp widening: saturated_condensing_temp_f drifts up +8°F after day 60 (33% of 180)
      const ramp = Math.max(0, (progress - 0.33) / 0.67);
      return { approachDrift: ramp * 8 };
    }
    default:
      return {};
  }
}

function normalReadings(chiller, ts, rand, profile, startTime, endTime) {
  const hour = new Date(ts).getUTCHours();
  const dayOffset = (ts - startTime) / 3600000;

  const trend = amsTrendFactor(chiller.chiller_id, ts, startTime, endTime);

  const load =
    profile.loadMid +
    profile.loadAmp * diurnal(hour, 1) +
    (rand() - 0.5) * 0.06;
  const pctCapacity = round1(Math.min(98, Math.max(35, load * 100)));
  const pctCurrent = round1(pctCapacity * (0.9 + rand() * 0.08));

  const lwt = round1(profile.sp + (rand() - 0.5) * 1.2);
  const ewt = round1(lwt + 10 + load * 4 + (rand() - 0.5) * 1.5);
  let sct = round1(88 + diurnal(hour, 6) + load * 12 + (rand() - 0.5) * 2);
  const sst = round1(36 + load * 3 + (rand() - 0.5) * 1.2);
  const dischargeTemp = round1(128 + load * 18 + (rand() - 0.5) * 4);
  let bearingTemp = round1(108 + load * 12 + (rand() - 0.5) * 3);
  let motorWinding = round1(148 + load * 14 + (rand() - 0.5) * 4);
  const dischargePsi = round1(profile.waterCooled ? 135 + load * 12 : 275 + load * 25);
  const suctionPsi = round1(profile.waterCooled ? 46 + load * 4 : 68 + load * 6);

  // Apply AMS engineered trends
  if (trend.motorTempRise) {
    motorWinding = round1(motorWinding + trend.motorTempRise);
    bearingTemp = round1(bearingTemp + trend.motorTempRise * 0.6);
  }
  if (trend.approachDrift) {
    sct = round1(sct + trend.approachDrift);
  }

  // AMS extended fields
  const coolingTons = round1((pctCapacity / 100) * profile.ratedCapacity);
  const baseEfficiency = profile.ratedEfficiency * (0.95 + load * 0.08);
  const efficiencyMultiplier = trend.efficiencyDrift || 1.0;
  const powerKw = round2(coolingTons * baseEfficiency * efficiencyMultiplier);

  // Ambient temp: seasonal + diurnal, varies by chiller location seed
  const locationSeed = chiller.chiller_id.charCodeAt(3);
  const ambientBase = 65 + (locationSeed % 15); // 65-80°F base by location
  const ambientTemp = round1(
    ambientBase +
      diurnal(hour, 8) +
      (rand() - 0.5) * 4
  );

  const readings = {
    leaving_chilled_water_f: lwt,
    entering_chilled_water_f: ewt,
    saturated_condensing_temp_f: sct,
    saturated_suction_temp_f: sst,
    discharge_temp_f: dischargeTemp,
    bearing_temp_f: bearingTemp,
    motor_winding_temp_f: motorWinding,
    discharge_pressure_psig: dischargePsi,
    suction_pressure_psig: suctionPsi,
    percent_line_current: pctCurrent,
    line_voltage_v: round1(478 + (rand() - 0.5) * 4),
    percent_capacity: pctCapacity,
    unit_run_status: 1,
    compressor_starts: profile.startsBase + Math.floor(dayOffset / 48),
    run_hours: round1(profile.runHoursBase + dayOffset),
    // AMS extended fields
    power_kw: powerKw,
    cooling_tons: coolingTons,
    ambient_temp_f: ambientTemp,
  };

  if (profile.waterCooled) {
    readings.leaving_condenser_water_f = round1(92 + diurnal(hour, 3) + load * 4);
  }

  return readings;
}

function heroDegradingReadings(chiller, ts, rand, profile, alarmAt, startTime, endTime) {
  const hoursToAlarm = (alarmAt - ts) / 3600000;

  if (hoursToAlarm <= 0) {
    const coolingTons = 0;
    const powerKw = 0;
    const ambientTemp = round1(72 + (rand() - 0.5) * 4);
    return {
      leaving_chilled_water_f: round1(profile.sp + 6 + rand() * 2),
      entering_chilled_water_f: round1(profile.sp + 14),
      saturated_condensing_temp_f: round1(105 + rand() * 2),
      saturated_suction_temp_f: round1(40 + rand()),
      discharge_temp_f: 0,
      bearing_temp_f: round1(118 + rand() * 8),
      motor_winding_temp_f: round1(125 + rand() * 10),
      discharge_pressure_psig: round1(180 + rand() * 20),
      suction_pressure_psig: round1(55 + rand() * 5),
      percent_line_current: 0,
      line_voltage_v: round1(476 + rand() * 2),
      percent_capacity: 0,
      unit_run_status: hoursToAlarm > -2 ? 2 : 0,
      compressor_starts: profile.startsBase + 3,
      run_hours: round1(profile.runHoursBase + (ts - startTime) / 3600000),
      power_kw: powerKw,
      cooling_tons: coolingTons,
      ambient_temp_f: ambientTemp,
    };
  }

  const readings = normalReadings(chiller, ts, rand, profile, startTime, endTime);

  if (hoursToAlarm < 30) {
    const stress = 1 - hoursToAlarm / 30;
    readings.motor_winding_temp_f = round1(155 + stress * 48 + (rand() - 0.5) * 3);
    readings.bearing_temp_f = round1(115 + stress * 42 + (rand() - 0.5) * 2);
    readings.discharge_temp_f = round1(readings.discharge_temp_f + stress * 28);
    readings.discharge_pressure_psig = round1(readings.discharge_pressure_psig + stress * 35);
    readings.percent_line_current = round1(Math.min(99, readings.percent_line_current + stress * 18));
    readings.percent_capacity = round1(Math.min(99, readings.percent_capacity + stress * 20));
    readings.saturated_condensing_temp_f = round1(readings.saturated_condensing_temp_f + stress * 10);
  }

  return readings;
}

function condenserStressReadings(chiller, ts, rand, profile, alarmAt, startTime, endTime) {
  const hoursToAlarm = (alarmAt - ts) / 3600000;
  const readings = normalReadings(chiller, ts, rand, profile, startTime, endTime);

  if (hoursToAlarm < 0) {
    readings.unit_run_status = 2;
    readings.percent_capacity = 0;
    readings.percent_line_current = 0;
    readings.leaving_chilled_water_f = round1(profile.sp + 4);
    readings.discharge_pressure_psig = round1(168 + rand() * 5);
    readings.leaving_condenser_water_f = round1(102 + rand() * 3);
    readings.power_kw = 0;
    readings.cooling_tons = 0;
    return readings;
  }

  if (hoursToAlarm < 20) {
    const stress = 1 - hoursToAlarm / 20;
    readings.discharge_pressure_psig = round1(readings.discharge_pressure_psig + stress * 30);
    readings.saturated_condensing_temp_f = round1(readings.saturated_condensing_temp_f + stress * 14);
    readings.leaving_condenser_water_f = round1(readings.leaving_condenser_water_f + stress * 8);
    readings.percent_line_current = round1(Math.min(98, readings.percent_line_current + stress * 8));
    readings.leaving_chilled_water_f = round1(readings.leaving_chilled_water_f + stress * 2.5);
  }

  return readings;
}

function stoppedReadings(chiller, ts, rand, profile, faultAt, startTime, endTime) {
  if (ts >= faultAt) {
    const ambientTemp = round1(85 + (rand() - 0.5) * 6); // Phoenix — hot
    return {
      leaving_chilled_water_f: round1(profile.sp + 10 + rand() * 2),
      entering_chilled_water_f: round1(profile.sp + 16),
      saturated_condensing_temp_f: 0,
      saturated_suction_temp_f: 0,
      discharge_temp_f: 0,
      bearing_temp_f: round1(84 + rand() * 6),
      motor_winding_temp_f: round1(86 + rand() * 8),
      discharge_pressure_psig: 0,
      suction_pressure_psig: 0,
      percent_line_current: 0,
      line_voltage_v: round1(480 + rand() * 2),
      percent_capacity: 0,
      unit_run_status: 0,
      compressor_starts: profile.startsBase,
      run_hours: round1(profile.runHoursBase + (ts - startTime) / 3600000),
      power_kw: 0,
      cooling_tons: 0,
      ambient_temp_f: ambientTemp,
    };
  }
  return normalReadings(chiller, ts, rand, profile, startTime, endTime);
}

function readingsForChiller(chiller, ts, rand, alarmTimes, startTime, endTime) {
  const profile = baseProfile(chiller);
  const alarm = alarmTimes[chiller.chiller_id];

  if (chiller.chiller_id === "CH-ATL-003") {
    return heroDegradingReadings(chiller, ts, rand, profile, alarm.at, startTime, endTime);
  }
  if (chiller.chiller_id === "CH-DAL-002") {
    return condenserStressReadings(chiller, ts, rand, profile, alarm.at, startTime, endTime);
  }
  if (chiller.chiller_id === "CH-PHX-005") {
    return stoppedReadings(chiller, ts, rand, profile, alarm.at, startTime, endTime);
  }
  return normalReadings(chiller, ts, rand, profile, startTime, endTime);
}

export { ALARM_OFFSETS_MS, truncateToHour };

/**
 * Generate telemetry documents.
 *
 * When `historical: true`, generates daily docs from (endTime - 180d) to (endTime - 7d)
 * for trend analysis. The recent 7d hourly window is always generated.
 * Combined output: 180 daily docs/unit + 168 hourly docs/unit.
 */
export function generateTelemetry(opts = {}) {
  const {
    days = 7,
    intervalHours = 1,
    seed = 42,
    endTime = truncateToHour(Date.now()),
    includeHistorical = true,
  } = opts;

  const chillers = loadChillers();

  // Recent window: last N days at intervalHours resolution
  const recentIntervalMs = intervalHours * 3_600_000;
  const recentPoints = Math.floor((days * 24) / intervalHours);
  const recentStartTime = endTime - (recentPoints - 1) * recentIntervalMs;

  // Historical window: 180 days at 24h resolution (excluding last 7 days to avoid overlap)
  const historicalEndTime = recentStartTime - 3_600_000; // 1 hour before recent start
  const historicalStartTime = endTime - 180 * 86_400_000;
  const historicalIntervalMs = 86_400_000; // 1 day

  const alarmTimes = Object.fromEntries(
    Object.entries(ALARM_OFFSETS_MS).map(([id, def]) => [
      id,
      { code: def.code, at: endTime - def.msBeforeEnd },
    ])
  );

  const documents = [];

  for (const chiller of chillers) {
    const rand = mulberry32(
      seed + chiller.chiller_id.split("").reduce((a, c) => a + c.charCodeAt(0), 0)
    );

    // Historical daily docs
    if (includeHistorical) {
      const histPoints = Math.floor((historicalEndTime - historicalStartTime) / historicalIntervalMs) + 1;
      for (let i = 0; i < histPoints; i++) {
        const ts = historicalStartTime + i * historicalIntervalMs;
        documents.push({
          chiller_id: chiller.chiller_id,
          timestamp: new Date(ts).toISOString(),
          interval: "1d",
          readings: readingsForChiller(chiller, ts, rand, alarmTimes, historicalStartTime, endTime),
        });
      }
    }

    // Recent hourly docs
    for (let i = 0; i < recentPoints; i++) {
      const ts = recentStartTime + i * recentIntervalMs;
      documents.push({
        chiller_id: chiller.chiller_id,
        timestamp: new Date(ts).toISOString(),
        interval: `${intervalHours}h`,
        readings: readingsForChiller(chiller, ts, rand, alarmTimes, historicalStartTime, endTime),
      });
    }
  }

  documents.sort(
    (a, b) => a.timestamp.localeCompare(b.timestamp) || a.chiller_id.localeCompare(b.chiller_id)
  );
  return documents;
}

function main() {
  const opts = parseArgs();
  const documents = generateTelemetry({ ...opts, includeHistorical: true });
  writeFileSync(opts.output, JSON.stringify(documents, null, 2) + "\n");

  const byChiller = {};
  for (const d of documents) {
    byChiller[d.chiller_id] = (byChiller[d.chiller_id] ?? 0) + 1;
  }

  console.log(`Wrote ${documents.length} telemetry documents to ${opts.output}`);
  console.log(`Time range: ${documents[0].timestamp} → ${documents[documents.length - 1].timestamp}`);
  console.log("Per chiller:", byChiller);
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
  main();
}
