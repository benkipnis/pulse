/**
 * Fleet Intelligence repository — AMS-specific queries.
 *
 * Leverages:
 *   - Standard aggregation ($group, $match, $lookup, $project, $sort)
 *   - $setWindowFields for rolling efficiency trends and pre-fault detection
 *   - $lookup for cohort comparison across install-year buckets
 */
import { getDb } from "../db/client.js";

/**
 * Return all chillers associated with a customer_id or site_id,
 * joined with site info and enriched with latest telemetry snapshot.
 */
export async function getCustomerFleet({ customerId, siteId } = {}) {
  const db = await getDb();
  const match = {};
  if (customerId) match.customer_id = customerId;
  if (siteId) match.site_id = siteId;

  const chillers = await db
    .collection("chillers")
    .aggregate([
      { $match: match },
      {
        $lookup: {
          from: "sites",
          localField: "site_id",
          foreignField: "site_id",
          as: "site",
        },
      },
      { $unwind: { path: "$site", preserveNullAndEmpty: true } },
      {
        $project: {
          _id: 0,
          chiller_id: 1,
          site_id: 1,
          model_family: 1,
          model_number: 1,
          product_line: 1,
          operating_status: 1,
          install_date: 1,
          rated_efficiency_kwpton: 1,
          rated_capacity_tons: 1,
          service_contract_expiry: 1,
          equipment_id: 1,
          customer_id: 1,
          site_name: "$site.name",
          customer_name: "$site.customer_name",
          building_type: "$site.building_type",
          service_contract_tier: "$site.service_contract.tier",
        },
      },
      { $sort: { chiller_id: 1 } },
    ])
    .toArray();

  return chillers;
}

/**
 * Compute rolling 30-day average efficiency (kW/ton) for a unit using $setWindowFields.
 * Requires telemetry to have power_kw + cooling_tons fields (added by extended generator).
 */
export async function getUnitEfficiencyTrend({ chillerId, lookbackDays = 90 }) {
  const db = await getDb();
  const startTime = new Date(Date.now() - lookbackDays * 86400_000).toISOString();

  const docs = await db
    .collection("telemetry")
    .aggregate([
      {
        $match: {
          chiller_id: chillerId,
          timestamp: { $gte: startTime },
          "readings.power_kw": { $exists: true, $gt: 0 },
          "readings.cooling_tons": { $exists: true, $gt: 0 },
        },
      },
      { $sort: { timestamp: 1 } },
      {
        $addFields: {
          ts: { $dateFromString: { dateString: "$timestamp" } },
          efficiency_kwpton: {
            $divide: ["$readings.power_kw", "$readings.cooling_tons"],
          },
        },
      },
      {
        $setWindowFields: {
          partitionBy: "$chiller_id",
          sortBy: { ts: 1 },
          output: {
            rolling_avg_efficiency: {
              $avg: "$efficiency_kwpton",
              window: { documents: [-14, 0] }, // 15-point rolling window
            },
            rolling_max_efficiency: {
              $max: "$efficiency_kwpton",
              window: { documents: [-14, 0] },
            },
          },
        },
      },
      {
        $project: {
          _id: 0,
          chiller_id: 1,
          timestamp: 1,
          efficiency_kwpton: { $round: ["$efficiency_kwpton", 3] },
          rolling_avg_efficiency: { $round: ["$rolling_avg_efficiency", 3] },
          rolling_max_efficiency: { $round: ["$rolling_max_efficiency", 3] },
        },
      },
    ])
    .toArray();

  // Compute trend: compare first-week avg vs last-week avg
  const half = Math.floor(docs.length / 2);
  const firstHalf = docs.slice(0, half);
  const secondHalf = docs.slice(-half);
  const avgFirst =
    firstHalf.reduce((s, d) => s + (d.efficiency_kwpton || 0), 0) / (firstHalf.length || 1);
  const avgLast =
    secondHalf.reduce((s, d) => s + (d.efficiency_kwpton || 0), 0) / (secondHalf.length || 1);
  const drift_pct = avgFirst > 0 ? Math.round(((avgLast - avgFirst) / avgFirst) * 1000) / 10 : 0;

  return { chiller_id: chillerId, readings: docs, drift_pct, avg_first: Math.round(avgFirst * 1000) / 1000, avg_last: Math.round(avgLast * 1000) / 1000 };
}

