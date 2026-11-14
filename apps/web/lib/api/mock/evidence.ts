import { delay, mockId, readDatabase, updateDatabase } from "@/lib/api/mock/store";
import { mockError } from "@/lib/api/mock/errors";
import { sha256HexFromFile } from "@/lib/utils/hash";
import { validateEvidenceFile } from "@/lib/validation/evidence";
import type { Evidence, EvidenceListResponse, HashVerification } from "@/lib/types/api";

export async function mockListEvidence(
  incidentId: string,
): Promise<EvidenceListResponse> {
  await delay(260);
  const database = readDatabase();
  if (!database.incidents.some((item) => item.id === incidentId)) {
    throw mockError(404, "NOT_FOUND", "That incident could not be found.");
  }
  const items = database.evidence
    .filter((item) => item.incident_id === incidentId)
    .sort((a, b) => Date.parse(b.uploaded_at) - Date.parse(a.uploaded_at));
  return { items };
}

export async function mockUploadEvidence(
  incidentId: string,
  file: File,
  onProgress?: (percent: number) => void,
): Promise<Evidence> {
  const validationError = validateEvidenceFile(file);
  if (validationError) {
    throw mockError(422, "VALIDATION_ERROR", validationError);
  }

  const database = readDatabase();
  if (!database.incidents.some((item) => item.id === incidentId)) {
    throw mockError(404, "NOT_FOUND", "That incident could not be found.");
  }

  onProgress?.(10);
  await delay(240);
  onProgress?.(35);

  let sha256: string;
  try {
    sha256 = await sha256HexFromFile(file);
  } catch (error) {
    throw mockError(
      500,
      "HASH_UNAVAILABLE",
      error instanceof Error
        ? error.message
        : "Could not calculate the SHA-256 hash.",
    );
  }

  await delay(260);
  onProgress?.(70);
  await delay(240);
  onProgress?.(92);

  const evidence: Evidence = {
    id: mockId(),
    incident_id: incidentId,
    file_name: file.name,
    mime_type: file.type,
    size_bytes: file.size,
    sha256,
    uploaded_at: new Date().toISOString(),
    storage_status: "stored",
  };

  updateDatabase((current) => ({
    ...current,
    evidence: [evidence, ...current.evidence],
  }));

  await delay(160);
  onProgress?.(100);
  return evidence;
}

export async function mockVerifyEvidence(
  evidenceId: string,
): Promise<HashVerification> {
  await delay(700);
  const database = readDatabase();
  const evidence = database.evidence.find((item) => item.id === evidenceId);
  if (!evidence) {
    throw mockError(404, "NOT_FOUND", "That evidence record could not be found.");
  }

  // The demo adapter never stores file bytes, so it cannot re-hash the original.
  // It reports the recorded reference hash and labels the result as simulated.
  const verification: HashVerification = {
    evidence_id: evidence.id,
    stored_sha256: evidence.sha256,
    current_sha256: evidence.sha256,
    matches: true,
    verified_at: new Date().toISOString(),
    message:
      "Simulated verification (demo adapter): file bytes are not stored locally, so only the recorded reference hash is shown. The Core API performs the real re-hash.",
  };

  updateDatabase((current) => ({
    ...current,
    verifications: {
      ...current.verifications,
      [evidence.id]: verification,
    },
  }));

  return verification;
}
