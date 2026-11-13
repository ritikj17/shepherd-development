"use client";

import * as React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  AlertCircle,
  CheckCircle2,
  Download,
  FileCheck2,
  FileSignature,
  FileText,
  Info,
  LoaderCircle,
  Lock,
  ShieldAlert,
  Sparkles,
  Timer,
} from "lucide-react";
import { toast } from "sonner";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AiDisclosure } from "@/components/shared/ai-disclosure";
import { EmptyState, ErrorState } from "@/components/shared/states";
import { ListSkeleton } from "@/components/shared/loading-states";
import { PageHeader } from "@/components/shared/page-header";
import { MockDataBadge } from "@/components/shared/demo-notices";
import { StatusBadge } from "@/components/shared/status-badges";
import {
  generateIncidentReport,
  listIncidentAnalyses,
  listIncidentEvidence,
  listIncidents,
} from "@/lib/api";
import { errorMessage } from "@/lib/api/client";
import { isMockApiEnabled } from "@/lib/api/config";
import { useAsyncData } from "@/lib/hooks/use-async-data";
import type {
  GeneratedReport,
  Incident,
  ReportStatus,
  ThreatAnalysis,
  Evidence,
} from "@/lib/types/api";
import { categoryLabel } from "@/lib/utils/categories";
import {
  formatBytes,
  formatDateTime,
  pluralize,
  shortHash,
} from "@/lib/utils/format";

function ReportStatusBadge({ status }: { status: ReportStatus }) {
  if (status === "generated") {
    return <StatusBadge tone="success">Generated</StatusBadge>;
  }
  if (status === "expired") {
    return <StatusBadge tone="warning">Expired</StatusBadge>;
  }
  return <StatusBadge tone="destructive">Failed</StatusBadge>;
}

function buildDemoSummary({
  incident,
  evidence,
  analyses,
  includeEvidenceIndex,
  includeAnalysis,
  report,
}: {
  incident: Incident;
  evidence: Evidence[];
  analyses: ThreatAnalysis[];
  includeEvidenceIndex: boolean;
  includeAnalysis: boolean;
  report: GeneratedReport;
}) {
  const lines: string[] = [];
  lines.push("SHEPHERD DEMO INCIDENT SUMMARY");
  lines.push("=".repeat(40));
  lines.push(
    "This plain-text summary was generated locally by the demo adapter.",
  );
  lines.push(
    "It is not a PDF, not a generated legal report, and has no legal standing.",
  );
  lines.push("");
  lines.push(`Report reference: ${report.report_id}`);
  lines.push(`Generated: ${formatDateTime(report.generated_at)}`);
  lines.push(`Demo URL expiry: ${formatDateTime(report.expires_at)}`);
  lines.push("");
  lines.push("INCIDENT");
  lines.push("-".repeat(40));
  lines.push(`Title: ${incident.title}`);
  lines.push(`Category: ${categoryLabel(incident.category)}`);
  lines.push(`Occurred: ${formatDateTime(incident.occurred_at)}`);
  lines.push(`Status: ${incident.status}`);
  lines.push(
    `Location description: ${incident.location_description ?? "Not provided"}`,
  );
  lines.push("");
  lines.push("User-written description:");
  lines.push(incident.description);
  lines.push("");

  if (includeEvidenceIndex) {
    lines.push("EVIDENCE INDEX (METADATA ONLY)");
    lines.push("-".repeat(40));
    if (evidence.length === 0) {
      lines.push("No evidence was attached when this summary was generated.");
    } else {
      evidence.forEach((item, index) => {
        lines.push(`${index + 1}. ${item.file_name}`);
        lines.push(`   Type: ${item.mime_type}`);
        lines.push(`   Size: ${formatBytes(item.size_bytes)}`);
        lines.push(`   Uploaded: ${formatDateTime(item.uploaded_at)}`);
        lines.push(`   Storage status: ${item.storage_status}`);
        lines.push(`   SHA-256: ${item.sha256}`);
      });
      lines.push("");
      lines.push(
        "A matching SHA-256 indicates byte-level consistency with the stored reference file. It does not prove when, where or by whom the file was created.",
      );
    }
    lines.push("");
  }

  if (includeAnalysis) {
    lines.push("AI-ASSISTED ANALYSIS (INFORMATIONAL)");
    lines.push("-".repeat(40));
    if (analyses.length === 0) {
      lines.push("No analysis results existed when this summary was generated.");
    } else {
      analyses.forEach((analysis, index) => {
        lines.push(`${index + 1}. ${formatDateTime(analysis.created_at)}`);
        lines.push(
          `   Classification: ${categoryLabel(analysis.classification.label)}`,
        );
        lines.push(
          `   Model score: ${analysis.classification.confidence ?? "Not provided"} (not a calibrated probability)`,
        );
        lines.push(`   Review priority: ${analysis.risk.level}`);
        if (analysis.risk.score !== null) {
          lines.push(`   Review-priority score: ${analysis.risk.score}/100`);
        }
        if (analysis.indicators.length > 0) {
          lines.push("   Indicators:");
          analysis.indicators.forEach((indicator) => {
            lines.push(`     - ${indicator.name}: ${indicator.description}`);
          });
        }
        if (analysis.ocr.extracted_text) {
          lines.push("   Extracted OCR text (may contain errors):");
          lines.push(`     ${analysis.ocr.extracted_text}`);
        }
        if (analysis.limitations.length > 0) {
          lines.push("   Limitations:");
          analysis.limitations.forEach((limitation) => {
            lines.push(`     - ${limitation}`);
          });
        }
      });
    }
    lines.push("");
    lines.push(
      "AI-generated labels are informational, may be inaccurate, and are not verified facts or a legal determination.",
    );
  }

  lines.push("");
  lines.push("This summary was produced by the SHEPHERD demo adapter.");
  lines.push(
    "It is not an emergency service, legal advice, or a guarantee of safety.",
  );
  return lines.join("\n");
}

