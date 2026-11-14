export type TravelMode = "walking" | "transit" | "driving" | "other";

export type SessionStatus = "active" | "paused" | "completed" | "cancelled" | "escalated";

export type ConcernLevel = "normal" | "advisory" | "warning" | "critical";

export type AnomalyType =
  | "route_deviation"
  | "speed_anomaly"
  | "unexpected_stop"
  | "journey_timeout"
  | "stale_location"
  | "combined";

export type VerificationStatus = "pending" | "safe" | "help_requested" | "unanswered";

export interface SentinelSessionCreateInput {
  destination_name: string;
  destination_lat?: number;
  destination_lng?: number;
  start_lat?: number;
  start_lng?: number;
  expected_arrival: string; // ISO string
  travel_mode: TravelMode;
  trusted_contact_ids?: string[];
  incident_id?: string;
  share_location?: boolean;
  verification_timeout_seconds?: number;
  deviation_threshold_meters?: number;
  is_demo?: boolean;
}

export interface SentinelSession {
  id: string;
  user_id: string;
  incident_id?: string | null;
  status: SessionStatus;
  destination_name: string;
  destination_lat?: number | null;
  destination_lng?: number | null;
  expected_arrival: string;
  travel_mode: TravelMode;
  trusted_contact_ids: string[];
  share_location: boolean;
  verification_timeout_seconds: number;
  concern_level: ConcernLevel;
  last_location?: {
    latitude: number;
    longitude: number;
    accuracy?: number;
    speed?: number;
    heading?: number;
    timestamp?: string;
  } | null;
  active_anomaly?: AnomalyRecord | null;
  active_verification?: VerificationRecord | null;
  created_at: string;
  updated_at: string;
  is_demo?: boolean;
}

export interface LocationUpdateInput {
  latitude: number;
  longitude: number;
  accuracy?: number;
  speed?: number;
  heading?: number;
  timestamp?: string;
  is_simulated?: boolean;
}

export interface LocationIngestResponse {
  status: "recorded" | "ignored";
  concern_level: ConcernLevel;
  verification_required: boolean;
  anomaly?: AnomalyRecord | null;
  verification?: VerificationRecord | null;
}

export interface AnomalyRecord {
  id: string;
  session_id: string;
  anomaly_type: AnomalyType;
  severity: "low" | "medium" | "high" | "critical";
  detected_at: string;
  reason: string;
  confidence: number;
  rule_triggered: string;
  location?: { latitude: number; longitude: number } | null;
  resolved: boolean;
  resolved_at?: string | null;
}

export interface VerificationRecord {
  id: string;
  session_id: string;
  anomaly_id?: string | null;
  prompt: string;
  deadline: string;
  status: VerificationStatus;
  created_at: string;
  responded_at?: string | null;
  user_response?: string | null;
}

export interface VerificationResponseInput {
  response: "safe" | "help_requested" | "cannot_respond";
  user_note?: string;
}

export interface SilentAssistTriggerInput {
  session_id?: string;
  incident_id?: string;
  current_lat?: number;
  current_lng?: number;
  accuracy?: number;
  haptic_confirmed?: boolean;
}

export interface SilentAssistResponse {
  status: "escalated";
  incident_id: string;
  triggered_at: string;
  relay_token?: string;
  escalation: {
    contacts_notified: number;
    relay_token?: string;
    relay_url?: string;
    expires_at?: string;
    message?: string;
  };
}

export interface LiveIncidentEvent {
  id: string;
  incident_id?: string | null;
  session_id?: string | null;
  event_type: string;
  timestamp: string;
  actor: string;
  status: "info" | "warning" | "distress" | "resolved" | "success";
  title: string;
  description: string;
  metadata?: Record<string, unknown>;
}

export interface TimelineEventListResponse {
  items: LiveIncidentEvent[];
}

export interface ContactRelayData {
  token: string;
  alert_id: string;
  session_id?: string | null;
  incident_id?: string | null;
  user_display_name: string;
  reason: string;
  timestamp: string;
  expires_at: string;
  last_location?: {
    latitude: number;
    longitude: number;
    accuracy?: number;
  } | null;
  status: "pending" | "acknowledged" | "expired";
  acknowledged_at?: string | null;
  acknowledged_by?: string | null;
  relay_notes?: string | null;
}

export interface ContactAcknowledgeInput {
  responder_name: string;
  responder_note?: string;
}