/**
 * Compute condenser approach temperature trend (condensing temp - ambient temp) using $setWindowFields.
 * Rising approach delta indicates fouling/scaling on water-cooled units.
 */
export async function getApproachTempTrend({ chillerId, lookbackDays = 90 }) {
  const db = await getDb();
  const startTime = new Date(Date.now() - lookbackDays * 86400_000).toISOString();

  const docs = await db
    .collection("telemetry")
    .aggregate([
      {
        $match: {
          chiller_id: chillerId,
          timestamp: { $gte: startTime },
          "readings.saturated_condensing_temp_f": { $exists: true, $gt: 0 },
          "readings.ambient_temp_f": { $exists: true, $gt: 0 },
        },
      },
      { $sort: { timestamp: 1 } },
      {
        $addFields: {
          ts: { $dateFromString: { dateString: "$timestamp" } },
          approach_delta_f: {
            $subtract: [
              "$readings.saturated_condensing_temp_f",
              "$readings.ambient_temp_f",
            ],
          },
        },
      },
      {
        $setWindowFields: {
          partitionBy: "$chiller_id",
          sortBy: { ts: 1 },
          output: {
            rolling_avg_approach: {
              $avg: "$approach_delta_f",
              window: { documents: [-6, 0] },
            },
            rolling_p90_approach: {
              $percentile: {
                input: "$approach_delta_f",
                p: [0.9],
                method: "approximate",
              },
              window: { documents: [-29, 0] },
            },
          },
        },
      },
      {
        $project: {
          _id: 0,
          chiller_id: 1,
          timestamp: 1,
          approach_delta_f: { $round: ["$approach_delta_f", 1] },
          rolling_avg_approach: { $round: ["$rolling_avg_approach", 1] },
        },
      },
    ])
    .toArray();

  const half = Math.floor(docs.length / 2);
  const firstHalf = docs.slice(0, half);
  const lastHalf = docs.slice(-half);
  const avgFirst =
    firstHalf.reduce((s, d) => s + (d.approach_delta_f || 0), 0) / (firstHalf.length || 1);
  const avgLast =
    lastHalf.reduce((s, d) => s + (d.approach_delta_f || 0), 0) / (lastHalf.length || 1);
  const drift_f = Math.round((avgLast - avgFirst) * 10) / 10;

  return {
    chiller_id: chillerId,
    readings: docs,
    approach_drift_f: drift_f,
    avg_approach_early_f: Math.round(avgFirst * 10) / 10,
    avg_approach_recent_f: Math.round(avgLast * 10) / 10,
  };
}

/**
 * Scan for pre-fault leading indicators across a customer fleet using $setWindowFields.
 * Detects sustained high motor/bearing temps or rising suction pressure variance.
 */
