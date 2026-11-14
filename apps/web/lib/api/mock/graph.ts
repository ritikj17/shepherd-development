import { delay, readDatabase } from "@/lib/api/mock/store";
import { mockError } from "@/lib/api/mock/errors";
import type { GraphEdge, GraphNode, IncidentGraph } from "@/lib/types/api";

export async function mockGetIncidentGraph(
  incidentId: string,
): Promise<IncidentGraph> {
  await delay(520);
  const database = readDatabase();
  const incident = database.incidents.find((item) => item.id === incidentId);
  if (!incident) {
    throw mockError(404, "NOT_FOUND", "That incident could not be found.");
  }

  const edges: GraphEdge[] = database.links.filter(
    (link) => link.source === incidentId || link.target === incidentId,
  );

  const nodeIds = new Set<string>([incidentId]);
  edges.forEach((edge) => {
    nodeIds.add(edge.source);
    nodeIds.add(edge.target);
  });

  const nodes: GraphNode[] = database.incidents
    .filter((item) => nodeIds.has(item.id))
    .map((item) => ({
      id: item.id,
      label: item.title,
      category: item.category,
    }));

  return { incident_id: incidentId, nodes, edges };
}