export function JusticeBridgeView() {
  const incidentsQuery = useAsyncData(
    () => listIncidents({ limit: 100 }),
    "justice-incidents",
  );
  const [incidentId, setIncidentId] = React.useState("");
  const searchParams = useSearchParams();
  const requestedIncidentId =
    incidentId || searchParams.get("incident") || "";
  const [includeEvidence, setIncludeEvidence] = React.useState(true);
  const [includeAnalysis, setIncludeAnalysis] = React.useState(true);
  const [generating, setGenerating] = React.useState(false);
  const [report, setReport] = React.useState<GeneratedReport | null>(null);
  const [formError, setFormError] = React.useState<string | null>(null);

  const incidents = incidentsQuery.data?.items ?? [];
  const incident =
    incidents.find((item) => item.id === requestedIncidentId) ?? incidents[0];
  const effectiveIncidentId = incident?.id ?? "";

  const evidenceQuery = useAsyncData(
    () => listIncidentEvidence(effectiveIncidentId),
    `justice-evidence-${effectiveIncidentId}`,
    Boolean(effectiveIncidentId),
  );
  const analysesQuery = useAsyncData(
    () => listIncidentAnalyses(effectiveIncidentId),
    `justice-analyses-${effectiveIncidentId}`,
    Boolean(effectiveIncidentId),
  );

  const evidence = evidenceQuery.data?.items ?? [];
  const analyses = analysesQuery.data?.items ?? [];

  const handleGenerate = async () => {
    if (!incident) {
      setFormError("Choose an incident to generate a report for.");
      return;
    }
    setFormError(null);
    setGenerating(true);
    setReport(null);
    try {
      const generated = await generateIncidentReport(incident.id, {
        include_evidence_index: includeEvidence,
        include_analysis: includeAnalysis,
      });
      setReport(generated);
      if (generated.status === "generated") {
        toast.success(
          isMockApiEnabled ? "Demo summary prepared" : "Report generated",
          {
            description: isMockApiEnabled
              ? "The demo adapter cannot create a PDF. A labelled text summary is available instead."
              : "Use the short-lived download link below.",
          },
        );
      } else {
        toast.error("The report was not generated", {
          description: `The API returned status “${generated.status}”.`,
        });
      }
    } catch (cause) {
      setFormError(errorMessage(cause));
    } finally {
      setGenerating(false);
    }
  };

  const handleDemoDownload = () => {
    if (!incident || !report) return;
    const text = buildDemoSummary({
      incident,
      evidence,
      analyses,
      includeEvidenceIndex: includeEvidence,
      includeAnalysis,
      report,
    });
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "shepherd-demo-incident-summary.txt";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
    toast.success("Demo summary downloaded", {
      description:
        "Plain text only. This is not the generated report file the Core API would produce.",
    });
  };

  return (
    <div className="space-y-6 animate-fade-up">
      <PageHeader
        eyebrow="JusticeBridge"
        title="Structured incident reports"
        description="Assemble an incident record with an optional evidence index and AI-assisted analysis. Reports are documentation aids, not legal filings or a substitute for advice from a qualified professional."
        actions={<MockDataBadge />}
      />

      {incidentsQuery.error ? (
        <ErrorState
          title="Incidents could not be loaded"
          message={incidentsQuery.error}
          onRetry={incidentsQuery.refresh}
        />
      ) : incidentsQuery.loading && !incidentsQuery.data ? (
        <Card>
          <CardContent className="p-5">
            <ListSkeleton rows={3} />
          </CardContent>
        </Card>
      ) : incidents.length === 0 ? (
        <EmptyState
          icon={<FileSignature className="size-5" />}
          title="Create an incident first"
          description="A report is generated from an incident you own. Create a record with a description, then return here."
          action={
            <Button asChild size="sm">
              <Link href="/incidents/new">Create an incident</Link>
            </Button>
          }
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-[380px_1fr]">
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Report settings</CardTitle>
                <CardDescription>
                  Choose what the Core API should include. Only the selected
                  sections are used.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {formError ? (
                  <Alert variant="destructive">
                    <AlertCircle />
                    <div>
                      <AlertTitle>Report not generated</AlertTitle>
                      <AlertDescription>{formError}</AlertDescription>
                    </div>
                  </Alert>
                ) : null}

                <div className="space-y-1.5">
                  <Label htmlFor="report-incident">Incident</Label>
                  <Select
                    value={effectiveIncidentId}
                    onValueChange={(value) => {
                      setIncidentId(value);
                      setReport(null);
                      setFormError(null);
                    }}
                  >
                    <SelectTrigger id="report-incident">
                      <SelectValue placeholder="Choose an incident" />
                    </SelectTrigger>
                    <SelectContent>
                      {incidents.map((item) => (
                        <SelectItem key={item.id} value={item.id}>
                          {item.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {incident ? (
                    <p className="line-clamp-2 text-[11px] leading-relaxed text-muted-foreground">
                      {incident.description}
                    </p>
                  ) : null}
                </div>

                <div className="flex items-start justify-between gap-3 rounded-lg border border-border p-3">
                  <div>
                    <Label
                      htmlFor="include-evidence"
                      className="cursor-pointer text-xs font-medium"
                    >
                      Include evidence index
                    </Label>
                    <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">
                      File names, sizes, storage status and SHA-256 values. No
                      private file URLs are included.
                    </p>
                  </div>
                  <Checkbox
                    id="include-evidence"
                    checked={includeEvidence}
                    onCheckedChange={(checked) =>
                      setIncludeEvidence(checked === true)
                    }
                  />
                </div>

                <div className="flex items-start justify-between gap-3 rounded-lg border border-border p-3">
                  <div>
                    <Label
                      htmlFor="include-analysis"
                      className="cursor-pointer text-xs font-medium"
                    >
                      Include AI-assisted analysis
                    </Label>
                    <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">
                      Classification labels, indicators, review priority and
                      limitations. Labels are informational, not verified facts.
                    </p>
                  </div>
                  <Checkbox
                    id="include-analysis"
                    checked={includeAnalysis}
                    onCheckedChange={(checked) =>
                      setIncludeAnalysis(checked === true)
                    }
                  />
                </div>

                <Button
                  type="button"
                  className="w-full"
                  onClick={() => void handleGenerate()}
                  disabled={generating || !effectiveIncidentId}
                >
                  {generating ? (
                    <LoaderCircle className="size-4 animate-spin" />
                  ) : (
                    <FileCheck2 className="size-4" />
                  )}
                  {generating ? "Generating…" : "Generate report"}
                </Button>

                <p className="text-[10px] leading-relaxed text-muted-foreground">
                  {isMockApiEnabled
                    ? "Demo adapter: generation is simulated locally and cannot produce a PDF. You will receive a clearly labelled text summary instead."
                    : "The Core API creates the report and returns a short-lived signed download URL. The browser does not build the document."}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Included in this request</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-[11px] leading-relaxed text-muted-foreground">
                <p className="flex items-start gap-2">
                  <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-primary" />
                  Incident title, category, occurrence time and your written
                  description.
                </p>
                <p className="flex items-start gap-2">
                  {includeEvidence ? (
                    <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-primary" />
                  ) : (
                    <span className="mt-0.5 size-3.5 shrink-0 rounded-full border border-border" />
                  )}
                  Evidence index with {pluralize(evidence.length, "file")} —
                  metadata and hashes only.
                </p>
                <p className="flex items-start gap-2">
                  {includeAnalysis ? (
                    <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-primary" />
                  ) : (
                    <span className="mt-0.5 size-3.5 shrink-0 rounded-full border border-border" />
                  )}
                  {pluralize(analyses.length, "analysis result")} with their
                  limitations.
                </p>
                <p className="flex items-start gap-2">
                  <Lock className="mt-0.5 size-3.5 shrink-0 text-primary" />
                  No private storage URL, service-role key or public evidence link
                  is ever included.
                </p>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-4">
            {generating ? (
              <Card>
                <CardContent className="flex min-h-[280px] flex-col items-center justify-center gap-3 p-6 text-center">
                  <LoaderCircle className="size-6 animate-spin text-primary" />
                  <p className="text-sm font-medium">Preparing the report…</p>
                  <p className="max-w-sm text-xs leading-relaxed text-muted-foreground">
                    Do not close this page. Success is only shown after the API
                    confirms that generation finished.
                  </p>
                </CardContent>
              </Card>
            ) : report ? (
              <Card>
                <CardHeader className="flex-row flex-wrap items-start justify-between gap-2">
                  <div>
                    <CardTitle>Report record</CardTitle>
                    <CardDescription>
                      Returned by the report endpoint. Treat the download link as
                      private.
                    </CardDescription>
                  </div>
                  <ReportStatusBadge status={report.status} />
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="rounded-lg border border-border bg-muted/25 px-3.5 py-3">
                    <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
                      File
                    </p>
                    <p className="mt-0.5 flex items-center gap-1.5 text-sm font-medium">
                      <FileText className="size-3.5 text-muted-foreground" />
                      {report.file_name}
                    </p>
                    <div className="mt-3 grid gap-2 text-[11px] sm:grid-cols-2">
                      <div>
                        <p className="text-muted-foreground">Generated</p>
                        <p className="font-medium">
                          {formatDateTime(report.generated_at)}
                        </p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Link expires</p>
                        <p className="font-medium">
                          {formatDateTime(report.expires_at)}
                        </p>
                      </div>
                    </div>
                    <p className="mt-3 break-all font-mono text-[10px] text-muted-foreground">
                      Reference {shortHash(report.report_id, 12)}
                    </p>
                  </div>

                  {report.status === "generated" && report.download_url ? (
                    <div className="space-y-2">
                      <Button asChild className="w-full">
                        <a
                          href={report.download_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          download
                        >
                          <Download className="size-4" />
                          Download report
                        </a>
                      </Button>
                      <p className="flex items-start gap-1.5 text-[10px] leading-relaxed text-muted-foreground">
                        <Timer className="mt-0.5 size-3 shrink-0" />
                        The link is short-lived and may be personalized. Do not
                        forward it or post it publicly.
                      </p>
                    </div>
                  ) : null}

                  {report.status === "generated" && !report.download_url ? (
                    <div className="space-y-2">
                      <Alert variant="warning">
                        <Info />
                        <div>
                          <AlertTitle>No report file was returned</AlertTitle>
                          <AlertDescription>
                            {isMockApiEnabled
                              ? "The demo adapter cannot produce a PDF. Use the clearly labelled text summary below instead. It is not a generated legal report."
                              : "The API returned an empty download URL. Try again, or contact the service owner if the problem continues."}
                          </AlertDescription>
                        </div>
                      </Alert>
                      {isMockApiEnabled ? (
                        <Button
                          type="button"
                          variant="outline"
                          className="w-full"
                          onClick={handleDemoDownload}
                        >
                          <Download className="size-4" />
                          Download demo summary (.txt)
                        </Button>
                      ) : null}
                    </div>
                  ) : null}

                  {report.status !== "generated" ? (
                    <Alert variant="destructive">
                      <ShieldAlert />
                      <div>
                        <AlertTitle>This report is not available</AlertTitle>
                        <AlertDescription>
                          The API returned status “{report.status}”. No download is
                          offered for a failed or expired report.
                        </AlertDescription>
                      </div>
                    </Alert>
                  ) : null}

                  <div className="flex items-start gap-2 rounded-lg border border-border bg-muted/25 px-3 py-2.5 text-[11px] leading-relaxed text-muted-foreground">
                    <ShieldAlert className="mt-0.5 size-3.5 shrink-0" />
                    <p>
                      A generated report organizes the information you provided. It
                      is not a legal determination, an official police report, or a
                      guarantee that any authority will act on it.
                    </p>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardHeader>
                  <CardTitle>Preview</CardTitle>
                  <CardDescription>
                    This is a summary of the incident record that will be used.
                    Nothing has been generated yet.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {incident ? (
                    <div className="space-y-4">
                      <div>
                        <p className="text-sm font-semibold">{incident.title}</p>
                        <p className="mt-1 text-[11px] text-muted-foreground">
                          {categoryLabel(incident.category)} ·{" "}
                          {formatDateTime(incident.occurred_at)}
                        </p>
                      </div>
                      <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">
                        {incident.description}
                      </p>
                      <div className="grid gap-2 sm:grid-cols-2">
                        <div className="rounded-md border border-border px-3 py-2">
                          <p className="text-[10px] uppercase tracking-[0.1em] text-muted-foreground">
                            Evidence
                          </p>
                          <p className="mt-0.5 text-sm font-medium">
                            {pluralize(evidence.length, "file")}
                          </p>
                        </div>
                        <div className="rounded-md border border-border px-3 py-2">
                          <p className="text-[10px] uppercase tracking-[0.1em] text-muted-foreground">
                            Analyses
                          </p>
                          <p className="mt-0.5 text-sm font-medium">
                            {pluralize(analyses.length, "result")}
                          </p>
                        </div>
                      </div>
                      {includeEvidence && evidence.length > 0 ? (
                        <ul className="space-y-1 text-[11px] text-muted-foreground">
                          {evidence.map((item) => (
                            <li
                              key={item.id}
                              className="flex items-center justify-between gap-2 rounded-md border border-border px-2.5 py-1.5"
                            >
                              <span className="min-w-0 truncate">
                                {item.file_name}
                              </span>
                              <span className="shrink-0 font-mono text-[10px]">
                                {shortHash(item.sha256, 6)}
                              </span>
                            </li>
                          ))}
                        </ul>
                      ) : null}
                      <Button asChild variant="outline" size="sm">
                        <Link href={`/incidents/${incident.id}`}>
                          <FileText className="size-3.5" />
                          Open full incident
                        </Link>
                      </Button>
                    </div>
                  ) : (
                    <EmptyState
                      icon={<Sparkles className="size-5" />}
                      title="Choose an incident"
                      description="Select a record to preview the content that will be included."
                    />
                  )}
                </CardContent>
              </Card>
            )}

            <AiDisclosure variant="report" sample={isMockApiEnabled} />
          </div>
        </div>
      )}
    </div>
  );
}
