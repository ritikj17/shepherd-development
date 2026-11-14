/**
 * Frontend types mirroring docs/API_CONTRACTS.md (v1.0, LOCKED).
 *
 * Do not add fields here that are not present in the shared contract without
 * coordinating a contract change with the backend owners. Fields marked
 * "optional" are optional only because the contract does not guarantee them
 * on every response (for example list projections).
 */

export const INCIDENT_CATEGORIES = [
  "cyberstalking",
  "threat",
  "sextortion",
  "impersonation",
  "doxxing",
  "image_based_abuse",
  "general_harassment",
  "other",
] as const;

export type IncidentCategory = (typeof INCIDENT_CATEGORIES)[number];

export const INCIDENT_STATUSES = ["open", "archived"] as const;
export type IncidentStatus = (typeof INCIDENT_STATUSES)[number];

export interface Incident {
  id: string;
  title: string;
  description: string;
  category: IncidentCategory;
  occurred_at: string;
  location_description: string | null;
  status: IncidentStatus;
  created_at: string;
  updated_at: string;
}

export interface IncidentListResponse {
  items: Incident[];
  total: number;
  limit: number;
  offset: number;
}

export interface IncidentListParams {
  limit?: number;
  offset?: number;
  category?: IncidentCategory;
  status?: IncidentStatus;
}

export interface CreateIncidentInput {
  title: string;
  description: string;
  category: IncidentCategory;
  occurred_at: string;
  location_description?: string | null;
}

export interface UpdateIncidentInput {
  title?: string;
  description?: string;
  category?: IncidentCategory;
  occurred_at?: string;
  location_description?: string | null;
  status?: IncidentStatus;
}

export type EvidenceStorageStatus = "stored" | "failed" | "pending";

export interface Evidence {
  id: string;
  incident_id: string;
  file_name: string;
  mime_type: string;
  size_bytes: number;
  sha256: string;
  uploaded_at: string;
  storage_status: EvidenceStorageStatus;
}

export interface EvidenceListResponse {
  items: Evidence[];
}

export interface HashVerification {
  evidence_id: string;
  stored_sha256: string;
  current_sha256: string;
  matches: boolean;
  verified_at: string;
  message: string;
}

export const ANALYSIS_STATUSES = ["completed", "failed"] as const;
export type AnalysisStatus = (typeof ANALYSIS_STATUSES)[number];

export const RISK_LEVELS = [
  "low",
  "moderate",
  "high",
  "insufficient_data",
] as const;
export type RiskLevel = (typeof RISK_LEVELS)[number];

export const OCR_STATUSES = ["completed", "failed", "not_applicable"] as const;
export type OcrStatus = (typeof OCR_STATUSES)[number];

export interface Classification {
  label: IncidentCategory;
  confidence: number | null;
  confidence_type: "model_score_not_calibrated_probability";
  explanation: string;
}

export interface Indicator {
  name: string;
  description: string;
}

export interface RiskFactor {
  name: string;
  /** 0–100 factor value as described in docs/AI_DISCLOSURE.md. */
  value: number;
  /** Optional display hint; not guaranteed by the contract. */
  weight?: number;
  description?: string;
}

export interface RiskAssessment {
  score: number | null;
  level: RiskLevel;
  label: "review_priority";
  explanation: string;
  factors?: RiskFactor[];
}

export interface OcrResult {
  status: OcrStatus;
  text_available?: boolean;
  extracted_text?: string;
}

export interface ThreatAnalysis {
  analysis_id: string;
  incident_id: string;
  status: AnalysisStatus;
  classification: Classification;
  indicators: Indicator[];
  risk: RiskAssessment;
  ocr: OcrResult;
  limitations: string[];
  created_at: string;
}

export interface AnalysisListResponse {
  items: ThreatAnalysis[];
}

export interface RequestAnalysisInput {
  evidence_ids: string[];
  include_description: boolean;
}

export const GRAPH_RELATIONSHIPS = [
  "SAME_USER_REPORTED_IDENTIFIER",
  "SIMILAR_MESSAGE_CONTENT",
  "REPEATED_CONTACT_PATTERN",
  "USER_REPORTED_RELATED_EVENT",
] as const;
export type RelationshipType = (typeof GRAPH_RELATIONSHIPS)[number];

export interface GraphNode {
  id: string;
  label: string;
  category: IncidentCategory;
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  relationship: RelationshipType;
  confidence: number | null;
  explanation: string;
}

export interface IncidentGraph {
  incident_id: string;
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export const CONTACT_METHODS = ["email", "phone"] as const;
export type ContactMethod = (typeof CONTACT_METHODS)[number];

export interface TrustedContact {
  id: string;
  name: string;
  contact_method: ContactMethod;
  created_at: string;
  /** Not guaranteed by the create/list contract; present in the database model. */
  contact_value?: string;
  consent_confirmed?: boolean;
}

export interface TrustedContactListResponse {
  items: TrustedContact[];
}

export interface CreateTrustedContactInput {
  name: string;
  contact_method: ContactMethod;
  contact_value: string;
  consent_confirmed: true;
}

export const SAFETY_SESSION_STATUSES = [
  "active",
  "checked_in",
  "expired",
  "cancelled",
] as const;
export type SafetySessionStatus = (typeof SAFETY_SESSION_STATUSES)[number];

export interface SafetySession {
  id: string;
  trusted_contact_id: string;
  incident_id: string | null;
  status: SafetySessionStatus;
  checkin_deadline: string;
  created_at: string;
  checked_in_at?: string | null;
  cancelled_at?: string | null;
}

export interface SafetySessionListResponse {
  items: SafetySession[];
}

export interface CreateSafetySessionInput {
  trusted_contact_id: string;
  incident_id: string | null;
  checkin_deadline: string;
  consent_confirmed: true;
}

export interface CheckInInput {
  message?: string;
}

export interface CheckInResponse {
  id: string;
  status: SafetySessionStatus;
  checked_in_at: string;
}

export const REPORT_STATUSES = ["generated", "failed", "expired"] as const;
export type ReportStatus = (typeof REPORT_STATUSES)[number];

export interface GenerateReportInput {
  include_evidence_index: boolean;
  include_analysis: boolean;
}

export interface GeneratedReport {
  report_id: string;
  incident_id: string;
  status: ReportStatus;
  file_name: string;
  download_url: string;
  generated_at: string;
  expires_at: string;
}

export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
}

export interface HealthResponse {
  status: string;
  service: string;
}
