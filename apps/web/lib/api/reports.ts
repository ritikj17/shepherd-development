import {
  ApiRequestError,
  apiRequest,
  buildApiUrl,
  getApiAccessToken,
} from "@/lib/api/client";
import { isMockApiEnabled } from "@/lib/api/config";
import { mockGenerateReport } from "@/lib/api/mock/reports";
import type { GenerateReportInput, GeneratedReport } from "@/lib/types/api";

export async function generateIncidentReport(
  incidentId: string,
  input: GenerateReportInput,
): Promise<GeneratedReport> {
  if (isMockApiEnabled) return mockGenerateReport(incidentId);
  return apiRequest<GeneratedReport>(`/reports/${incidentId}`, {
    method: "POST",
    body: input,
    timeoutMs: 60_000,
  });
}

export async function downloadIncidentReport(
  reportId: string,
  fallbackFileName: string = "incident-report.pdf",
): Promise<{ blob: Blob; fileName: string }> {
  const token = await getApiAccessToken();
  if (!token) {
    throw new ApiRequestError(
      "Your session has expired or authentication token is missing. Please sign in again.",
      { status: 401, code: "UNAUTHORIZED" },
    );
  }

  const url = buildApiUrl(`/reports/${reportId}/download`);
  let response: Response;
  try {
    response = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
  } catch (cause) {
    throw new ApiRequestError("Network error while downloading the report.", {
      status: 0,
      code: "NETWORK_ERROR",
      details: { cause: String(cause) },
    });
  }

  if (!response.ok) {
    let message = `Failed to download report (${response.status})`;
    let code = `HTTP_${response.status}`;
    try {
      const errorJson = await response.json();
      if (errorJson?.error?.message) {
        message = errorJson.error.message;
      }
      if (errorJson?.error?.code) {
        code = errorJson.error.code;
      }
    } catch {
      if (response.status === 401) {
        message = "Your session has expired. Please sign in again.";
      } else if (response.status === 403) {
        message = "You do not have access to this report.";
      } else if (response.status === 404) {
        message = "The requested report was not found.";
      } else if (response.status >= 500) {
        message = "A server error occurred while retrieving the report.";
      }
    }
    throw new ApiRequestError(message, { status: response.status, code });
  }

  let fileName = fallbackFileName;
  const disposition = response.headers.get("content-disposition");
  if (disposition) {
    const match = disposition.match(/filename="?([^";]+)"?/i);
    if (match && match[1]) {
      fileName = match[1].trim();
    }
  }

  const blob = await response.blob();
  return { blob, fileName };
}
