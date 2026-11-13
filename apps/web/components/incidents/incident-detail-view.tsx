"use client";

import * as React from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  Archive,
  ArchiveRestore,
  ArrowLeft,
  FileSignature,
  FolderLock,
  MoreHorizontal,
  Pencil,
  Plus,
  ScanSearch,
  ShieldCheck,
  Trash2,
  UploadCloud,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { CopyButton } from "@/components/shared/copy-button";
import { EmptyState, ErrorState } from "@/components/shared/states";
import { CardSkeleton } from "@/components/shared/loading-states";
import { AiDisclosure } from "@/components/shared/ai-disclosure";
import {
  AnalysisStatusBadge,
  CategoryBadge,
  EvidenceStatusBadge,
  IncidentStatusBadge,
  RiskBadge,
  SafetyStatusBadge,
  displaySessionStatus,
} from "@/components/shared/status-badges";
import { RiskMeter } from "@/components/shared/risk-meter";
import { IncidentTimeline } from "@/components/incidents/incident-timeline";
import { deleteIncident, updateIncident } from "@/lib/api";
import { errorMessage } from "@/lib/api/client";
import { isMockApiEnabled } from "@/lib/api/config";
import { useAsyncData } from "@/lib/hooks/use-async-data";
import { loadIncidentDetail } from "@/lib/incidents/detail";
import { formatBytes, formatDateTime, formatRelative, shortHash } from "@/lib/utils/format";

