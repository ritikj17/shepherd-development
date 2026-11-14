import { apiRequest } from "@/lib/api/client";
import { isMockApiEnabled } from "@/lib/api/config";
import {
  mockAcknowledgeRelay,
  mockGetActiveSentinelSession,
  mockGetLiveTimeline,
  mockGetRelayDetails,
  mockPauseSentinelSession,
  mockRespondToVerification,
  mockResumeSentinelSession,
  mockSendSentinelLocation,
  mockStartSentinelSession,
  mockStopSentinelSession,
  mockTriggerSilentAssist,
} from "@/lib/api/mock/sentinel";
import type {
  ContactAcknowledgeInput,
  ContactRelayData,
  LocationIngestResponse,
  LocationUpdateInput,
  SentinelSession,
  SentinelSessionCreateInput,
  SilentAssistResponse,
  SilentAssistTriggerInput,
  TimelineEventListResponse,
  VerificationResponseInput,
} from "@/lib/types/sentinel";

export async function startSentinelSession(
  input: SentinelSessionCreateInput,
): Promise<SentinelSession> {
  if (isMockApiEnabled) return mockStartSentinelSession(input);
  return apiRequest<SentinelSession>("/sentinel/sessions", {
    method: "POST",
    body: input,
  });
}

export async function getActiveSentinelSession(): Promise<SentinelSession | null> {
  if (isMockApiEnabled) return mockGetActiveSentinelSession();
  try {
    return await apiRequest<SentinelSession | null>("/sentinel/sessions/active");
  } catch {
    return null;
  }
}

export async function pauseSentinelSession(sessionId: string): Promise<SentinelSession> {
  if (isMockApiEnabled) return mockPauseSentinelSession(sessionId);
  return apiRequest<SentinelSession>(`/sentinel/sessions/${sessionId}/pause`, {
    method: "POST",
  });
}

export async function resumeSentinelSession(sessionId: string): Promise<SentinelSession> {
  if (isMockApiEnabled) return mockResumeSentinelSession(sessionId);
  return apiRequest<SentinelSession>(`/sentinel/sessions/${sessionId}/resume`, {
    method: "POST",
  });
}

export async function stopSentinelSession(
  sessionId: string,
  reason: string = "completed",
): Promise<SentinelSession> {
  if (isMockApiEnabled) return mockStopSentinelSession(sessionId, reason);
  return apiRequest<SentinelSession>(
    `/sentinel/sessions/${sessionId}/stop?reason=${encodeURIComponent(reason)}`,
    {
      method: "POST",
    },
  );
}

export async function sendSentinelLocation(
  sessionId: string,
  location: LocationUpdateInput,
): Promise<LocationIngestResponse> {
  if (isMockApiEnabled) return mockSendSentinelLocation(sessionId, location);
  return apiRequest<LocationIngestResponse>(
    `/sentinel/sessions/${sessionId}/location`,
    {
      method: "POST",
      body: location,
    },
  );
}

export async function respondToVerification(
  sessionId: string,
  verificationId: string,
  input: VerificationResponseInput,
): Promise<Record<string, unknown>> {
  if (isMockApiEnabled) return mockRespondToVerification(sessionId, verificationId, input);
  return apiRequest<Record<string, unknown>>(
    `/sentinel/sessions/${sessionId}/verifications/${verificationId}/respond`,
    {
      method: "POST",
      body: input,
    },
  );
}

export async function triggerSilentAssist(
  input: SilentAssistTriggerInput,
): Promise<SilentAssistResponse> {
  if (isMockApiEnabled) return mockTriggerSilentAssist(input);
  return apiRequest<SilentAssistResponse>("/sentinel/silent-assist", {
    method: "POST",
    body: input,
  });
}

export async function getLiveTimeline(params?: {
  incidentId?: string;
  sessionId?: string;
}): Promise<TimelineEventListResponse> {
  if (isMockApiEnabled) return mockGetLiveTimeline(params);
  const query = new URLSearchParams();
  if (params?.incidentId) query.set("incident_id", params.incidentId);
  if (params?.sessionId) query.set("session_id", params.sessionId);
  const qs = query.toString() ? `?${query.toString()}` : "";
  return apiRequest<TimelineEventListResponse>(`/sentinel/timeline${qs}`);
}

export async function getRelayDetails(token: string): Promise<ContactRelayData> {
  if (isMockApiEnabled) return mockGetRelayDetails(token);
  return apiRequest<ContactRelayData>(`/relay/${token}`, { auth: false });
}

export async function acknowledgeRelay(
  token: string,
  input: ContactAcknowledgeInput,
): Promise<ContactRelayData> {
  if (isMockApiEnabled) return mockAcknowledgeRelay(token, input);
  return apiRequest<ContactRelayData>(`/relay/${token}/acknowledge`, {
    method: "POST",
    body: input,
    auth: false,
  });
}
