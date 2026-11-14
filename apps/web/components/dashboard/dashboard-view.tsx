"use client";

import * as React from "react";
import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  Clock3,
  FileText,
  FolderLock,
  Network,
  ScanSearch,
  ShieldCheck,
  Users,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { EmptyState, ErrorState } from "@/components/shared/states";
import { ListSkeleton, StatGridSkeleton } from "@/components/shared/loading-states";
import {
  AnalysisStatusBadge,
  CategoryBadge,
  RiskBadge,
  SafetyStatusBadge,
  displaySessionStatus,
} from "@/components/shared/status-badges";
import { StatCard } from "@/components/shared/stat-card";
import { CategoryChart } from "@/components/dashboard/category-chart";
import { checkInToSession } from "@/lib/api";
import { errorMessage } from "@/lib/api/client";
import { useAsyncData } from "@/lib/hooks/use-async-data";
import { useCountdown } from "@/lib/hooks/use-countdown";
import { loadDashboardData } from "@/lib/dashboard/data";
import { useAuth } from "@/lib/auth/auth-provider";
import {
  formatBytes,
  formatDateTime,
  formatRelative,
  pluralize,
  truncate,
} from "@/lib/utils/format";

function greetingForHour(hour: number): string {
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

export function DashboardView() {
  const { user } = useAuth();
  const [now, setNow] = React.useState<Date | null>(null);
  const [checkingIn, setCheckingIn] = React.useState<string | null>(null);

  const { data, error, loading, refresh } = useAsyncData(
    loadDashboardData,
    "dashboard",
  );

  React.useEffect(() => {
    // The greeting depends on the browser's local clock. Rendering it after
    // mount avoids a server/client hydration mismatch.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setNow(new Date());
  }, []);

  const firstName = user?.displayName?.split(" ")[0] ?? "there";

  const handleCheckIn = async (sessionId: string) => {
    setCheckingIn(sessionId);
    try {
      await checkInToSession(sessionId, { message: "I am safe." });
      toast.success("Checked in", {
        description: "Your safety session is marked as checked in.",
      });
      refresh();
    } catch (cause) {
      toast.error("Check-in failed", { description: errorMessage(cause) });
    } finally {
      setCheckingIn(null);
    }
  };

  if (loading && !data) {
    return (
      <div className="space-y-6">
        <div className="space-y-2">
          <div className="h-3 w-28 animate-pulse rounded bg-muted" />
          <div className="h-8 w-72 animate-pulse rounded bg-muted" />
        </div>
        <StatGridSkeleton />
        <div className="grid gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Recent incidents</CardTitle>
            </CardHeader>
            <CardContent>
              <ListSkeleton />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Safety sessions</CardTitle>
            </CardHeader>
            <CardContent>
              <ListSkeleton rows={2} />
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="space-y-6">
        <DashboardHeading firstName={firstName} now={now} />
        <ErrorState
          title="Dashboard data could not be loaded"
          message={error}
          onRetry={refresh}
        />
      </div>
    );
  }

  if (!data) return null;

  const activeSession = data.activeSessions[0];
  const activeContact = activeSession
    ? data.contactsById[activeSession.trusted_contact_id]
    : undefined;

  return (
    <div className="space-y-6 animate-fade-up">
      <DashboardHeading firstName={firstName} now={now} />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Open incidents"
          value={data.openIncidents}
          hint={`${pluralize(data.totalIncidents, "record")} in total · ${data.archivedIncidents} archived`}
          icon={<FileText className="size-4" />}
          href="/incidents"
        />
        <StatCard
          label="Evidence files"
          value={data.evidence.length}
          hint={`${formatBytes(data.totalEvidenceBytes)} across ${pluralize(data.recentIncidentCount, "recent incident")}`}
          icon={<FolderLock className="size-4" />}
          href="/evidence"
        />
        <StatCard
          label="Completed analyses"
          value={data.completedAnalyses}
          hint={`Across your ${pluralize(data.recentIncidentCount, "recent incident")}`}
          icon={<ScanSearch className="size-4" />}
          href="/threatlens"
        />
        <StatCard
          label="Active check-ins"
          value={data.activeSessions.length}
          hint={
            data.activeSessions.length > 0
              ? "A deadline is currently being tracked"
              : "No safety session is active"
          }
          icon={<Users className="size-4" />}
          href="/safecircle"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex-row items-center justify-between">
            <div>
              <CardTitle>Recent incidents</CardTitle>
              <CardDescription>
                Your latest records, ordered by when they occurred.
              </CardDescription>
            </div>
            <CardAction>
              <Button asChild variant="ghost" size="sm" className="text-primary">
                <Link href="/incidents">
                  View all
                  <ArrowRight className="size-3.5" />
                </Link>
              </Button>
            </CardAction>
          </CardHeader>
          <CardContent>
            {data.recentIncidents.length === 0 ? (
              <EmptyState
                icon={<FileText className="size-5" />}
                title="No incidents recorded yet"
                description="Create your first incident to start a chronological record. You can add evidence and request analysis afterwards."
                action={
                  <Button asChild size="sm">
                    <Link href="/incidents/new">Create an incident</Link>
                  </Button>
                }
              />
            ) : (
              <ul className="divide-y divide-border">
                {data.recentIncidents.map((incident) => (
                  <li key={incident.id}>
                    <Link
                      href={`/incidents/${incident.id}`}
                      className="group flex items-start gap-3 py-3.5 transition-colors first:pt-1 last:pb-1"
                    >
                      <span
                        aria-hidden="true"
                        className="mt-1.5 size-2 shrink-0 rounded-full bg-primary/50 transition-colors group-hover:bg-primary"
                      />
                      <span className="min-w-0 flex-1">
                        <span className="flex flex-wrap items-center gap-2">
                          <span className="truncate text-sm font-medium text-foreground group-hover:text-primary">
                            {incident.title}
                          </span>
                          {incident.status === "archived" ? (
                            <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                              Archived
                            </span>
                          ) : null}
                        </span>
                        <span className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                          <CategoryBadge
                            category={incident.category}
                            className="scale-[0.92] origin-left"
                          />
                          <span>{formatDateTime(incident.occurred_at)}</span>
                        </span>
                      </span>
                      <ArrowRight className="mt-1 size-4 shrink-0 text-muted-foreground/40 transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Safety session</CardTitle>
            <CardDescription>
              Consent-based check-ins with a trusted contact.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {activeSession ? (
              <div className="space-y-4">
                <div className="rounded-lg border border-[#cfdcee] bg-[#f2f6fb] p-4">
                  <div className="flex items-center justify-between gap-2">
                    <SafetyStatusBadge status={displaySessionStatus(activeSession)} />
                    <span className="text-[11px] text-muted-foreground">
                      {formatRelative(activeSession.created_at)}
                    </span>
                  </div>
                  <p className="mt-3 text-sm font-medium">
                    {activeContact?.name ?? "Trusted contact"}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Check-in deadline {formatDateTime(activeSession.checkin_deadline)}
                  </p>
                  <ActiveCountdown deadline={activeSession.checkin_deadline} />
                </div>
                <Button
                  className="w-full"
                  size="sm"
                  onClick={() => void handleCheckIn(activeSession.id)}
                  disabled={checkingIn === activeSession.id}
                >
                  <ShieldCheck className="size-4" />
                  {checkingIn === activeSession.id
                    ? "Checking in…"
                    : "I'm safe — check in"}
                </Button>
                <Button asChild variant="ghost" size="sm" className="w-full">
                  <Link href="/safecircle">Manage SafeCircle</Link>
                </Button>
              </div>
            ) : (
              <EmptyState
                icon={<Clock3 className="size-5" />}
                title="No active check-in"
                description="Start a session with a trusted contact and a deadline. Missed check-ins may create a reminder only — never an automatic dispatch."
                action={
                  <Button asChild size="sm" variant="outline">
                    <Link href="/safecircle">Open SafeCircle</Link>
                  </Button>
                }
                className="border-0 bg-transparent px-0 py-4"
              />
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex-row items-center justify-between">
            <div>
              <CardTitle>Analysis status</CardTitle>
              <CardDescription>
                AI-assisted results for your recent incidents.
              </CardDescription>
            </div>
            <CardAction>
              <Button asChild variant="ghost" size="sm" className="text-primary">
                <Link href="/threatlens">
                  Open ThreatLens
                  <ArrowRight className="size-3.5" />
                </Link>
              </Button>
            </CardAction>
          </CardHeader>
          <CardContent>
            {data.analyses.length === 0 ? (
              <EmptyState
                icon={<ScanSearch className="size-5" />}
                title="No analysis results yet"
                description="Request an explainable analysis from ThreatLens. Results are informational and always include limitations."
                action={
                  <Button asChild size="sm" variant="outline">
                    <Link href="/threatlens">Run an analysis</Link>
                  </Button>
                }
              />
            ) : (
              <ul className="divide-y divide-border">
                {data.analyses.slice(0, 4).map((analysis) => {
                  const incident = data.recentIncidents.find(
                    (item) => item.id === analysis.incident_id,
                  );
                  return (
                    <li key={analysis.analysis_id} className="py-3.5 first:pt-1 last:pb-1">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">
                            {incident?.title ?? "Incident analysis"}
                          </p>
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            {categoryLabelText(analysis.classification.label)} ·{" "}
                            {formatRelative(analysis.created_at)}
                          </p>
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          <RiskBadge level={analysis.risk.level} />
                          <AnalysisStatusBadge status={analysis.status} />
                        </div>
                      </div>
                      <p className="mt-1.5 line-clamp-1 text-xs leading-relaxed text-muted-foreground">
                        {truncate(analysis.classification.explanation, 140)}
                      </p>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Evidence summary</CardTitle>
              <CardDescription>
                Metadata for your most recent incidents.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-end justify-between">
                <div>
                  <p className="text-2xl font-semibold tabular-nums">
                    {data.evidence.length}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    files · {formatBytes(data.totalEvidenceBytes)}
                  </p>
                </div>
                <Button asChild variant="outline" size="sm">
                  <Link href="/evidence">Open vault</Link>
                </Button>
              </div>
              <div className="rounded-md border border-border bg-muted/30 px-3 py-2 text-[11px] leading-relaxed text-muted-foreground">
                <CheckCircle2 className="mr-1.5 inline size-3 text-[#1c6b47]" />
                {data.lastEvidenceAt
                  ? `Last upload ${formatRelative(data.lastEvidenceAt)}. Hashes are shown per file.`
                  : "No evidence has been uploaded yet."}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Category mix</CardTitle>
              <CardDescription>
                Distribution across your recorded incidents.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <CategoryChart incidents={data.recentIncidents} />
            </CardContent>
          </Card>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Quick actions</CardTitle>
          <CardDescription>
            Move through the workflow without leaving the dashboard.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
            {[
              {
                href: "/incidents/new",
                label: "Record an incident",
                icon: FileText,
              },
              {
                href: "/evidence",
                label: "Upload evidence",
                icon: FolderLock,
              },
              {
                href: "/threatlens",
                label: "Analyse content",
                icon: ScanSearch,
              },
              {
                href: "/patterns",
                label: "Review patterns",
                icon: Network,
              },
            ].map((action) => {
              const Icon = action.icon;
              return (
                <Link
                  key={action.href}
                  href={action.href}
                  className="group flex items-center gap-3 rounded-lg border border-border bg-card px-3.5 py-3 text-sm transition-colors hover:border-primary/25 hover:bg-muted/30"
                >
                  <span className="flex size-8 items-center justify-center rounded-md bg-secondary text-secondary-foreground">
                    <Icon className="size-4" />
                  </span>
                  <span className="flex-1 font-medium">{action.label}</span>
                  <ArrowRight className="size-3.5 text-muted-foreground/50 transition-transform group-hover:translate-x-0.5" />
                </Link>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function DashboardHeading({
  firstName,
  now,
}: {
  firstName: string;
  now: Date | null;
}) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="space-y-1.5">
        <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
          {now
            ? now.toLocaleDateString(undefined, {
                weekday: "long",
                day: "numeric",
                month: "long",
              })
            : "Workspace overview"}
        </p>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-[28px]">
          {now ? `${greetingForHour(now.getHours())}, ${firstName}.` : `Welcome back, ${firstName}.`}
        </h1>
        <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
          A current view of your documentation, evidence metadata and safety
          check-ins.
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button asChild>
          <Link href="/incidents/new">
            <FileText className="size-4" />
            New incident
          </Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/safecircle">
            <Users className="size-4" />
            Start check-in
          </Link>
        </Button>
      </div>
    </div>
  );
}

function ActiveCountdown({ deadline }: { deadline: string }) {
  const { label, expired } = useCountdown(deadline);
  return (
    <p
      className={
        expired
          ? "mt-3 text-xs font-medium text-[#9a6100]"
          : "mt-3 text-xs font-medium text-[#1f456f]"
      }
    >
      {label}
    </p>
  );
}

function categoryLabelText(label: string): string {
  return label.replaceAll("_", " ");
}
