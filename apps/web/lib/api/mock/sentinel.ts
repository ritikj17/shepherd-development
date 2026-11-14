import type {
  ContactAcknowledgeInput,
  ContactRelayData,
  LiveIncidentEvent,
  LocationIngestResponse,
  LocationUpdateInput,
  SentinelSession,
  SentinelSessionCreateInput,
  SilentAssistResponse,
  SilentAssistTriggerInput,
  TimelineEventListResponse,
  VerificationResponseInput,
} from "@/lib/types/sentinel";

let mockActiveSession: SentinelSession | null = null;
const mockTimeline: LiveIncidentEvent[] = [];
const mockRelays: Record<string, ContactRelayData> = {};

export async function mockStartSentinelSession(
  input: SentinelSessionCreateInput,
): Promise<SentinelSession> {
  const now = new Date().toISOString();
  const session: SentinelSession = {
    id: `sentinel-${Date.now()}`,
    user_id: "demo-user-id",
    incident_id: input.incident_id ?? null,
    status: "active",
    destination_name: input.destination_name,
    destination_lat: input.destination_lat ?? null,
    destination_lng: input.destination_lng ?? null,
    expected_arrival: input.expected_arrival,
    travel_mode: input.travel_mode,
    trusted_contact_ids: input.trusted_contact_ids ?? [],
    share_location: input.share_location ?? true,
    verification_timeout_seconds: input.verification_timeout_seconds ?? 60,
    concern_level: "normal",
    last_location: input.start_lat && input.start_lng ? {
      latitude: input.start_lat,
      longitude: input.start_lng,
      accuracy: 10,
      timestamp: now,
    } : null,
    active_anomaly: null,
    active_verification: null,
    created_at: now,
    updated_at: now,
    is_demo: input.is_demo ?? true,
  };

  mockActiveSession = session;
  mockTimeline.push({
    id: `ev-${Date.now()}`,
    session_id: session.id,
    event_type: "session_started",
    timestamp: now,
    actor: "user",
    status: "info",
    title: "Sentinel Safety Monitoring Started",
    description: `Destination: ${input.destination_name} (${input.travel_mode}). Expected by ${new Date(input.expected_arrival).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}.`,
  });

  return session;
}

export async function mockGetActiveSentinelSession(): Promise<SentinelSession | null> {
  return mockActiveSession;
}

export async function mockPauseSentinelSession(sessionId: string): Promise<SentinelSession> {
  if (!mockActiveSession || mockActiveSession.id !== sessionId) {
    throw new Error("Session not found");
  }
  mockActiveSession = { ...mockActiveSession, status: "paused", updated_at: new Date().toISOString() };
  mockTimeline.push({
    id: `ev-${Date.now()}`,
    session_id: sessionId,
    event_type: "session_paused",
    timestamp: new Date().toISOString(),
    actor: "user",
    status: "info",
    title: "Monitoring Paused",
    description: "User paused foreground safety monitoring.",
  });
  return mockActiveSession;
}

export async function mockResumeSentinelSession(sessionId: string): Promise<SentinelSession> {
  if (!mockActiveSession || mockActiveSession.id !== sessionId) {
    throw new Error("Session not found");
  }
  mockActiveSession = { ...mockActiveSession, status: "active", updated_at: new Date().toISOString() };
  mockTimeline.push({
    id: `ev-${Date.now()}`,
    session_id: sessionId,
    event_type: "session_resumed",
    timestamp: new Date().toISOString(),
    actor: "user",
    status: "info",
    title: "Monitoring Resumed",
    description: "User resumed foreground safety monitoring.",
  });
  return mockActiveSession;
}

export async function mockStopSentinelSession(
  sessionId: string,
  reason: string = "completed",
): Promise<SentinelSession> {
  if (!mockActiveSession || mockActiveSession.id !== sessionId) {
    throw new Error("Session not found");
  }
  const status = reason === "completed" ? "completed" : "cancelled";
  const updated: SentinelSession = {
    ...mockActiveSession,
    status,
    concern_level: "normal",
    updated_at: new Date().toISOString(),
  };
  mockActiveSession = null;
  mockTimeline.push({
    id: `ev-${Date.now()}`,
    session_id: sessionId,
    event_type: `session_${status}`,
    timestamp: new Date().toISOString(),
    actor: "user",
    status: "info",
    title: `Monitoring ${status === "completed" ? "Completed" : "Cancelled"}`,
    description: `Journey ended safely. Reason: ${reason}.`,
  });
  return updated;
}

export async function mockSendSentinelLocation(
  sessionId: string,
  location: LocationUpdateInput,
): Promise<LocationIngestResponse> {
  if (!mockActiveSession || mockActiveSession.id !== sessionId) {
    return {
      status: "ignored",
      concern_level: "normal",
      verification_required: false,
    };
  }

  mockActiveSession.last_location = {
    latitude: location.latitude,
    longitude: location.longitude,
    accuracy: location.accuracy,
    speed: location.speed,
    heading: location.heading,
    timestamp: location.timestamp ?? new Date().toISOString(),
  };

  return {
    status: "recorded",
    concern_level: mockActiveSession.concern_level,
    verification_required: mockActiveSession.concern_level === "warning" || mockActiveSession.concern_level === "critical",
    anomaly: mockActiveSession.active_anomaly,
    verification: mockActiveSession.active_verification,
  };
}

