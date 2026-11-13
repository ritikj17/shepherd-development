import { apiRequest } from "@/lib/api/client";
import { isMockApiEnabled } from "@/lib/api/config";
import {
  mockCreateIncident,
  mockDeleteIncident,
  mockGetIncident,
  mockListIncidents,
  mockUpdateIncident,
} from "@/lib/api/mock/incidents";
import type {
  CreateIncidentInput,
  Incident,
  IncidentListParams,
  IncidentListResponse,
  UpdateIncidentInput,
} from "@/lib/types/api";

function toQuery(params: IncidentListParams): string {
  const query = new URLSearchParams();
  if (params.limit !== undefined) query.set("limit", String(params.limit));
  if (params.offset !== undefined) query.set("offset", String(params.offset));
  if (params.category) query.set("category", params.category);
  if (params.status) query.set("status", params.status);
  const serialized = query.toString();
  return serialized ? `?${serialized}` : "";
}

export async function listIncidents(
  params: IncidentListParams = {},
): Promise<IncidentListResponse> {
  if (isMockApiEnabled) return mockListIncidents(params);
  return apiRequest<IncidentListResponse>(`/incidents${toQuery(params)}`);
}

export async function getIncident(id: string): Promise<Incident> {
  if (isMockApiEnabled) return mockGetIncident(id);
  return apiRequest<Incident>(`/incidents/${id}`);
}

export async function createIncident(
  input: CreateIncidentInput,
): Promise<Incident> {
  if (isMockApiEnabled) return mockCreateIncident(input);
  return apiRequest<Incident>("/incidents", { method: "POST", body: input });
}

export async function updateIncident(
  id: string,
  input: UpdateIncidentInput,
): Promise<Incident> {
  if (isMockApiEnabled) return mockUpdateIncident(id, input);
  return apiRequest<Incident>(`/incidents/${id}`, {
    method: "PATCH",
    body: input,
  });
}

export async function deleteIncident(id: string): Promise<void> {
  if (isMockApiEnabled) return mockDeleteIncident(id);
  return apiRequest<void>(`/incidents/${id}`, { method: "DELETE" });
}
