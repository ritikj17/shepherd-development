import { describe, expect, it, vi, beforeEach } from "vitest";

import { registerApiTokenProvider } from "@/lib/api/client";
import { downloadIncidentReport } from "@/lib/api/reports";

describe("JusticeBridge Authenticated Download Workflow", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("successfully downloads PDF with Authorization header and parses filename", async () => {
    registerApiTokenProvider(async () => "mock-jwt-token-123");

    const mockPdfContent = "%PDF-1.4 test binary data";
    const mockBlob = new Blob([mockPdfContent], { type: "application/pdf" });

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: {
        get: (header: string) => {
          if (header.toLowerCase() === "content-disposition") {
            return 'attachment; filename="incident-report-12345678.pdf"';
          }
          return null;
        },
      },
      blob: async () => mockBlob,
    });

    vi.stubGlobal("fetch", fetchMock);

    const result = await downloadIncidentReport("report-uuid-1", "fallback.pdf");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [calledUrl, calledInit] = fetchMock.mock.calls[0];
    expect(calledUrl).toContain("/reports/report-uuid-1/download");
    expect(calledInit.headers.Authorization).toBe("Bearer mock-jwt-token-123");
    expect(result.fileName).toBe("incident-report-12345678.pdf");
    expect(result.blob).toBe(mockBlob);
  });

  it("throws unauthorized error when token provider returns null", async () => {
    registerApiTokenProvider(async () => null);

    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(downloadIncidentReport("report-uuid-2")).rejects.toThrow(
      /authentication token is missing/i,
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("handles 401 unauthorized response from API", async () => {
    registerApiTokenProvider(async () => "expired-token");

    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      headers: { get: () => null },
      json: async () => ({
        error: { code: "UNAUTHORIZED", message: "Token expired." },
      }),
    });

    vi.stubGlobal("fetch", fetchMock);

    await expect(downloadIncidentReport("report-uuid-3")).rejects.toMatchObject({
      status: 401,
      code: "UNAUTHORIZED",
      message: "Token expired.",
    });
  });

  it("handles 403 forbidden cross-user access error", async () => {
    registerApiTokenProvider(async () => "valid-token");

    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 403,
      headers: { get: () => null },
      json: async () => ({
        error: { code: "FORBIDDEN", message: "Access denied." },
      }),
    });

    vi.stubGlobal("fetch", fetchMock);

    await expect(downloadIncidentReport("report-uuid-4")).rejects.toMatchObject({
      status: 403,
      code: "FORBIDDEN",
      message: "Access denied.",
    });
  });

  it("handles 404 report not found error", async () => {
    registerApiTokenProvider(async () => "valid-token");

    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      headers: { get: () => null },
      json: async () => ({
        error: { code: "NOT_FOUND", message: "Report not found." },
      }),
    });

    vi.stubGlobal("fetch", fetchMock);

    await expect(downloadIncidentReport("report-uuid-5")).rejects.toMatchObject({
      status: 404,
      code: "NOT_FOUND",
      message: "Report not found.",
    });
  });

  it("handles 500 upstream server error", async () => {
    registerApiTokenProvider(async () => "valid-token");

    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      headers: { get: () => null },
      json: async () => {
        throw new Error("Invalid JSON");
      },
    });

    vi.stubGlobal("fetch", fetchMock);

    await expect(downloadIncidentReport("report-uuid-6")).rejects.toMatchObject({
      status: 500,
      code: "HTTP_500",
      message: "A server error occurred while retrieving the report.",
    });
  });

  it("attaches mock-user-demo Bearer token in demo development mode", async () => {
    registerApiTokenProvider(async () => "mock-user-demo");

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: { get: () => null },
      blob: async () => new Blob(["test"]),
    });
    vi.stubGlobal("fetch", fetchMock);

    await downloadIncidentReport("report-uuid-demo");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, init] = fetchMock.mock.calls[0];
    expect(init.headers.Authorization).toBe("Bearer mock-user-demo");
  });
});