export async function mockRespondToVerification(
  sessionId: string,
  verificationId: string,
  input: VerificationResponseInput,
): Promise<Record<string, unknown>> {
  const now = new Date().toISOString();
  if (mockActiveSession) {
    mockActiveSession.active_verification = null;
    if (input.response === "safe") {
      mockActiveSession.concern_level = "normal";
      mockActiveSession.active_anomaly = null;
    }
  }

  mockTimeline.push({
    id: `ev-${Date.now()}`,
    session_id: sessionId,
    event_type: input.response === "safe" ? "user_confirmed_safe" : "user_distress_signalled",
    timestamp: now,
    actor: "user",
    status: input.response === "safe" ? "success" : "distress",
    title: input.response === "safe" ? "User Confirmed Safe" : "Help Requested",
    description: input.user_note || (input.response === "safe" ? "Safety verification answered affirmatively." : "Assistance requested."),
  });

  return { status: input.response, verification_id: verificationId, resolved_at: now };
}

export async function mockTriggerSilentAssist(
  input: SilentAssistTriggerInput,
): Promise<SilentAssistResponse> {
  const now = new Date().toISOString();
  const incidentId = input.incident_id || `inc-silent-${Date.now()}`;
  const relayToken = `relay-token-${Date.now().toString(36)}`;

  mockRelays[relayToken] = {
    token: relayToken,
    alert_id: `alert-${Date.now()}`,
    session_id: input.session_id,
    incident_id: incidentId,
    user_display_name: "Anushka (Demo User)",
    reason: "Silent Assist distress signal triggered by user.",
    timestamp: now,
    expires_at: new Date(Date.now() + 4 * 3600 * 1000).toISOString(),
    last_location: input.current_lat && input.current_lng ? {
      latitude: input.current_lat,
      longitude: input.current_lng,
      accuracy: input.accuracy ?? 10,
    } : null,
    status: "pending",
  };

  mockTimeline.push({
    id: `ev-${Date.now()}`,
    incident_id: incidentId,
    session_id: input.session_id,
    event_type: "silent_assist_triggered",
    timestamp: now,
    actor: "user",
    status: "distress",
    title: "Silent Assist Triggered",
    description: "One-touch distress signal activated. Immediate trusted contact rescue relay initiated.",
    metadata: {
      latitude: input.current_lat,
      longitude: input.current_lng,
      accuracy: input.accuracy,
    },
  });

  return {
    status: "escalated",
    incident_id: incidentId,
    triggered_at: now,
    relay_token: relayToken,
    escalation: {
      contacts_notified: 1,
      relay_token: relayToken,
      relay_url: `/relay/${relayToken}`,
      expires_at: new Date(Date.now() + 4 * 3600 * 1000).toISOString(),
      message: "Rescue relay active.",
    },
  };
}

export async function mockGetLiveTimeline(
  params?: { incidentId?: string; sessionId?: string },
): Promise<TimelineEventListResponse> {
  let filtered = [...mockTimeline];
  if (params?.incidentId) {
    filtered = filtered.filter((e) => e.incident_id === params.incidentId);
  }
  if (params?.sessionId) {
    filtered = filtered.filter((e) => e.session_id === params.sessionId);
  }
  return { items: filtered.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()) };
}

export async function mockGetRelayDetails(token: string): Promise<ContactRelayData> {
  const relay = mockRelays[token];
  if (!relay) {
    return {
      token,
      alert_id: "demo-alert-id",
      user_display_name: "Anushka (Demo User)",
      reason: "Live Rescue Relay simulation active.",
      timestamp: new Date().toISOString(),
      expires_at: new Date(Date.now() + 4 * 3600 * 1000).toISOString(),
      last_location: { latitude: 28.6139, longitude: 77.2090, accuracy: 12 },
      status: "pending",
    };
  }
  return relay;
}

export async function mockAcknowledgeRelay(
  token: string,
  input: ContactAcknowledgeInput,
): Promise<ContactRelayData> {
  const now = new Date().toISOString();
  const existing = mockRelays[token] || {
    token,
    alert_id: "demo-alert-id",
    user_display_name: "Anushka (Demo User)",
    reason: "Live Rescue Relay simulation active.",
    timestamp: now,
    expires_at: new Date(Date.now() + 4 * 3600 * 1000).toISOString(),
    last_location: { latitude: 28.6139, longitude: 77.2090, accuracy: 12 },
    status: "pending",
  };

  const updated: ContactRelayData = {
    ...existing,
    status: "acknowledged",
    acknowledged_at: now,
    acknowledged_by: input.responder_name,
    relay_notes: input.responder_note,
  };
  mockRelays[token] = updated;

  mockTimeline.push({
    id: `ev-${Date.now()}`,
    incident_id: updated.incident_id,
    session_id: updated.session_id,
    event_type: "contact_acknowledged_alert",
    timestamp: now,
    actor: "contact",
    status: "success",
    title: `Alert Acknowledged by ${input.responder_name}`,
    description: input.responder_note || "Trusted contact confirmed receipt and is responding.",
  });

  return updated;
}
