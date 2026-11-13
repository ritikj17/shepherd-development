import {
  listIncidentAnalyses,
  listIncidentEvidence,
  listIncidents,
  listSafetySessions,
  listTrustedContacts,
} from "@/lib/api";
import type {
  Evidence,
  Incident,
  SafetySession,
  ThreatAnalysis,
  TrustedContact,
} from "@/lib/types/api";
import { displaySessionStatus } from "@/components/shared/status-badges";

export interface DashboardData {
  totalIncidents: number;
  openIncidents: number;
  archivedIncidents: number;
  recentIncidents: Incident[];
  evidence: Evidence[];
  totalEvidenceBytes: number;
  lastEvidenceAt: string | null;
  analyses: ThreatAnalysis[];
  completedAnalyses: number;
  sessions: SafetySession[];
  activeSessions: SafetySession[];
  contacts: TrustedContact[];
  contactsById: Record<string, TrustedContact>;
  recentIncidentCount: number;
}

const EMPTY_LIST = { items: [] };

export async function loadDashboardData(): Promise<DashboardData> {
  const [incidentsResponse, sessionsResponse, contactsResponse] =
    await Promise.all([
      listIncidents({ limit: 100 }),
      listSafetySessions(),
      listTrustedContacts(),
    ]);

  const recentIncidents = incidentsResponse.items.slice(0, 5);

  const [evidenceGroups, analysisGroups] = await Promise.all([
    Promise.all(
      recentIncidents.map(async (incident) => {
        try {
          const response = await listIncidentEvidence(incident.id);
          return response.items;
        } catch {
          return EMPTY_LIST.items;
        }
      }),
    ),
    Promise.all(
      recentIncidents.map(async (incident) => {
        try {
          const response = await listIncidentAnalyses(incident.id);
          return response.items;
        } catch {
          return EMPTY_LIST.items;
        }
      }),
    ),
  ]);

  const evidence = evidenceGroups.flat();
  const analyses = analysisGroups
    .flat()
    .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));

  const lastEvidenceAt =
    evidence.length > 0
      ? evidence.reduce(
          (latest, item) =>
            Date.parse(item.uploaded_at) > Date.parse(latest)
              ? item.uploaded_at
              : latest,
          evidence[0].uploaded_at,
        )
      : null;

  const contactsById = Object.fromEntries(
    contactsResponse.items.map((contact) => [contact.id, contact]),
  );

  return {
    totalIncidents: incidentsResponse.total,
    openIncidents: incidentsResponse.items.filter(
      (incident) => incident.status === "open",
    ).length,
    archivedIncidents: incidentsResponse.items.filter(
      (incident) => incident.status === "archived",
    ).length,
    recentIncidents,
    evidence,
    totalEvidenceBytes: evidence.reduce(
      (total, item) => total + item.size_bytes,
      0,
    ),
    lastEvidenceAt,
    analyses,
    completedAnalyses: analyses.filter((analysis) => analysis.status === "completed")
      .length,
    sessions: sessionsResponse.items,
    activeSessions: sessionsResponse.items.filter(
      (session) => displaySessionStatus(session) === "active",
    ),
    contacts: contactsResponse.items,
    contactsById,
    recentIncidentCount: recentIncidents.length,
  };
}
