import { delay, mockId, readDatabase, updateDatabase } from "@/lib/api/mock/store";
import { mockError } from "@/lib/api/mock/errors";
import type { GeneratedReport } from "@/lib/types/api";

export async function mockGenerateReport(
  incidentId: string,
): Promise<GeneratedReport> {
  await delay(1_200);
  const database = readDatabase();
  if (!database.incidents.some((item) => item.id === incidentId)) {
    throw mockError(404, "NOT_FOUND", "That incident could not be found.");
  }

  const now = new Date();
  const report: GeneratedReport = {
    report_id: mockId(),
    incident_id: incidentId,
    status: "generated",
    file_name: "incident-report.pdf",
    // The demo adapter cannot produce a PDF. The UI explains this and offers a
    // clearly labelled plain-text summary instead of pretending a PDF exists.
    download_url: "",
    generated_at: now.toISOString(),
    expires_at: new Date(now.getTime() + 10 * 60_000).toISOString(),
  };

  updateDatabase((current) => ({
    ...current,
    reports: [report, ...current.reports],
  }));

  return report;
}