export function IncidentDetailView() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const incidentId = params?.id ?? "";
  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const [busy, setBusy] = React.useState(false);

  const { data, error, loading, refresh } = useAsyncData(
    () => loadIncidentDetail(incidentId),
    `incident-${incidentId}`,
    Boolean(incidentId),
  );

  if (loading && !data) {
    return (
      <div className="space-y-4">
        <div className="h-3 w-24 animate-pulse rounded bg-muted" />
        <div className="h-8 w-2/3 animate-pulse rounded bg-muted" />
        <div className="grid gap-4 lg:grid-cols-3">
          <CardSkeleton className="lg:col-span-2" />
          <CardSkeleton />
        </div>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="space-y-4">
        <Button asChild variant="ghost" size="sm" className="-ml-2">
          <Link href="/incidents">
            <ArrowLeft className="size-4" />
            Back to incidents
          </Link>
        </Button>
        <ErrorState
          title="Incident could not be loaded"
          message={error}
          onRetry={refresh}
        />
      </div>
    );
  }

  if (!data) return null;

  const { incident, evidence, analyses, sessions } = data;
  const latestAnalysis = analyses[0];

  const handleArchiveToggle = async () => {
    setBusy(true);
    const nextStatus = incident.status === "open" ? "archived" : "open";
    try {
      await updateIncident(incident.id, { status: nextStatus });
      toast.success(nextStatus === "archived" ? "Incident archived" : "Incident reopened");
      refresh();
    } catch (cause) {
      toast.error("Could not update the incident", {
        description: errorMessage(cause),
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-up">
      <div className="space-y-3">
        <Button asChild variant="ghost" size="sm" className="-ml-2 text-muted-foreground">
          <Link href="/incidents">
            <ArrowLeft className="size-4" />
            Back to incidents
          </Link>
        </Button>

        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <CategoryBadge category={incident.category} />
              <IncidentStatusBadge status={incident.status} />
            </div>
            <h1 className="text-2xl font-semibold tracking-tight text-balance sm:text-[28px]">
              {incident.title}
            </h1>
            <p className="text-xs text-muted-foreground">
              Occurred {formatDateTime(incident.occurred_at)} · Reported{" "}
              {formatRelative(incident.created_at)}
              {incident.location_description
                ? ` · ${incident.location_description}`
                : ""}
            </p>
          </div>

          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <Button asChild variant="outline" size="sm">
              <Link href={`/incidents/${incident.id}/edit`}>
                <Pencil className="size-4" />
                Edit
              </Link>
            </Button>
            <Button asChild size="sm">
              <Link href={`/justicebridge?incident=${incident.id}`}>
                <FileSignature className="size-4" />
                Report
              </Link>
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon-sm" disabled={busy} aria-label="More actions">
                  <MoreHorizontal className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onSelect={() => void handleArchiveToggle()}>
                  {incident.status === "open" ? <Archive /> : <ArchiveRestore />}
                  {incident.status === "open" ? "Archive incident" : "Reopen incident"}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  variant="destructive"
                  onSelect={() => setDeleteOpen(true)}
                >
                  <Trash2 />
                  Delete incident
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="evidence">
            Evidence ({evidence.length})
          </TabsTrigger>
          <TabsTrigger value="analysis">Analysis ({analyses.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <div className="grid gap-4 lg:grid-cols-3">
            <div className="space-y-4 lg:col-span-2">
              <Card>
                <CardHeader>
                  <CardTitle>Description</CardTitle>
                  <CardDescription>As recorded by you.</CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="whitespace-pre-line text-sm leading-relaxed text-foreground/90">
                    {incident.description}
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Metadata</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
                  <Meta label="Category" value={<CategoryBadge category={incident.category} />} />
                  <Meta label="Status" value={<IncidentStatusBadge status={incident.status} />} />
                  <Meta label="Occurred at" value={formatDateTime(incident.occurred_at)} />
                  <Meta label="Recorded at" value={formatDateTime(incident.created_at)} />
                  <Meta label="Last updated" value={formatDateTime(incident.updated_at)} />
                  <Meta
                    label="Location description"
                    value={incident.location_description || "Not provided"}
                  />
                  <Meta
                    label="Record ID"
                    value={
                      <span className="inline-flex items-center gap-1 font-mono text-xs text-muted-foreground">
                        {incident.id}
                        <CopyButton value={incident.id} label="Copy record ID" />
                      </span>
                    }
                    className="sm:col-span-2"
                  />
                </CardContent>
              </Card>

              {sessions.length > 0 ? (
                <Card>
                  <CardHeader>
                    <CardTitle>Related safety sessions</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {sessions.map((session) => (
                      <div
                        key={session.id}
                        className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border px-3 py-2.5 text-sm"
                      >
                        <div>
                          <p className="text-xs font-medium">
                            Deadline {formatDateTime(session.checkin_deadline)}
                          </p>
                          <p className="text-[11px] text-muted-foreground">
                            Created {formatRelative(session.created_at)}
                          </p>
                        </div>
                        <SafetyStatusBadge status={displaySessionStatus(session)} />
                      </div>
                    ))}
                  </CardContent>
                </Card>
              ) : null}
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Timeline</CardTitle>
                <CardDescription>Chronological record history.</CardDescription>
              </CardHeader>
              <CardContent>
                <IncidentTimeline
                  incident={incident}
                  evidence={evidence}
                  analyses={analyses}
                  sessions={sessions}
                />
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="evidence">
          <Card>
            <CardHeader className="flex-row items-center justify-between gap-3">
              <div>
                <CardTitle>Evidence</CardTitle>
                <CardDescription>
                  Private file metadata and SHA-256 references.
                </CardDescription>
              </div>
              <Button asChild size="sm" variant="outline">
                <Link href={`/evidence?incident=${incident.id}`}>
                  <UploadCloud className="size-4" />
                  Upload
                </Link>
              </Button>
            </CardHeader>
            <CardContent>
              {evidence.length === 0 ? (
                <EmptyState
                  icon={<FolderLock className="size-5" />}
                  title="No evidence attached"
                  description="Upload a screenshot or image to keep its metadata and SHA-256 hash with this incident. Files are stored privately by the Core API."
                  action={
                    <Button asChild size="sm">
                      <Link href={`/evidence?incident=${incident.id}`}>
                        <Plus className="size-4" />
                        Add evidence
                      </Link>
                    </Button>
                  }
                />
              ) : (
                <ul className="divide-y divide-border">
                  {evidence.map((item) => (
                    <li key={item.id} className="flex flex-wrap items-start gap-3 py-3 first:pt-0 last:pb-0">
                      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-border bg-muted/40 text-muted-foreground">
                        <FolderLock className="size-4" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{item.file_name}</p>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {formatBytes(item.size_bytes)} · {item.mime_type} ·{" "}
                          {formatDateTime(item.uploaded_at)}
                        </p>
                        <p className="mt-1 flex items-center gap-1 font-mono text-[11px] text-muted-foreground">
                          SHA-256 {shortHash(item.sha256, 14)}
                          <CopyButton value={item.sha256} label="Copy SHA-256" />
                        </p>
                      </div>
                      <EvidenceStatusBadge status={item.storage_status} />
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="analysis">
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-muted-foreground">
                AI-assisted results are informational and always include
                limitations.
              </p>
              <Button asChild size="sm">
                <Link href={`/threatlens?incident=${incident.id}`}>
                  <ScanSearch className="size-4" />
                  Run analysis
                </Link>
              </Button>
            </div>

            {analyses.length === 0 ? (
              <EmptyState
                icon={<ScanSearch className="size-5" />}
                title="No analysis results"
                description="Request an explainable analysis of this incident's description or evidence. The result is not a factual determination."
                action={
                  <Button asChild size="sm">
                    <Link href={`/threatlens?incident=${incident.id}`}>
                      Open ThreatLens
                    </Link>
                  </Button>
                }
              />
            ) : (
              analyses.map((analysis) => (
                <Card key={analysis.analysis_id}>
                  <CardHeader className="flex-row flex-wrap items-start justify-between gap-2">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <CardTitle>{analysis.classification.label.replaceAll("_", " ")}</CardTitle>
                        <RiskBadge level={analysis.risk.level} />
                        <AnalysisStatusBadge status={analysis.status} />
                      </div>
                      <CardDescription>
                        Model score {analysis.classification.confidence?.toFixed(2) ?? "not provided"} ·{" "}
                        {formatRelative(analysis.created_at)}
                      </CardDescription>
                    </div>
                    <Button asChild variant="ghost" size="sm" className="text-primary">
                      <Link href={`/threatlens?incident=${incident.id}`}>Open result</Link>
                    </Button>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <p className="text-sm leading-relaxed text-foreground/90">
                      {analysis.classification.explanation}
                    </p>
                    {analysis.status === "completed" ? (
                      <RiskMeter
                        score={analysis.risk.score}
                        level={analysis.risk.level}
                        explanation={analysis.risk.explanation}
                      />
                    ) : null}
                    <AiDisclosure variant="analysis" sample={isMockApiEnabled} />
                  </CardContent>
                </Card>
              ))
            )}

            {latestAnalysis ? (
              <p className="text-[11px] leading-relaxed text-muted-foreground">
                Latest result recorded {formatDateTime(latestAnalysis.created_at)}.
                A matching hash or AI label does not establish authenticity or
                that an incident occurred.
              </p>
            ) : null}
          </div>
        </TabsContent>
      </Tabs>

      <div className="rounded-lg border border-border bg-muted/30 px-4 py-3 text-[11px] leading-relaxed text-muted-foreground">
        <ShieldCheck className="mr-1.5 inline size-3.5 text-primary" />
        This record is scoped to your account by the Core API and database Row
        Level Security. Frontend checks are not an authorization boundary.
      </div>

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete this incident?"
        description={
          <span>
            <span className="font-medium text-foreground">{incident.title}</span>{" "}
            will be permanently removed, along with its evidence metadata,
            analyses and reports. This cannot be undone.
          </span>
        }
        confirmLabel="Delete incident"
        destructive
        onConfirm={async () => {
          await deleteIncident(incident.id);
          toast.success("Incident deleted");
          router.push("/incidents");
        }}
      />
    </div>
  );
}

function Meta({
  label,
  value,
  className,
}: {
  label: string;
  value: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <p className="text-[10px] font-medium uppercase tracking-[0.1em] text-muted-foreground">
        {label}
      </p>
      <div className="mt-1 text-sm">{value}</div>
    </div>
  );
}
