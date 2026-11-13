"use client";

import * as React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  AlertCircle,
  ChevronRight,
  FileScan,
  LoaderCircle,
  ScanSearch,
  Sparkles,
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
import { Switch } from "@/components/ui/switch";
import { AnalysisResult } from "@/components/analysis/analysis-result";
import { EmptyState, ErrorState } from "@/components/shared/states";
import { ListSkeleton } from "@/components/shared/loading-states";
import { PageHeader } from "@/components/shared/page-header";
import { MockDataBadge } from "@/components/shared/demo-notices";
import {
  listIncidentAnalyses,
  listIncidentEvidence,
  listIncidents,
  requestIncidentAnalysis,
} from "@/lib/api";
import { errorMessage } from "@/lib/api/client";
import { isMockApiEnabled } from "@/lib/api/config";
import { useAsyncData } from "@/lib/hooks/use-async-data";
import { formatBytes, formatDateTime, pluralize } from "@/lib/utils/format";

export function ThreatLensView() {
  const incidentsQuery = useAsyncData(
    () => listIncidents({ limit: 100 }),
    "threatlens-incidents",
  );
  const [incidentId, setIncidentId] = React.useState("");
  const searchParams = useSearchParams();
  const requestedIncidentId =
    incidentId || searchParams.get("incident") || "";
  const [selectedEvidence, setSelectedEvidence] = React.useState<Set<string>>(
    new Set(),
  );
  const [includeDescription, setIncludeDescription] = React.useState(true);
  const [selectedAnalysisId, setSelectedAnalysisId] = React.useState<string | null>(
    null,
  );
  const [submitting, setSubmitting] = React.useState(false);
  const [formError, setFormError] = React.useState<string | null>(null);

  const incidents = incidentsQuery.data?.items ?? [];
  const incident =
    incidents.find((item) => item.id === requestedIncidentId) ?? incidents[0];
  const effectiveIncidentId = incident?.id ?? "";

  const evidenceQuery = useAsyncData(
    () => listIncidentEvidence(effectiveIncidentId),
    `threatlens-evidence-${effectiveIncidentId}`,
    Boolean(effectiveIncidentId),
  );
  const analysesQuery = useAsyncData(
    () => listIncidentAnalyses(effectiveIncidentId),
    `threatlens-analyses-${effectiveIncidentId}`,
    Boolean(effectiveIncidentId),
  );

  const evidence = evidenceQuery.data?.items ?? [];
  const analyses = analysesQuery.data?.items ?? [];
  const selectedAnalysis =
    analyses.find((item) => item.analysis_id === selectedAnalysisId) ?? analyses[0];

  const toggleEvidence = (id: string) => {
    setSelectedEvidence((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSubmit = async () => {
    setFormError(null);
    if (!effectiveIncidentId) {
      setFormError("Choose an incident to analyse.");
      return;
    }
    if (!includeDescription && selectedEvidence.size === 0) {
      setFormError(
        "Choose at least one input: include the description or select an evidence file.",
      );
      return;
    }

    setSubmitting(true);
    try {
      const result = await requestIncidentAnalysis(effectiveIncidentId, {
        evidence_ids: Array.from(selectedEvidence),
        include_description: includeDescription,
      });
      setSelectedAnalysisId(result.analysis_id);
      analysesQuery.refresh();
      toast.success(
        isMockApiEnabled ? "Sample analysis generated" : "Analysis completed",
        {
          description: isMockApiEnabled
            ? "Demo adapter: this result is a local sample, not a live model result."
            : "The result is informational and includes its limitations.",
        },
      );
    } catch (cause) {
      setFormError(errorMessage(cause));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-up">
      <PageHeader
        eyebrow="ThreatLens"
        title="Explainable analysis"
        description="Submit an incident description or supporting images for AI-assisted OCR and classification. Results are informational, include their indicators and limitations, and are never treated as verified facts."
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
          icon={<ScanSearch className="size-5" />}
          title="Create an incident first"
          description="Analysis is requested against an incident you own. Create a record with a description, then return here."
          action={
            <Button asChild size="sm">
              <Link href="/incidents/new">Create an incident</Link>
            </Button>
          }
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-[360px_1fr]">
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Request analysis</CardTitle>
                <CardDescription>
                  The Core API orchestrates the Intelligence service. The browser
                  never calls it directly.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {formError ? (
                  <Alert variant="destructive">
                    <AlertCircle />
                    <div>
                      <AlertTitle>Analysis was not completed</AlertTitle>
                      <AlertDescription>{formError}</AlertDescription>
                    </div>
                  </Alert>
                ) : null}

                <div className="space-y-1.5">
                  <Label htmlFor="analysis-incident">Incident</Label>
                  <Select
                    value={effectiveIncidentId}
                    onValueChange={(value) => {
                      setIncidentId(value);
                      setSelectedEvidence(new Set());
                      setSelectedAnalysisId(null);
                      setFormError(null);
                    }}
                  >
                    <SelectTrigger id="analysis-incident">
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

                <div className="flex items-center justify-between gap-3 rounded-lg border border-border p-3">
                  <div>
                    <Label htmlFor="include-description" className="cursor-pointer">
                      Include description
                    </Label>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">
                      Send the text you wrote for classification.
                    </p>
                  </div>
                  <Switch
                    id="include-description"
                    checked={includeDescription}
                    onCheckedChange={setIncludeDescription}
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <Label>Evidence images</Label>
                    {evidence.length > 0 ? (
                      <button
                        type="button"
                        onClick={() =>
                          setSelectedEvidence(
                            selectedEvidence.size === evidence.length
                              ? new Set()
                              : new Set(evidence.map((item) => item.id)),
                          )
                        }
                        className="cursor-pointer text-[11px] font-medium text-primary underline-offset-4 hover:underline"
                      >
                        {selectedEvidence.size === evidence.length
                          ? "Clear all"
                          : "Select all"}
                      </button>
                    ) : null}
                  </div>

                  {evidenceQuery.error ? (
                    <ErrorState
                      title="Evidence could not be loaded"
                      message={evidenceQuery.error}
                      onRetry={evidenceQuery.refresh}
                    />
                  ) : evidenceQuery.loading && !evidenceQuery.data ? (
                    <ListSkeleton rows={2} />
                  ) : evidence.length === 0 ? (
                    <p className="rounded-md border border-dashed border-border bg-muted/25 px-3 py-3 text-[11px] leading-relaxed text-muted-foreground">
                      No evidence is attached to this incident. The description
                      alone can still be analysed.
                    </p>
                  ) : (
                    <ul className="space-y-2">
                      {evidence.map((item) => (
                        <li
                          key={item.id}
                          className="flex items-start gap-2.5 rounded-md border border-border px-2.5 py-2"
                        >
                          <Checkbox
                            id={`evidence-${item.id}`}
                            checked={selectedEvidence.has(item.id)}
                            onCheckedChange={() => toggleEvidence(item.id)}
                            className="mt-0.5"
                          />
                          <Label
                            htmlFor={`evidence-${item.id}`}
                            className="cursor-pointer flex-col items-start gap-0 text-xs font-normal"
                          >
                            <span className="flex items-center gap-1.5 font-medium">
                              <FileScan className="size-3.5 text-muted-foreground" />
                              <span className="truncate">{item.file_name}</span>
                            </span>
                            <span className="text-[10px] text-muted-foreground">
                              {formatBytes(item.size_bytes)} · {item.mime_type}
                            </span>
                          </Label>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <Button
                  type="button"
                  className="w-full"
                  onClick={() => void handleSubmit()}
                  disabled={submitting || !effectiveIncidentId}
                >
                  {submitting ? (
                    <LoaderCircle className="size-4 animate-spin" />
                  ) : (
                    <Sparkles className="size-4" />
                  )}
                  {submitting ? "Analysing…" : "Run analysis"}
                </Button>

                <p className="text-[10px] leading-relaxed text-muted-foreground">
                  {isMockApiEnabled
                    ? "Demo adapter: this request is simulated locally. No OCR or model runs."
                    : "Only the inputs you select are sent. The Core API controls access and persistence."}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>History</CardTitle>
                <CardDescription>
                  {pluralize(analyses.length, "result")} for this incident.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {analysesQuery.error ? (
                  <ErrorState
                    title="Analysis history could not be loaded"
                    message={analysesQuery.error}
                    onRetry={analysesQuery.refresh}
                  />
                ) : analysesQuery.loading && !analysesQuery.data ? (
                  <ListSkeleton rows={2} />
                ) : analyses.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    No analysis has been requested for this incident yet.
                  </p>
                ) : (
                  <ul className="space-y-1">
                    {analyses.map((item) => {
                      const active = item.analysis_id === selectedAnalysis?.analysis_id;
                      return (
                        <li key={item.analysis_id}>
                          <button
                            type="button"
                            onClick={() => setSelectedAnalysisId(item.analysis_id)}
                            className={
                              active
                                ? "flex w-full cursor-pointer items-center gap-2 rounded-md bg-secondary px-2.5 py-2 text-left"
                                : "flex w-full cursor-pointer items-center gap-2 rounded-md px-2.5 py-2 text-left hover:bg-muted/60"
                            }
                          >
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-xs font-medium">
                                {item.classification.label.replaceAll("_", " ")}
                              </span>
                              <span className="block text-[10px] text-muted-foreground">
                                {formatDateTime(item.created_at)}
                              </span>
                            </span>
                            <ChevronRight className="size-3.5 shrink-0 text-muted-foreground" />
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </CardContent>
            </Card>
          </div>

          <div>
            {analysesQuery.error && !analysesQuery.data ? (
              <ErrorState
                title="Analysis results could not be loaded"
                message={analysesQuery.error}
                onRetry={analysesQuery.refresh}
              />
            ) : selectedAnalysis ? (
              <AnalysisResult
                analysis={selectedAnalysis}
                incidentDescription={incident?.description}
                sample={isMockApiEnabled}
              />
            ) : (
              <EmptyState
                icon={<ScanSearch className="size-5" />}
                title="No analysis result to display"
                description="Choose the inputs on the left and run an analysis. You will see the classification, model score, indicators, OCR text, review-priority factors and limitations."
                className="min-h-[420px]"
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