export async function scanForPreFaultPatterns({ chillerId, lookbackDays = 60 }) {
  const db = await getDb();
  const startTime = new Date(Date.now() - lookbackDays * 86400_000).toISOString();

  const matchFilter = { timestamp: { $gte: startTime } };
  if (chillerId) matchFilter.chiller_id = chillerId;

  const docs = await db
    .collection("telemetry")
    .aggregate([
      { $match: matchFilter },
      { $sort: { chiller_id: 1, timestamp: 1 } },
      {
        $addFields: {
          ts: { $dateFromString: { dateString: "$timestamp" } },
        },
      },
      {
        $setWindowFields: {
          partitionBy: "$chiller_id",
          sortBy: { ts: 1 },
          output: {
            avg_motor_temp: {
              $avg: "$readings.motor_winding_temp_f",
              window: { documents: [-6, 0] },
            },
            avg_bearing_temp: {
              $avg: "$readings.bearing_temp_f",
              window: { documents: [-6, 0] },
            },
            max_discharge_pressure: {
              $max: "$readings.discharge_pressure_psig",
              window: { documents: [-6, 0] },
            },
          },
        },
      },
      {
        $group: {
          _id: "$chiller_id",
          peak_avg_motor_temp: { $max: "$avg_motor_temp" },
          peak_avg_bearing_temp: { $max: "$avg_bearing_temp" },
          peak_discharge_pressure: { $max: "$max_discharge_pressure" },
          latest_motor_temp: { $last: "$readings.motor_winding_temp_f" },
          latest_bearing_temp: { $last: "$readings.bearing_temp_f" },
          latest_ts: { $last: "$timestamp" },
        },
      },
      {
        $addFields: {
          motor_temp_flag: { $gt: ["$peak_avg_motor_temp", 168] },
          bearing_temp_flag: { $gt: ["$peak_avg_bearing_temp", 120] },
          discharge_pressure_flag: { $gt: ["$peak_discharge_pressure", 185] },
        },
      },
      {
        $addFields: {
          flag_count: {
            $add: [
              { $cond: ["$motor_temp_flag", 1, 0] },
              { $cond: ["$bearing_temp_flag", 1, 0] },
              { $cond: ["$discharge_pressure_flag", 1, 0] },
            ],
          },
        },
      },
      { $sort: { flag_count: -1 } },
      {
        $project: {
          _id: 0,
          chiller_id: "$_id",
          motor_temp_flag: 1,
          bearing_temp_flag: 1,
          discharge_pressure_flag: 1,
          flag_count: 1,
          peak_avg_motor_temp: { $round: ["$peak_avg_motor_temp", 1] },
          peak_avg_bearing_temp: { $round: ["$peak_avg_bearing_temp", 1] },
          latest_motor_temp: 1,
          latest_bearing_temp: 1,
          latest_ts: 1,
        },
      },
    ])
    .toArray();

  return docs;
}

/**
 * Compare a unit's efficiency to same install-year cohort using $group and $lookup.
 * Returns the cohort average and this unit's percentile rank.
 */
export async function getFleetCohortAnalysis({ chillerId }) {
  const db = await getDb();

  // Get the target unit
  const unit = await db.collection("chillers").findOne({ chiller_id: chillerId }, { projection: { _id: 0 } });
  if (!unit) return null;

  const installYear = unit.install_date ? parseInt(unit.install_date.slice(0, 4)) : null;

  // Get efficiency stats per unit over last 30 days
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400_000).toISOString();
  const efficiencyStats = await db
    .collection("telemetry")
    .aggregate([
      {
        $match: {
          timestamp: { $gte: thirtyDaysAgo },
          "readings.power_kw": { $exists: true, $gt: 0 },
          "readings.cooling_tons": { $exists: true, $gt: 0 },
        },
      },
      {
        $group: {
          _id: "$chiller_id",
          avg_efficiency: {
            $avg: { $divide: ["$readings.power_kw", "$readings.cooling_tons"] },
          },
        },
      },
      {
        $lookup: {
          from: "chillers",
          localField: "_id",
          foreignField: "chiller_id",
          as: "chiller",
        },
      },
      { $unwind: "$chiller" },
      {
        $project: {
          _id: 0,
          chiller_id: "$_id",
          avg_efficiency: { $round: ["$avg_efficiency", 3] },
          rated_efficiency: "$chiller.rated_efficiency_kwpton",
          install_year: {
            $toInt: { $substr: ["$chiller.install_date", 0, 4] },
          },
          model_family: "$chiller.model_family",
        },
      },
    ])
    .toArray();

  const cohort = installYear
    ? efficiencyStats.filter((u) => u.install_year === installYear)
    : efficiencyStats;

  const cohortAvg =
    cohort.reduce((s, u) => s + u.avg_efficiency, 0) / (cohort.length || 1);
  const thisUnit = efficiencyStats.find((u) => u.chiller_id === chillerId);
  const thisEff = thisUnit?.avg_efficiency ?? null;

  // Rank within cohort
  const sorted = [...cohort].sort((a, b) => a.avg_efficiency - b.avg_efficiency);
  const rank = sorted.findIndex((u) => u.chiller_id === chillerId) + 1;
  const pctile = cohort.length > 1 ? Math.round((rank / cohort.length) * 100) : null;

  return {
    chiller_id: chillerId,
    install_year: installYear,
    cohort_size: cohort.length,
    cohort_avg_efficiency_kwpton: Math.round(cohortAvg * 1000) / 1000,
    this_unit_avg_efficiency_kwpton: thisEff,
    rated_efficiency_kwpton: unit.rated_efficiency_kwpton,
    rank_in_cohort: rank,
    percentile: pctile,
    cohort_members: cohort,
  };
}

