import { apiRequest } from "@/lib/api/client";
import { isMockApiEnabled } from "@/lib/api/config";
import { mockGetIncidentGraph } from "@/lib/api/mock/graph";
import type { IncidentGraph } from "@/lib/types/api";

export async function getIncidentGraph(
  incidentId: string,
): Promise<IncidentGraph> {
  if (isMockApiEnabled) return mockGetIncidentGraph(incidentId);
  return apiRequest<IncidentGraph>(`/graph/${incidentId}`);
}
