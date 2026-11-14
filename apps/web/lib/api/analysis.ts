import { apiRequest } from "@/lib/api/client";
import { isMockApiEnabled } from "@/lib/api/config";
import {
  mockListAnalyses,
  mockRequestAnalysis,
} from "@/lib/api/mock/analysis";
import type {
  AnalysisListResponse,
  RequestAnalysisInput,
  ThreatAnalysis,
} from "@/lib/types/api";

export async function requestIncidentAnalysis(
  incidentId: string,
  input: RequestAnalysisInput,
): Promise<ThreatAnalysis> {
  if (isMockApiEnabled) return mockRequestAnalysis(incidentId, input);
  return apiRequest<ThreatAnalysis>(`/incidents/${incidentId}/analysis`, {
    method: "POST",
    body: input,
  });
}

export async function listIncidentAnalyses(
  incidentId: string,
): Promise<AnalysisListResponse> {
  if (isMockApiEnabled) return mockListAnalyses(incidentId);
  return apiRequest<AnalysisListResponse>(`/incidents/${incidentId}/analysis`);
}
