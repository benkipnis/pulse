import { getDb } from "../db/client.js";
import { env } from "../config/env.js";
import {
  fusionScoreStages,
  isRerankStageError,
  knowledgeRerankTextExpr,
  rerankPipelineStages,
} from "../lib/rerank.js";

const HYBRID_WEIGHTS = { vector: 0.5, text: 0.5 };

function buildKnowledgeFilterClauses(type, filters = {}) {
  const clauses = [{ equals: { path: "type", value: type } }];
  if (filters.model_family) {
    clauses.push({ in: { path: "model_families", value: [filters.model_family] } });
  }
  if (filters.subsystem) {
    clauses.push({ equals: { path: "subsystem", value: filters.subsystem } });
  }
  if (filters.alarm_codes?.length) {
    clauses.push({ in: { path: "alarm_codes", value: filters.alarm_codes } });
  }
  return clauses;
}

function buildKnowledgePipeline({ query, type, filters, limit, candidateLimit, useRerank, vectorFilter, filterClauses }) {
  const fusionLimit = useRerank ? candidateLimit : limit;
  const pipeline = [
    {
      $rankFusion: {
        input: {
          pipelines: {
            vector: [
              {
                $vectorSearch: {
                  index: env.knowledgeVectorIndex,
                  path: "content",
                  query: { text: query },
                  numCandidates: 100,
                  limit: fusionLimit,
                  filter: vectorFilter,
                },
              },
            ],
            text: [
              {
                $search: {
                  index: env.knowledgeSearchIndex,
                  compound: {
                    must: [{ text: { query, path: ["title", "content"] } }],
                    filter: filterClauses,
                  },
                },
              },
              { $limit: fusionLimit },
            ],
          },
        },
        combination: { weights: HYBRID_WEIGHTS },
        scoreDetails: true,
      },
    },
    { $limit: fusionLimit },
  ];

  if (useRerank) {
    pipeline.push(
      ...rerankPipelineStages({
        query,
        context: filters,
        rerankTextExpr: knowledgeRerankTextExpr(),
        numDocsToRerank: candidateLimit,
      }),
      { $limit: limit }
    );
  } else {
    pipeline.push(...fusionScoreStages());
  }

  pipeline.push({
    $project: {
      doc_id: 1,
      type: 1,
      title: 1,
      content: 1,
      model_families: 1,
      subsystem: 1,
      alarm_codes: 1,
      source: 1,
      rrf_score: 1,
      score_details: 1,
      rerank_score: 1,
    },
  });

  return pipeline;
}

export async function searchKnowledge({ query, type, filters = {}, limit = 10 }) {
  const db = await getDb();
  const vectorFilter = { type: { $eq: type } };
  if (filters.model_family) {
    vectorFilter.model_families = { $in: [filters.model_family] };
  }
  if (filters.subsystem) {
    vectorFilter.subsystem = { $eq: filters.subsystem };
  }
  if (filters.alarm_codes?.length) {
    vectorFilter.alarm_codes = { $in: filters.alarm_codes };
  }

  const filterClauses = buildKnowledgeFilterClauses(type, filters);
  const useRerank = env.rerankEnabled;
  const candidateLimit = useRerank ? env.rerankCandidates : limit;

  const run = (rerank) =>
    db
      .collection("knowledge_documents")
      .aggregate(
        buildKnowledgePipeline({
          query,
          type,
          filters,
          limit,
          candidateLimit,
          useRerank: rerank,
          vectorFilter,
          filterClauses,
        })
      )
      .toArray();

  if (!useRerank) {
    return { results: await run(false), rerankApplied: false };
  }

  try {
    return { results: await run(true), rerankApplied: true };
  } catch (err) {
    if (isRerankStageError(err)) {
      return { results: await run(false), rerankApplied: false, rerankError: err.message };
    }
    throw err;
  }
}
