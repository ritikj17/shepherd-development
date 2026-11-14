import {
  getIncident,
  listIncidentAnalyses,
  listIncidentEvidence,
  listSafetySessions,
} from "@/lib/api";
import type {
  Evidence,
  Incident,
  SafetySession,
  ThreatAnalysis,
} from "@/lib/types/api";

export interface IncidentDetailData {
  incident: Incident;
  evidence: Evidence[];
  analyses: ThreatAnalysis[];
  sessions: SafetySession[];
}

export async function loadIncidentDetail(
  incidentId: string,
): Promise<IncidentDetailData> {
  const incident = await getIncident(incidentId);

  const [evidenceResponse, analysisResponse, sessionsResponse] =
    await Promise.all([
      listIncidentEvidence(incidentId).catch(() => ({ items: [] })),
      listIncidentAnalyses(incidentId).catch(() => ({ items: [] })),
      listSafetySessions().catch(() => ({ items: [] })),
    ]);

  return {
    incident,
    evidence: evidenceResponse.items,
    analyses: analysisResponse.items,
    sessions: sessionsResponse.items.filter(
      (session) => session.incident_id === incidentId,
    ),
  };
}
