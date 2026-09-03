import { env } from "../config/env.js";

export function joinStringArrayExpr(fieldPath) {
  return {
    $reduce: {
      input: { $ifNull: [fieldPath, []] },
      initialValue: "",
      in: {
        $concat: [
          "$$value",
          { $cond: [{ $eq: ["$$value", ""] }, "", ", "] },
          { $convert: { input: "$$this", to: "string", onError: "", onNull: "" } },
        ],
      },
    },
  };
}

export function buildRerankQuery(query, context = {}) {
  const alarmCodes = context.alarm_codes || context.related_alarm_codes || [];
  const parts = [];
  if (context.model_family) parts.push(`model family ${context.model_family}`);
  if (alarmCodes.length) parts.push(`alarm code(s) ${alarmCodes.join(", ")}`);
  if (context.subsystem) parts.push(`subsystem ${context.subsystem}`);
  if (!parts.length) return query;
  return `Prefer passages that apply to ${parts.join(", ")}.\n\n${query}`;
}

export function knowledgeRerankTextExpr() {
  return {
    $concat: [
      { $ifNull: ["$title", ""] },
      "\n",
      { $ifNull: ["$content", ""] },
      "\nAlarms: ",
      joinStringArrayExpr("$alarm_codes"),
      "\nModel: ",
      joinStringArrayExpr("$model_families"),
      "\nSubsystem: ",
      { $ifNull: ["$subsystem", ""] },
    ],
  };
}

export function caseRerankTextExpr() {
  return {
    $concat: [
      { $ifNull: ["$searchable_narrative", ""] },
      "\nSymptom: ",
      { $ifNull: ["$reported_symptom", ""] },
      "\nResolution: ",
      { $ifNull: ["$resolution", ""] },
      "\nRoot cause: ",
      { $ifNull: ["$root_cause", ""] },
      "\nAlarms: ",
      joinStringArrayExpr("$related_alarm_codes"),
    ],
  };
}

export function rerankPipelineStages({ query, context, rerankTextExpr, numDocsToRerank }) {
  return [
    {
      $addFields: {
        rrf_score: { $meta: "score" },
        score_details: { $meta: "searchScoreDetails" },
      },
    },
    { $set: { rerank_text: rerankTextExpr } },
    {
      $rerank: {
        model: env.rerankModel,
        query: { text: buildRerankQuery(query, context) },
        path: "rerank_text",
        numDocsToRerank,
      },
    },
    { $addFields: { rerank_score: { $meta: "score" } } },
  ];
}

export function fusionScoreStages() {
  return [
    {
      $addFields: {
        rrf_score: { $meta: "score" },
        score_details: { $meta: "searchScoreDetails" },
      },
    },
  ];
}

export function isRerankStageError(err) {
  const message = String(err?.message || err || "").toLowerCase();
  return message.includes("rerank") || message.includes("native reranking");
}

export function rerankInsightMeta() {
  if (!env.rerankEnabled) return null;
  return {
    model: env.rerankModel,
    path: "rerank_text",
    numDocsToRerank: env.rerankCandidates,
  };
}
