"use client";

import * as React from "react";
import Link from "next/link";
import {
  AlertCircle,
  CheckCircle2,
  CloudUpload,
  FileWarning,
  FolderLock,
  Image as ImageIcon,
  LoaderCircle,
  ShieldCheck,
  ShieldX,
  UploadCloud,
  X,
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
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CopyButton } from "@/components/shared/copy-button";
import { EmptyState, ErrorState } from "@/components/shared/states";
import { ListSkeleton } from "@/components/shared/loading-states";
import { PageHeader } from "@/components/shared/page-header";
import { EvidenceStatusBadge } from "@/components/shared/status-badges";
import { MockDataBadge } from "@/components/shared/demo-notices";
import {
  listIncidentEvidence,
  listIncidents,
  uploadEvidence,
  verifyEvidenceHash,
} from "@/lib/api";
import { errorMessage, isApiRequestError } from "@/lib/api/client";
import { isMockApiEnabled } from "@/lib/api/config";
import { useAsyncData } from "@/lib/hooks/use-async-data";
import type {
  Evidence,
  EvidenceStorageStatus,
  HashVerification,
} from "@/lib/types/api";
import { formatBytes, formatDateTime, pluralize, shortHash } from "@/lib/utils/format";
import { validateEvidenceFile } from "@/lib/validation/evidence";

type VerificationState =
  | { status: "verifying" }
  | { status: "verified"; result: HashVerification }
  | { status: "mismatch"; result: HashVerification }
  | { status: "error"; message: string };

