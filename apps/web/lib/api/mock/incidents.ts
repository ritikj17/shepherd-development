import {
  delay,
  mockId,
  readDatabase,
  updateDatabase,
} from "@/lib/api/mock/store";
import { mockError } from "@/lib/api/mock/errors";
import type {
  CreateIncidentInput,
  Incident,
  IncidentListParams,
  IncidentListResponse,
  UpdateIncidentInput,
} from "@/lib/types/api";

export async function mockListIncidents(
  params: IncidentListParams = {},
): Promise<IncidentListResponse> {
  await delay();
  const database = readDatabase();
  const limit = Math.min(params.limit ?? 20, 100);
  const offset = params.offset ?? 0;

  let items = [...database.incidents].sort(
    (a, b) => Date.parse(b.occurred_at) - Date.parse(a.occurred_at),
  );

  if (params.category) {
    items = items.filter((incident) => incident.category === params.category);
  }
  if (params.status) {
    items = items.filter((incident) => incident.status === params.status);
  }

  return {
    items: items.slice(offset, offset + limit),
    total: items.length,
    limit,
    offset,
  };
}

export async function mockGetIncident(id: string): Promise<Incident> {
  await delay(220);
  const incident = readDatabase().incidents.find((item) => item.id === id);
  if (!incident) {
    throw mockError(404, "NOT_FOUND", "That incident could not be found.");
  }
  return incident;
}

export async function mockCreateIncident(
  input: CreateIncidentInput,
): Promise<Incident> {
  await delay(420);
  const now = new Date().toISOString();
  const incident: Incident = {
    id: mockId(),
    title: input.title,
    description: input.description,
    category: input.category,
    occurred_at: input.occurred_at,
    location_description: input.location_description || null,
    status: "open",
    created_at: now,
    updated_at: now,
  };

  updateDatabase((database) => ({
    ...database,
    incidents: [incident, ...database.incidents],
  }));

  return incident;
}

export async function mockUpdateIncident(
  id: string,
  input: UpdateIncidentInput,
): Promise<Incident> {
  await delay(360);
  let updated: Incident | null = null;

  updateDatabase((database) => {
    const existing = database.incidents.find((item) => item.id === id);
    if (!existing) return database;

    updated = {
      ...existing,
      ...input,
      location_description:
        input.location_description !== undefined
          ? input.location_description || null
          : existing.location_description,
      updated_at: new Date().toISOString(),
    };

    return {
      ...database,
      incidents: database.incidents.map((item) =>
        item.id === id ? (updated as Incident) : item,
      ),
    };
  });

  if (!updated) {
    throw mockError(404, "NOT_FOUND", "That incident could not be found.");
  }
  return updated;
}

export async function mockDeleteIncident(id: string): Promise<void> {
  await delay(420);
  const database = readDatabase();
  if (!database.incidents.some((item) => item.id === id)) {
    throw mockError(404, "NOT_FOUND", "That incident could not be found.");
  }

  const removedEvidenceIds = new Set(
    database.evidence
      .filter((item) => item.incident_id === id)
      .map((item) => item.id),
  );

  const verifications = { ...database.verifications };
  removedEvidenceIds.forEach((evidenceId) => {
    delete verifications[evidenceId];
  });

  updateDatabase((current) => ({
    ...current,
    incidents: current.incidents.filter((item) => item.id !== id),
    evidence: current.evidence.filter((item) => item.incident_id !== id),
    analyses: current.analyses.filter((item) => item.incident_id !== id),
    links: current.links.filter(
      (link) => link.source !== id && link.target !== id,
    ),
    sessions: current.sessions.map((session) =>
      session.incident_id === id ? { ...session, incident_id: null } : session,
    ),
    reports: current.reports.filter((report) => report.incident_id !== id),
    verifications,
  }));
}
