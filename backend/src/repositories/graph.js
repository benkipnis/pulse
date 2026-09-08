/**
 * Graph repository — $graphLookup traversals on equipment_topology.
 *
 * Leverages:
 *   - $graphLookup for recursive equipment/subsystem traversal
 *   - $lookup for joining related parts data
 *   - $unwind + $group for parts bundle aggregation
 */
import { getDb } from "../db/client.js";

/**
 * Traverse equipment topology graph starting from a given equipment_id.
 * Returns the full connected graph: root unit + all subsystems/sub-components.
 *
 * Uses $graphLookup: from=equipment_topology, connectFromField=equipment_id,
 * connectToField=parent_equipment_id to walk the tree.
 */
export async function getConnectedEquipmentGraph({ equipmentId, maxDepth = 4 }) {
  const db = await getDb();

  const result = await db
    .collection("equipment_topology")
    .aggregate([
      { $match: { equipment_id: equipmentId } },
      {
        $graphLookup: {
          from: "equipment_topology",
          startWith: "$equipment_id",
          connectFromField: "equipment_id",
          connectToField: "parent_equipment_id",
          as: "descendants",
          maxDepth,
          depthField: "depth_level",
        },
      },
      {
        $project: {
          _id: 0,
          root: {
            equipment_id: "$equipment_id",
            equipment_type: "$equipment_type",
            label: "$label",
            model: "$model",
            associated_parts: "$associated_parts",
          },
          descendants: {
            $map: {
              input: "$descendants",
              as: "d",
              in: {
                equipment_id: "$$d.equipment_id",
                parent_equipment_id: "$$d.parent_equipment_id",
                equipment_type: "$$d.equipment_type",
                label: "$$d.label",
                model: "$$d.model",
                associated_parts: "$$d.associated_parts",
                depth_level: "$$d.depth_level",
              },
            },
          },
        },
      },
    ])
    .toArray();

  if (!result.length) return null;

  const { root, descendants } = result[0];
  return {
    root,
    descendants: descendants.sort((a, b) => a.depth_level - b.depth_level),
    total_nodes: 1 + descendants.length,
  };
}

/**
 * Get a recommended parts bundle for a given equipment_id by traversing the
 * equipment graph and collecting all associated_parts from each node.
 *
 * Joins with parts_catalog to enrich with pricing and description.
 */
export async function getRelatedPartsBundle({ equipmentId }) {
  const db = await getDb();

  const result = await db
    .collection("equipment_topology")
    .aggregate([
      { $match: { equipment_id: equipmentId } },
      // Traverse descendants
      {
        $graphLookup: {
          from: "equipment_topology",
          startWith: "$equipment_id",
          connectFromField: "equipment_id",
          connectToField: "parent_equipment_id",
          as: "descendants",
          maxDepth: 4,
        },
      },
      // Combine root + descendants into a single array of nodes
      {
        $addFields: {
          all_nodes: {
            $concatArrays: [
              [
                {
                  equipment_id: "$equipment_id",
                  label: "$label",
                  associated_parts: "$associated_parts",
                },
              ],
              {
                $map: {
                  input: "$descendants",
                  as: "d",
                  in: {
                    equipment_id: "$$d.equipment_id",
                    label: "$$d.label",
                    associated_parts: { $ifNull: ["$$d.associated_parts", []] },
                  },
                },
              },
            ],
          },
        },
      },
      // Flatten all associated_parts across all nodes
      { $unwind: "$all_nodes" },
      { $unwind: "$all_nodes.associated_parts" },
      {
        $group: {
          _id: "$all_nodes.associated_parts",
          source_nodes: { $addToSet: "$all_nodes.label" },
        },
      },
      // Enrich with catalog data
      {
        $lookup: {
          from: "parts_catalog",
          localField: "_id",
          foreignField: "part_id",
          as: "catalog",
        },
      },
      { $unwind: { path: "$catalog", preserveNullAndEmptyArrays: true } },
      {
        $project: {
          _id: 0,
          part_id: "$_id",
          part_number: "$catalog.part_number",
          description: "$catalog.description",
          category: "$catalog.category",
          list_price_usd: "$catalog.list_price_usd",
          lead_time_days: "$catalog.lead_time_days",
          source_nodes: 1,
        },
      },
      { $sort: { category: 1, part_id: 1 } },
    ])
    .toArray();

  const total_list_price = result.reduce((s, p) => s + (p.list_price_usd || 0), 0);

  return {
    equipment_id: equipmentId,
    parts: result,
    total_parts: result.length,
    total_list_price_usd: Math.round(total_list_price * 100) / 100,
  };
}
