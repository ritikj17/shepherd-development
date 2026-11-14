import type {
  Evidence,
  GeneratedReport,
  GraphEdge,
  HashVerification,
  Incident,
  SafetySession,
  ThreatAnalysis,
  TrustedContact,
} from "@/lib/types/api";

/**
 * Local demo database shape. This is an isolated mock adapter, not a backend.
 * It stores synthetic records in localStorage so the frontend can be
 * demonstrated before the Core API is available.
 */
export interface MockDatabase {
  version: 1;
  incidents: Incident[];
  evidence: Evidence[];
  analyses: ThreatAnalysis[];
  links: GraphEdge[];
  contacts: TrustedContact[];
  sessions: SafetySession[];
  reports: GeneratedReport[];
  verifications: Record<string, HashVerification>;
}

export const MOCK_DB_KEY = "shepherd.demo.db.v1";
