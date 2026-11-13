import {
  ApiRequestError,
  apiRequest,
  buildApiUrl,
  getApiAccessToken,
} from "@/lib/api/client";
import { apiConfig, isMockApiEnabled } from "@/lib/api/config";
import {
  mockListEvidence,
  mockUploadEvidence,
  mockVerifyEvidence,
} from "@/lib/api/mock/evidence";
import { validateEvidenceFile } from "@/lib/validation/evidence";
import type {
  Evidence,
  EvidenceListResponse,
  HashVerification,
} from "@/lib/types/api";

export async function listIncidentEvidence(
  incidentId: string,
): Promise<EvidenceListResponse> {
  if (isMockApiEnabled) return mockListEvidence(incidentId);
  return apiRequest<EvidenceListResponse>(`/incidents/${incidentId}/evidence`);
}

function uploadWithProgress(
  incidentId: string,
  file: File,
  onProgress?: (percent: number) => void,
): Promise<Evidence> {
  return new Promise<Evidence>((resolve, reject) => {
    void (async () => {
      const token = await getApiAccessToken();
      if (!token) {
        reject(
          new ApiRequestError(
            "Sign in to continue. Your session is missing or has expired.",
            { status: 401, code: "UNAUTHENTICATED" },
          ),
        );
        return;
      }

      const formData = new FormData();
      formData.append("incident_id", incidentId);
      formData.append("file", file);

      const xhr = new XMLHttpRequest();
      xhr.open("POST", buildApiUrl("/evidence"));
      xhr.timeout = apiConfig.uploadTimeoutMs;
      xhr.setRequestHeader("Accept", "application/json");
      xhr.setRequestHeader("Authorization", `Bearer ${token}`);

      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          onProgress?.(Math.round((event.loaded / event.total) * 100));
        }
      };

      xhr.onerror = () => {
        reject(
          new ApiRequestError(
            "Unable to reach the SHEPHERD API. The upload was not confirmed.",
            { code: "NETWORK_ERROR" },
          ),
        );
      };

      xhr.ontimeout = () => {
        reject(
          new ApiRequestError(
            "The upload timed out. The file may not have been stored.",
            { code: "TIMEOUT" },
          ),
        );
      };

      xhr.onload = () => {
        let body: unknown = null;
        try {
          body = xhr.responseText ? JSON.parse(xhr.responseText) : null;
        } catch {
          body = null;
        }

        if (xhr.status >= 200 && xhr.status < 300) {
          onProgress?.(100);
          resolve(body as Evidence);
          return;
        }

        const errorBody = body as
          | { error?: { code?: string; message?: string } }
          | null;
        reject(
          new ApiRequestError(
            errorBody?.error?.message ??
              `Upload failed (${xhr.status}). The file was not confirmed as stored.`,
            {
              status: xhr.status,
              code: errorBody?.error?.code ?? `HTTP_${xhr.status}`,
            },
          ),
        );
      };

      xhr.send(formData);
    })();
  });
}

export async function uploadEvidence(
  incidentId: string,
  file: File,
  onProgress?: (percent: number) => void,
): Promise<Evidence> {
  const validationError = validateEvidenceFile(file);
  if (validationError) {
    throw new ApiRequestError(validationError, {
      status: 422,
      code: "VALIDATION_ERROR",
    });
  }

  if (isMockApiEnabled) return mockUploadEvidence(incidentId, file, onProgress);
  return uploadWithProgress(incidentId, file, onProgress);
}

export async function verifyEvidenceHash(
  evidenceId: string,
): Promise<HashVerification> {
  if (isMockApiEnabled) return mockVerifyEvidence(evidenceId);
  return apiRequest<HashVerification>("/evidence/verify", {
    method: "POST",
    body: { evidence_id: evidenceId },
  });
}
