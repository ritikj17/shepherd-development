import { apiRequest } from "@/lib/api/client";
import { isMockApiEnabled } from "@/lib/api/config";
import { mockGenerateReport } from "@/lib/api/mock/reports";
import type { GenerateReportInput, GeneratedReport } from "@/lib/types/api";

export async function generateIncidentReport(
  incidentId: string,
  input: GenerateReportInput,
): Promise<GeneratedReport> {
  if (isMockApiEnabled) return mockGenerateReport(incidentId);
  return apiRequest<GeneratedReport>(`/reports/${incidentId}`, {
    method: "POST",
    body: input,
    timeoutMs: 60_000,
  });
}
