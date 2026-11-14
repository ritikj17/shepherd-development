"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  BellOff,
  Check,
  DatabaseZap,
  Fingerprint,
  KeyRound,
  LoaderCircle,
  Lock,
  LogOut,
  MonitorSmartphone,
  Save,
  ShieldCheck,
  Sparkles,
  UserRound,
} from "lucide-react";
import { toast } from "sonner";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { PageHeader } from "@/components/shared/page-header";
import { MockDataBadge } from "@/components/shared/demo-notices";
import { resetDatabase } from "@/lib/api/mock/store";
import { isMockApiEnabled } from "@/lib/api/config";
import { useAuth } from "@/lib/auth/auth-provider";
import { usePreferences } from "@/lib/preferences";

const PREFERENCE_ROWS = [
  {
    key: "disclosuresExpanded" as const,
    title: "Expand AI disclosures by default",
    description:
      "Show the full AI-assisted content disclosure instead of a two-line summary.",
  },
  {
    key: "confirmBeforeDelete" as const,
    title: "Confirm before deleting",
    description:
      "Ask for confirmation before an incident or contact is removed. Recommended.",
  },
  {
    key: "draftAutosave" as const,
    title: "Save incident drafts locally",
    description:
      "Keep an unfinished incident form in this browser. Drafts are never uploaded automatically.",
  },
];