export function EvidenceView() {
  const incidentsQuery = useAsyncData(
    () => listIncidents({ limit: 100 }),
    "evidence-incidents",
  );
  const [incidentId, setIncidentId] = React.useState<string>("");
  const [selectedFile, setSelectedFile] = React.useState<File | null>(null);
  const [fileError, setFileError] = React.useState<string | null>(null);
  const [uploading, setUploading] = React.useState(false);
  const [progress, setProgress] = React.useState(0);
  const [uploadError, setUploadError] = React.useState<string | null>(null);
  const [lastUploaded, setLastUploaded] = React.useState<Evidence | null>(null);
  const [dragActive, setDragActive] = React.useState(false);
  const [verifications, setVerifications] = React.useState<
    Record<string, VerificationState>
  >({});
  const [previewUrl, setPreviewUrl] = React.useState<string | null>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const evidenceQuery = useAsyncData(
    () => listIncidentEvidence(incidentId),
    `evidence-${incidentId}`,
    Boolean(incidentId),
  );

  React.useEffect(() => {
    if (incidentId) return;
    if (typeof window === "undefined") return;
    const fromQuery = new URLSearchParams(window.location.search).get("incident");
    if (fromQuery) {
      setIncidentId(fromQuery);
      return;
    }
    const first = incidentsQuery.data?.items[0];
    if (first) setIncidentId(first.id);
  }, [incidentId, incidentsQuery.data]);

  React.useEffect(() => {
    if (!selectedFile) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(selectedFile);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [selectedFile]);

  const selectFile = (file: File | null) => {
    setUploadError(null);
    setLastUploaded(null);
    if (!file) {
      setSelectedFile(null);
      setFileError(null);
      return;
    }
    const validation = validateEvidenceFile(file);
    if (validation) {
      setFileError(validation);
      setSelectedFile(null);
      return;
    }
    setFileError(null);
    setSelectedFile(file);
  };

  const handleUpload = async () => {
    if (!selectedFile || !incidentId) return;
    setUploading(true);
    setProgress(0);
    setUploadError(null);
    setLastUploaded(null);

    try {
      const evidence = await uploadEvidence(incidentId, selectedFile, setProgress);
      setLastUploaded(evidence);
      setSelectedFile(null);
      setProgress(100);
      evidenceQuery.refresh();
      toast.success(
        isMockApiEnabled ? "Simulated upload recorded" : "Evidence stored",
        {
          description: isMockApiEnabled
            ? "Demo adapter: metadata and a locally computed SHA-256 were saved. No file left this device."
            : "The API confirmed storage. The private file is not exposed through a public URL.",
        },
      );
    } catch (cause) {
      setUploadError(
        isApiRequestError(cause) && cause.status === 0
          ? `${errorMessage(cause)} The upload was not confirmed.`
          : `${errorMessage(cause)} The upload was not confirmed.`,
      );
      setProgress(0);
    } finally {
      setUploading(false);
    }
  };

  const handleVerify = async (evidence: Evidence) => {
    setVerifications((current) => ({
      ...current,
      [evidence.id]: { status: "verifying" },
    }));
    try {
      const result = await verifyEvidenceHash(evidence.id);
      setVerifications((current) => ({
        ...current,
        [evidence.id]: {
          status: result.matches ? "verified" : "mismatch",
          result,
        },
      }));
      if (result.matches) {
        toast.success("Hash verification completed");
      } else {
        toast.error("Hash mismatch reported");
      }
    } catch (cause) {
      setVerifications((current) => ({
        ...current,
        [evidence.id]: { status: "error", message: errorMessage(cause) },
      }));
    }
  };

  const incidents = incidentsQuery.data?.items ?? [];
  const evidence = evidenceQuery.data?.items ?? [];
  const aggregateStatus: EvidenceStorageStatus | null =
    evidence.length === 0
      ? null
      : evidence.some((item) => item.storage_status === "failed")
        ? "failed"
        : evidence.some((item) => item.storage_status === "pending")
          ? "pending"
          : "stored";
  const totalBytes = evidence.reduce((total, item) => total + item.size_bytes, 0);
  const selectedIncident = incidents.find((incident) => incident.id === incidentId);

  return (
    <div className="space-y-6 animate-fade-up">
      <PageHeader
        eyebrow="EvidenceVault"
        title="Private evidence"
        description="Upload supporting images, keep their metadata with an incident, and verify SHA-256 consistency. Evidence is stored in a private bucket and is never exposed through a public URL."
        actions={<MockDataBadge />}
      />

      <Card>
        <CardContent className="grid gap-4 p-4 sm:grid-cols-[1fr_auto] sm:items-end">
          <div className="space-y-1.5">
            <Label htmlFor="incident-select">Incident</Label>
            <Select value={incidentId} onValueChange={setIncidentId}>
              <SelectTrigger id="incident-select" className="sm:max-w-md">
                <SelectValue placeholder="Choose an incident" />
              </SelectTrigger>
              <SelectContent>
                {incidents.map((incident) => (
                  <SelectItem key={incident.id} value={incident.id}>
                    {incident.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedIncident ? (
              <p className="text-[11px] text-muted-foreground">
                {pluralize(evidence.length, "file")} ·{" "}
                {formatBytes(totalBytes)} ·{" "}
                <Link
                  href={`/incidents/${selectedIncident.id}`}
                  className="font-medium text-primary underline-offset-4 hover:underline"
                >
                  Open incident
                </Link>
              </p>
            ) : null}
          </div>
        </CardContent>
      </Card>

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
          icon={<FolderLock className="size-5" />}
          title="Create an incident first"
          description="Evidence must be associated with an incident you own. Create a record, then return here to upload supporting images."
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
                <CardTitle>Upload evidence</CardTitle>
                <CardDescription>
                  JPEG, PNG or WebP · up to 10 MB. The API calculates the SHA-256
                  from the received bytes.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {uploadError ? (
                  <Alert variant="destructive">
                    <AlertCircle />
                    <div>
                      <AlertTitle>Upload not confirmed</AlertTitle>
                      <AlertDescription>{uploadError}</AlertDescription>
                    </div>
                  </Alert>
                ) : null}

                <div
                  onDragOver={(event) => {
                    event.preventDefault();
                    setDragActive(true);
                  }}
                  onDragLeave={() => setDragActive(false)}
                  onDrop={(event) => {
                    event.preventDefault();
                    setDragActive(false);
                    selectFile(event.dataTransfer.files?.[0] ?? null);
                  }}
                  className={
                    dragActive
                      ? "rounded-lg border-2 border-dashed border-primary/50 bg-secondary/40 p-5 text-center"
                      : "rounded-lg border-2 border-dashed border-border bg-muted/20 p-5 text-center"
                  }
                >
                  <input
                    ref={inputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="sr-only"
                    onChange={(event) => selectFile(event.target.files?.[0] ?? null)}
                    aria-label="Choose evidence file"
                  />

                  {selectedFile && previewUrl ? (
                    <div className="space-y-3">
                      {/* Local preview only. This object URL never leaves the browser. */}
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={previewUrl}
                        alt="Local preview of the selected evidence file"
                        className="mx-auto max-h-40 rounded-md border border-border object-contain"
                      />
                      <div className="min-w-0">
                        <p className="truncate text-xs font-medium">
                          {selectedFile.name}
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          {formatBytes(selectedFile.size)} · {selectedFile.type}
                        </p>
                      </div>
                      <div className="flex justify-center gap-2">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => inputRef.current?.click()}
                          disabled={uploading}
                        >
                          Replace
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => selectFile(null)}
                          disabled={uploading}
                        >
                          <X className="size-3.5" />
                          Remove
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <span className="mx-auto flex size-10 items-center justify-center rounded-full border border-border bg-card text-muted-foreground">
                        <CloudUpload className="size-5" />
                      </span>
                      <p className="text-sm font-medium">
                        Drop an image here or choose a file
                      </p>
                      <p className="text-[11px] leading-relaxed text-muted-foreground">
                        The local preview stays in your browser. Nothing is
                        uploaded until you confirm.
                      </p>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => inputRef.current?.click()}
                      >
                        <ImageIcon className="size-3.5" />
                        Choose file
                      </Button>
                    </div>
                  )}
                </div>

                {fileError ? (
                  <p className="flex items-start gap-1.5 text-xs text-destructive">
                    <FileWarning className="mt-0.5 size-3.5 shrink-0" />
                    {fileError}
                  </p>
                ) : null}

                {uploading ? (
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                      <span>Uploading — do not close this page</span>
                      <span className="tabular-nums">{progress}%</span>
                    </div>
                    <Progress value={progress} />
                  </div>
                ) : null}

                <Button
                  type="button"
                  className="w-full"
                  onClick={() => void handleUpload()}
                  disabled={!selectedFile || uploading || !incidentId}
                >
                  {uploading ? (
                    <LoaderCircle className="size-4 animate-spin" />
                  ) : (
                    <UploadCloud className="size-4" />
                  )}
                  {uploading ? "Uploading…" : "Upload evidence"}
                </Button>

                <p className="text-[10px] leading-relaxed text-muted-foreground">
                  {isMockApiEnabled
                    ? "Demo adapter: SHA-256 is computed in your browser and only file metadata is saved locally. No file is uploaded."
                    : "Uploads are sent directly to the Core API with your Supabase access token. Success is only shown after the API confirms storage."}
                </p>
              </CardContent>
            </Card>

            {lastUploaded ? (
              <Alert variant="success">
                <CheckCircle2 />
                <div className="min-w-0">
                  <AlertTitle>
                    {isMockApiEnabled
                      ? "Simulated upload recorded"
                      : "Stored — confirmed by the API"}
                  </AlertTitle>
                  <AlertDescription>
                    <span className="block truncate">{lastUploaded.file_name}</span>
                    <span className="mt-1 flex items-center gap-1 break-all font-mono text-[11px]">
                      {lastUploaded.sha256}
                      <CopyButton value={lastUploaded.sha256} />
                    </span>
                  </AlertDescription>
                </div>
              </Alert>
            ) : null}

            <div className="rounded-lg border border-border bg-card p-4 text-[11px] leading-relaxed text-muted-foreground">
              <p className="mb-1 flex items-center gap-1.5 font-medium text-foreground">
                <ShieldCheck className="size-3.5 text-primary" />
                What a hash proves
              </p>
              A matching SHA-256 indicates byte-level consistency with the stored
              reference file. It does not prove when, where or by whom the file
              was created, and it is not a legal authenticity certificate.
            </div>
          </div>

          <Card>
            <CardHeader className="flex-row flex-wrap items-center justify-between gap-2">
              <div>
                <CardTitle>Evidence files</CardTitle>
                <CardDescription>
                  Metadata only. Private storage URLs are never displayed.
                </CardDescription>
              </div>
              {aggregateStatus ? (
                <EvidenceStatusBadge status={aggregateStatus} />
              ) : null}
            </CardHeader>
            <CardContent>
              {evidenceQuery.error ? (
                <ErrorState
                  title="Evidence could not be loaded"
                  message={evidenceQuery.error}
                  onRetry={evidenceQuery.refresh}
                />
              ) : evidenceQuery.loading && !evidenceQuery.data ? (
                <ListSkeleton rows={4} />
              ) : evidence.length === 0 ? (
                <EmptyState
                  icon={<FolderLock className="size-5" />}
                  title="No evidence for this incident"
                  description="Upload a screenshot or image using the panel on the left. The file is stored privately and only metadata is listed here."
                />
              ) : (
                <ul className="space-y-3">
                  {evidence.map((item) => {
                    const verification = verifications[item.id];
                    return (
                      <li
                        key={item.id}
                        className="rounded-lg border border-border p-3.5"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium">
                              {item.file_name}
                            </p>
                            <p className="mt-0.5 text-xs text-muted-foreground">
                              {formatBytes(item.size_bytes)} · {item.mime_type} ·{" "}
                              {formatDateTime(item.uploaded_at)}
                            </p>
                          </div>
                          <EvidenceStatusBadge status={item.storage_status} />
                        </div>

                        <div className="mt-3 rounded-md border border-border bg-muted/30 px-2.5 py-2">
                          <p className="text-[10px] font-medium uppercase tracking-[0.1em] text-muted-foreground">
                            SHA-256
                          </p>
                          <div className="mt-0.5 flex items-start gap-1">
                            <p className="break-all font-mono text-[11px] leading-relaxed text-foreground/85">
                              {item.sha256}
                            </p>
                            <CopyButton value={item.sha256} label="Copy SHA-256" />
                          </div>
                        </div>

                        <div className="mt-3 flex flex-wrap items-center gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => void handleVerify(item)}
                            disabled={verification?.status === "verifying"}
                          >
                            {verification?.status === "verifying" ? (
                              <LoaderCircle className="size-3.5 animate-spin" />
                            ) : (
                              <ShieldCheck className="size-3.5" />
                            )}
                            {verification?.status === "verifying"
                              ? "Verifying…"
                              : "Verify hash"}
                          </Button>
                          {verification?.status === "verified" ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-[#1c6b47]">
                              <CheckCircle2 className="size-3.5" />
                              Matches recorded reference
                              {isMockApiEnabled ? " (simulated)" : ""}
                            </span>
                          ) : null}
                          {verification?.status === "mismatch" ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-destructive">
                              <ShieldX className="size-3.5" />
                              Hash mismatch
                            </span>
                          ) : null}
                          {verification?.status === "error" ? (
                            <span className="text-[11px] text-destructive">
                              {verification.message}
                            </span>
                          ) : null}
                        </div>

                        {verification &&
                        (verification.status === "verified" ||
                          verification.status === "mismatch") ? (
                          <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
                            {verification.result.message} Verified{" "}
                            {formatDateTime(verification.result.verified_at)}.
                            Current hash {shortHash(verification.result.current_sha256, 12)}.
                          </p>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
