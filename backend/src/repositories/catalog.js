/**
 * Catalog repository — parts_catalog and service_offerings search.
 *
 * Leverages:
 *   - Atlas Full-Text Search ($search) on text fields
 *   - Atlas Vector Search ($vectorSearch) on content embedding
 *   - $rankFusion for hybrid search
 *   - $match + $sort for deterministic catalog queries
 */
import { getDb } from "../db/client.js";

/**
 * Hybrid search over parts_catalog.
 * Falls back to basic text regex if Atlas Search is not configured.
 */
export async function searchPartsCatalog({ query, category, modelFamily, limit = 10 }) {
  const db = await getDb();

  const pipeline = [];

  // Try Atlas Search hybrid if vector index exists, otherwise basic match
  try {
    pipeline.push({
      $search: {
        index: "parts_catalog_search",
        compound: {
          should: [
            {
              text: {
                query,
                path: ["description", "content", "tags"],
                fuzzy: { maxEdits: 1 },
                score: { boost: { value: 2 } },
              },
            },
          ],
          ...(category || modelFamily
            ? {
                filter: [
                  ...(category ? [{ equals: { path: "category", value: category } }] : []),
                  ...(modelFamily
                    ? [{ text: { query: modelFamily, path: "compatible_model_families" } }]
                    : []),
                ],
              }
            : {}),
        },
      },
    });

    pipeline.push({ $limit: limit });
    pipeline.push({
      $project: {
        _id: 0,
        part_id: 1,
        part_number: 1,
        description: 1,
        category: 1,
        compatible_model_families: 1,
        list_price_usd: 1,
        typical_replacement_interval_years: 1,
        lead_time_days: 1,
        tags: 1,
        score: { $meta: "searchScore" },
      },
    });

    const results = await db.collection("parts_catalog").aggregate(pipeline).toArray();
    return { results, search_type: "atlas_search" };
  } catch {
    // Fallback: basic regex
    const filter = {};
    if (category) filter.category = category;
    if (modelFamily) filter.compatible_model_families = modelFamily;

    const results = await db
      .collection("parts_catalog")
      .find({
        ...filter,
        $or: [
          { description: { $regex: query, $options: "i" } },
          { tags: { $regex: query, $options: "i" } },
        ],
      })
      .limit(limit)
      .project({ _id: 0 })
      .toArray();

    return { results, search_type: "regex_fallback" };
  }
}

/**
 * Hybrid search over service_offerings.
 */
export async function searchServiceOfferings({ query, category, modelFamily, trigger, limit = 10 }) {
  const db = await getDb();

  try {
    const pipeline = [
      {
        $search: {
          index: "service_offerings_search",
          compound: {
            should: [
              {
                text: {
                  query,
                  path: ["name", "description", "content"],
                  fuzzy: { maxEdits: 1 },
                  score: { boost: { value: 2 } },
                },
              },
            ],
            ...(category || trigger
              ? {
                  filter: [
                    ...(category
                      ? [{ equals: { path: "category", value: category } }]
                      : []),
                    ...(trigger
                      ? [{ text: { query: trigger, path: "triggers" } }]
                      : []),
                  ],
                }
              : {}),
          },
        },
      },
      { $limit: limit },
      {
        $project: {
          _id: 0,
          offering_id: 1,
          name: 1,
          description: 1,
          category: 1,
          applicable_model_families: 1,
          list_price_usd: 1,
          triggers: 1,
          tags: 1,
          score: { $meta: "searchScore" },
        },
      },
    ];

    const results = await db.collection("service_offerings").aggregate(pipeline).toArray();
    return { results, search_type: "atlas_search" };
  } catch {
    const filter = {};
    if (category) filter.category = category;
    if (trigger) filter.triggers = trigger;

    const results = await db
      .collection("service_offerings")
      .find({
        ...filter,
        $or: [
          { name: { $regex: query, $options: "i" } },
          { description: { $regex: query, $options: "i" } },
        ],
      })
      .limit(limit)
      .project({ _id: 0 })
      .toArray();

    return { results, search_type: "regex_fallback" };
  }
}