export function SettingsView() {
  const router = useRouter();
  const {
    user,
    isDemoSession,
    authConfigured,
    signOut,
    updateDisplayName,
  } = useAuth();
  const { preferences, setPreference } = usePreferences();
  const [editedName, setEditedName] = React.useState<string | null>(null);
  const displayName = editedName ?? user?.displayName ?? "";
  const [nameError, setNameError] = React.useState<string | null>(null);
  const [savingName, setSavingName] = React.useState(false);
  const [confirmGlobalSignOut, setConfirmGlobalSignOut] = React.useState(false);
  const [confirmReset, setConfirmReset] = React.useState(false);
  const [signingOut, setSigningOut] = React.useState(false);

  const handleSaveName = async (event: React.FormEvent) => {
    event.preventDefault();
    setNameError(null);
    const trimmed = displayName.trim();
    if (trimmed.length < 2) {
      setNameError("Enter a display name of at least 2 characters.");
      return;
    }
    if (trimmed.length > 80) {
      setNameError("Keep the display name under 80 characters.");
      return;
    }
    setSavingName(true);
    try {
      await updateDisplayName(trimmed);
      setEditedName(trimmed);
      toast.success("Profile updated", {
        description: isDemoSession
          ? "Saved in this browser's local demo session."
          : "Your Supabase profile metadata was updated.",
      });
    } catch (cause) {
      setNameError(
        cause instanceof Error ? cause.message : "The profile could not be saved.",
      );
    } finally {
      setSavingName(false);
    }
  };

  const handleSignOut = async (global: boolean) => {
    setSigningOut(true);
    try {
      await signOut({ global });
      toast.success(global ? "Signed out everywhere" : "Signed out");
      router.replace("/login");
    } catch (cause) {
      toast.error("Could not sign out", {
        description:
          cause instanceof Error ? cause.message : "Please try again.",
      });
    } finally {
      setSigningOut(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-up">
      <PageHeader
        eyebrow="Settings"
        title="Profile, privacy and sessions"
        description="Control how SHEPHERD behaves in this browser, review what is stored, and manage your sign-in session."
        actions={<MockDataBadge />}
      />

      <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <UserRound className="size-4 text-muted-foreground" />
                Profile
              </CardTitle>
              <CardDescription>
                This name is shown in the workspace and used for your avatar
                initials. It is not shared with trusted contacts automatically.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSaveName} className="space-y-4" noValidate>
                <div className="space-y-1.5">
                  <Label htmlFor="display-name">Display name</Label>
                  <Input
                    id="display-name"
                    value={displayName}
                    onChange={(event) => setEditedName(event.target.value)}
                    maxLength={80}
                    aria-invalid={Boolean(nameError)}
                    autoComplete="name"
                  />
                  {nameError ? (
                    <p className="text-xs text-destructive">{nameError}</p>
                  ) : (
                    <p className="text-[11px] text-muted-foreground">
                      Between 2 and 80 characters.
                    </p>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <Button
                    type="submit"
                    size="sm"
                    disabled={
                      savingName ||
                      displayName.trim() === (user?.displayName ?? "")
                    }
                  >
                    {savingName ? (
                      <LoaderCircle className="size-3.5 animate-spin" />
                    ) : (
                      <Save className="size-3.5" />
                    )}
                    {savingName ? "Saving…" : "Save profile"}
                  </Button>
                  <span className="text-[11px] text-muted-foreground">
                    Signed in as{" "}
                    <span className="font-medium text-foreground">
                      {user?.email ?? "—"}
                    </span>
                  </span>
                </div>
              </form>
            </CardContent>
          </Card>

          <Card id="privacy" className="scroll-mt-20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShieldCheck className="size-4 text-muted-foreground" />
                Privacy and data handling
              </CardTitle>
              <CardDescription>
                Plain-language summary of what this frontend does and does not do.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 text-sm leading-relaxed">
              <div className="flex items-start gap-3">
                <Lock className="mt-0.5 size-4 shrink-0 text-primary" />
                <div>
                  <p className="font-medium">Evidence stays private</p>
                  <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">
                    Uploaded evidence is stored in a private bucket by the Core
                    API. The web client never displays a public evidence URL and
                    never stores file bytes in the demo database.
                  </p>
                </div>
              </div>
              <Separator />
              <div className="flex items-start gap-3">
                <Fingerprint className="mt-0.5 size-4 shrink-0 text-primary" />
                <div>
                  <p className="font-medium">Hashes are consistency checks</p>
                  <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">
                    A matching SHA-256 shows byte-level consistency with the stored
                    reference file. It does not prove authorship, time or place,
                    and it is not a legal authenticity certificate.
                  </p>
                </div>
              </div>
              <Separator />
              <div className="flex items-start gap-3">
                <Sparkles className="mt-0.5 size-4 shrink-0 text-primary" />
                <div>
                  <p className="font-medium">AI output is informational</p>
                  <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">
                    ThreatLens classifications, OCR text and review-priority
                    scores may be inaccurate. They do not establish that an
                    incident occurred, identify an offender or predict harm. Every
                    result includes its limitations.
                  </p>
                </div>
              </div>
              <Separator />
              <div className="flex items-start gap-3">
                <BellOff className="mt-0.5 size-4 shrink-0 text-primary" />
                <div>
                  <p className="font-medium">SafeCircle notifications are simulated</p>
                  <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">
                    This prototype records check-in deadlines but does not send SMS
                    or email. Do not rely on it as an emergency alerting service.
                  </p>
                </div>
              </div>
              <Separator />
              <div className="flex items-start gap-3">
                <DatabaseZap className="mt-0.5 size-4 shrink-0 text-primary" />
                <div>
                  <p className="font-medium">Deletion and retention</p>
                  <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">
                    Deleting an incident removes its record and, under the API
                    cascade policy, associated evidence metadata, analyses and
                    reports. A trusted contact referenced by a safety session
                    cannot be removed until the session history allows it.
                  </p>
                </div>
              </div>
              <div className="rounded-lg border border-border bg-muted/25 px-3 py-2.5 text-[11px] leading-relaxed text-muted-foreground">
                SHEPHERD is not an emergency service, legal authority or a
                guarantee of safety. If you are in immediate danger, contact local
                emergency services.{" "}
                <Link
                  href="/threatlens"
                  className="font-medium text-primary underline-offset-4 hover:underline"
                >
                  Review the AI disclosure
                </Link>{" "}
                on ThreatLens for the full wording.
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Local preferences</CardTitle>
              <CardDescription>
                Stored only in this browser. They are not synced to your account.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {PREFERENCE_ROWS.map((row) => (
                <div
                  key={row.key}
                  className="flex items-start justify-between gap-4 rounded-lg border border-border p-3"
                >
                  <div>
                    <Label
                      htmlFor={`pref-${row.key}`}
                      className="cursor-pointer text-xs font-medium"
                    >
                      {row.title}
                    </Label>
                    <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">
                      {row.description}
                    </p>
                  </div>
                  <Switch
                    id={`pref-${row.key}`}
                    checked={preferences[row.key]}
                    onCheckedChange={(checked) =>
                      setPreference(row.key, checked)
                    }
                  />
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <KeyRound className="size-4 text-muted-foreground" />
                Account
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
                  Email
                </p>
                <p className="mt-0.5 break-all text-sm font-medium">
                  {user?.email ?? "—"}
                </p>
              </div>
              <div>
                <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
                  Session type
                </p>
                <div className="mt-1">
                  {isDemoSession ? (
                    <Badge
                      variant="outline"
                      className="border-[#e2d7bb] bg-[#fbf7ee] text-[#74500a]"
                    >
                      Local demo session
                    </Badge>
                  ) : (
                    <Badge
                      variant="outline"
                      className="border-[#c9e2d3] bg-[#f1f7f3] text-[#1a5c3d]"
                    >
                      Supabase authenticated
                    </Badge>
                  )}
                </div>
              </div>
              {!authConfigured ? (
                <Alert variant="warning">
                  <AlertTriangle />
                  <div>
                    <AlertTitle>Supabase is not configured</AlertTitle>
                    <AlertDescription>
                      Authentication runs in a labelled local demo mode. Add the
                      Supabase environment variables to enable real email sign-in.
                    </AlertDescription>
                  </div>
                </Alert>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MonitorSmartphone className="size-4 text-muted-foreground" />
                Sessions
              </CardTitle>
              <CardDescription>
                End this session, or revoke the Supabase refresh token everywhere.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button
                type="button"
                variant="outline"
                className="w-full justify-start"
                onClick={() => void handleSignOut(false)}
                disabled={signingOut}
              >
                <LogOut className="size-4" />
                Sign out
              </Button>
              <Button
                type="button"
                variant="outline"
                className="w-full justify-start"
                onClick={() => setConfirmGlobalSignOut(true)}
                disabled={signingOut}
              >
                <MonitorSmartphone className="size-4" />
                Sign out of all devices
              </Button>
              <p className="pt-1 text-[10px] leading-relaxed text-muted-foreground">
                {isDemoSession
                  ? "Demo sessions exist only in this browser, so “all devices” clears the same local session."
                  : "Global sign-out revokes refresh tokens through Supabase. Other devices may need to sign in again."}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Check className="size-4 text-muted-foreground" />
                Offline and install
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-[11px] leading-relaxed text-muted-foreground">
              <p>
                SHEPHERD can be installed from your browser menu and shows a
                dedicated offline page when the network is unavailable.
              </p>
              <p>
                Private API responses and evidence are never cached by the service
                worker. Incident drafts saved while offline stay in this browser
                and do not sync automatically.
              </p>
            </CardContent>
          </Card>

          {isMockApiEnabled ? (
            <Card className="border-[#e2d7bb] bg-[#fbf7ee]">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-[#6d5420]">
                  <DatabaseZap className="size-4" />
                  Demo data
                </CardTitle>
                <CardDescription className="text-[#6d5420]/80">
                  Reset the synthetic local database used by the isolated mock
                  adapter. This does not touch a real backend.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full border-[#e2d7bb] bg-white/60 text-[#6d5420] hover:bg-white"
                  onClick={() => setConfirmReset(true)}
                >
                  <DatabaseZap className="size-4" />
                  Reset demo data
                </Button>
              </CardContent>
            </Card>
          ) : null}
        </div>
      </div>

      <ConfirmDialog
        open={confirmGlobalSignOut}
        onOpenChange={setConfirmGlobalSignOut}
        title="Sign out of all devices?"
        description={
          <span>
            {isDemoSession
              ? "This clears the local demo session in this browser."
              : "Supabase will revoke the refresh tokens for this account. Other devices will need to sign in again."}{" "}
            Locally saved incident drafts remain in this browser.
          </span>
        }
        confirmLabel="Sign out everywhere"
        destructive
        onConfirm={async () => {
          await signOut({ global: true });
          router.replace("/login");
        }}
      />

      <ConfirmDialog
        open={confirmReset}
        onOpenChange={setConfirmReset}
        title="Reset the demo database?"
        description={
          <span>
            All synthetic incidents, evidence metadata, analyses, contacts,
            sessions and reports in this browser will be replaced with the
            original demo seed. This cannot be undone.
          </span>
        }
        confirmLabel="Reset demo data"
        destructive
        onConfirm={async () => {
          resetDatabase();
          toast.success("Demo data reset", {
            description: "Reloading with the original synthetic seed.",
          });
          window.setTimeout(() => window.location.reload(), 600);
        }}
      />
    </div>
  );
}