/**
 * Get alarm summary (count per unit) for a customer fleet.
 * Uses aggregation with $group and $lookup.
 */
export async function getFleetAlarmSummary({ customerId, lookbackDays = 30 }) {
  const db = await getDb();
  const startTime = new Date(Date.now() - lookbackDays * 86400_000).toISOString();

  // Get all chiller_ids for this customer
  const chillerIds = (
    await db
      .collection("chillers")
      .find({ customer_id: customerId }, { projection: { chiller_id: 1 } })
      .toArray()
  ).map((c) => c.chiller_id);

  if (chillerIds.length === 0) return [];

  const summary = await db
    .collection("alarm_events")
    .aggregate([
      {
        $match: {
          chiller_id: { $in: chillerIds },
          triggered_at: { $gte: startTime },
        },
      },
      {
        $group: {
          _id: { chiller_id: "$chiller_id", severity: "$severity" },
          count: { $sum: 1 },
          latest: { $max: "$triggered_at" },
          alarm_codes: { $addToSet: "$alarm_code" },
        },
      },
      {
        $group: {
          _id: "$_id.chiller_id",
          total_alarms: { $sum: "$count" },
          by_severity: {
            $push: {
              severity: "$_id.severity",
              count: "$count",
              latest: "$latest",
              alarm_codes: "$alarm_codes",
            },
          },
          latest_alarm_at: { $max: "$latest" },
        },
      },
      { $sort: { total_alarms: -1 } },
      {
        $project: {
          _id: 0,
          chiller_id: "$_id",
          total_alarms: 1,
          by_severity: 1,
          latest_alarm_at: 1,
        },
      },
    ])
    .toArray();

  return summary;
}

/**
 * Get service contract status for a unit or customer's fleet.
 */
export async function getServiceContractStatus({ chillerId, customerId }) {
  const db = await getDb();
  const match = {};
  if (chillerId) match.chiller_id = chillerId;
  else if (customerId) match.customer_id = customerId;

  const today = new Date().toISOString().slice(0, 10);
  const in90Days = new Date(Date.now() + 90 * 86400_000).toISOString().slice(0, 10);

  const units = await db
    .collection("chillers")
    .aggregate([
      { $match: match },
      {
        $lookup: {
          from: "sites",
          localField: "site_id",
          foreignField: "site_id",
          as: "site",
        },
      },
      { $unwind: { path: "$site", preserveNullAndEmpty: true } },
      {
        $addFields: {
          contract_status: {
            $switch: {
              branches: [
                {
                  case: { $lt: ["$service_contract_expiry", today] },
                  then: "expired",
                },
                {
                  case: { $lte: ["$service_contract_expiry", in90Days] },
                  then: "expiring_soon",
                },
              ],
              default: "active",
            },
          },
          days_until_expiry: {
            $dateDiff: {
              startDate: { $dateFromString: { dateString: today } },
              endDate: {
                $dateFromString: { dateString: "$service_contract_expiry" },
              },
              unit: "day",
            },
          },
        },
      },
      {
        $project: {
          _id: 0,
          chiller_id: 1,
          site_id: 1,
          model_family: 1,
          model_number: 1,
          install_date: 1,
          service_contract_expiry: 1,
          contract_status: 1,
          days_until_expiry: 1,
          service_contract_tier: "$site.service_contract.tier",
          customer_name: "$site.customer_name",
        },
      },
      { $sort: { days_until_expiry: 1 } },
    ])
    .toArray();

  return units;
}
