"use client";

import * as React from "react";
import Link from "next/link";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  AlertCircle,
  BellRing,
  CalendarClock,
  CheckCircle2,
  Clock3,
  Info,
  LoaderCircle,
  Mail,
  Phone,
  Plus,
  ShieldCheck,
  Trash2,
  UserPlus,
  Users,
} from "lucide-react";
import { Controller, useForm, useWatch } from "react-hook-form";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { EmptyState, ErrorState } from "@/components/shared/states";
import { ListSkeleton } from "@/components/shared/loading-states";
import { PageHeader } from "@/components/shared/page-header";
import { MockDataBadge } from "@/components/shared/demo-notices";
import { SafetyStatusBadge } from "@/components/shared/status-badges";
import {
  checkInToSession,
  createSafetySession,
  createTrustedContact,
  deleteTrustedContact,
  listIncidents,
  listSafetySessions,
  listTrustedContacts,
} from "@/lib/api";
import { errorMessage } from "@/lib/api/client";
import { isMockApiEnabled } from "@/lib/api/config";
import { useAsyncData } from "@/lib/hooks/use-async-data";
import { useCountdown } from "@/lib/hooks/use-countdown";
import type { SafetySession, TrustedContact } from "@/lib/types/api";
import { maskContactValue } from "@/lib/utils/hash";
import {
  formatDateTime,
  formatFuture,
  fromDateTimeLocalValue,
  toDateTimeLocalValue,
} from "@/lib/utils/format";
import {
  NONE_INCIDENT,
  safetySessionSchema,
  trustedContactSchema,
  type SafetySessionValues,
  type TrustedContactValues,
} from "@/lib/validation/safety";

const DEADLINE_PRESETS = [
  { label: "30 min", ms: 30 * 60_000 },
  { label: "1 hour", ms: 60 * 60_000 },
  { label: "4 hours", ms: 4 * 60 * 60_000 },
  { label: "24 hours", ms: 24 * 60 * 60_000 },
] as const;

function defaultDeadline(): string {
  return toDateTimeLocalValue(new Date(Date.now() + 60 * 60_000));
}

function ContactIcon({ method }: { method: TrustedContact["contact_method"] }) {
  return method === "email" ? (
    <Mail className="size-3.5" />
  ) : (
    <Phone className="size-3.5" />
  );
}

function SessionCountdown({ deadline }: { deadline: string }) {
  const { label, expired } = useCountdown(deadline);
  return (
    <span
      className={
        expired
          ? "inline-flex items-center gap-1 text-[11px] font-medium text-[#8a5a00]"
          : "inline-flex items-center gap-1 text-[11px] font-medium text-[#1f5b7a]"
      }
    >
      <Clock3 className="size-3" />
      {label}
    </span>
  );
}

export function SafeCircleView() {
  const contactsQuery = useAsyncData(() => listTrustedContacts(), "safe-contacts");
  const sessionsQuery = useAsyncData(() => listSafetySessions(), "safe-sessions");
  const incidentsQuery = useAsyncData(
    () => listIncidents({ limit: 100 }),
    "safe-incidents",
  );

  const [contactDialogOpen, setContactDialogOpen] = React.useState(false);
  const [pendingDelete, setPendingDelete] =
    React.useState<TrustedContact | null>(null);
  const [checkingInId, setCheckingInId] = React.useState<string | null>(null);
  const [sessionError, setSessionError] = React.useState<string | null>(null);
  const [now, setNow] = React.useState(() => Date.now());

  React.useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(interval);
  }, []);

  const contactForm = useForm<TrustedContactValues>({
    resolver: zodResolver(trustedContactSchema),
    defaultValues: {
      name: "",
      contact_method: "email",
      contact_value: "",
      consent_confirmed: false,
    },
  });
  const contactMethod = useWatch({
    control: contactForm.control,
    name: "contact_method",
  });

  const sessionForm = useForm<SafetySessionValues>({
    resolver: zodResolver(safetySessionSchema),
    defaultValues: {
      trusted_contact_id: "",
      incident_id: NONE_INCIDENT,
      checkin_deadline: defaultDeadline(),
      consent_confirmed: false,
    },
  });

  const contacts = React.useMemo(
    () => contactsQuery.data?.items ?? [],
    [contactsQuery.data],
  );
  const sessions = sessionsQuery.data?.items ?? [];
  const incidents = incidentsQuery.data?.items ?? [];
  const activeSession = sessions.find((session) => session.status === "active");

  React.useEffect(() => {
    if (contactDialogOpen) {
      contactForm.reset({
        name: "",
        contact_method: "email",
        contact_value: "",
        consent_confirmed: false,
      });
    }
  }, [contactDialogOpen, contactForm]);

  React.useEffect(() => {
    if (sessionForm.getValues("trusted_contact_id")) return;
    const first = contacts[0];
    if (first) sessionForm.setValue("trusted_contact_id", first.id);
  }, [contacts, sessionForm]);

  const onCreateContact = contactForm.handleSubmit(async (values) => {
    try {
      await createTrustedContact({
        name: values.name.trim(),
        contact_method: values.contact_method,
        contact_value: values.contact_value.trim(),
        consent_confirmed: true,
      });
      setContactDialogOpen(false);
      contactsQuery.refresh();
      toast.success("Trusted contact added", {
        description: isMockApiEnabled
          ? "Demo adapter: the contact was saved locally and no notification was sent."
          : "The contact is available for future check-in sessions.",
      });
    } catch (cause) {
      contactForm.setError("root", { message: errorMessage(cause) });
    }
  });

  const onCreateSession = sessionForm.handleSubmit(async (values) => {
    setSessionError(null);
    try {
      const session = await createSafetySession({
        trusted_contact_id: values.trusted_contact_id,
        incident_id:
          values.incident_id === NONE_INCIDENT ? null : values.incident_id,
        checkin_deadline: fromDateTimeLocalValue(values.checkin_deadline),
        consent_confirmed: true,
      });
      sessionForm.reset({
        trusted_contact_id: values.trusted_contact_id,
        incident_id: NONE_INCIDENT,
        checkin_deadline: defaultDeadline(),
        consent_confirmed: false,
      });
      sessionsQuery.refresh();
      toast.success("Safety session started", {
        description: isMockApiEnabled
          ? `Demo session recorded locally. No message was sent to your contact. Deadline ${formatDateTime(session.checkin_deadline)}.`
          : `Check-in deadline ${formatDateTime(session.checkin_deadline)}.`,
      });
    } catch (cause) {
      setSessionError(errorMessage(cause));
    }
  });

  const handleCheckIn = async (session: SafetySession) => {
    setCheckingInId(session.id);
    try {
      await checkInToSession(session.id);
      sessionsQuery.refresh();
      toast.success("Checked in", {
        description: isMockApiEnabled
          ? "Demo adapter: the session status changed locally. No notification was sent."
          : "The session is marked as checked in.",
      });
    } catch (cause) {
      toast.error("Could not check in", {
        description: errorMessage(cause),
      });
    } finally {
      setCheckingInId(null);
    }
  };

  const contactName = (id: string) =>
    contacts.find((contact) => contact.id === id)?.name ?? "Trusted contact";

  const incidentTitle = (id: string | null) =>
    id ? incidents.find((incident) => incident.id === id)?.title ?? null : null;

  return (
    <div className="space-y-6 animate-fade-up">
      <PageHeader
        eyebrow="SafeCircle"
        title="Trusted contacts and check-ins"
        description="Keep a short list of people you trust and record a check-in deadline before a situation where you may want someone to notice. Contacts are only used for the sessions you create."
        actions={
          <>
            <MockDataBadge />
            <Button
              type="button"
              size="sm"
              onClick={() => setContactDialogOpen(true)}
            >
              <UserPlus className="size-3.5" />
              Add contact
            </Button>
          </>
        }
      />

      <Alert variant="info">
        <BellRing />
        <div>
          <AlertTitle>Notifications are simulated in this build</AlertTitle>
          <AlertDescription>
            SHEPHERD records the session and its deadline. It does not send SMS or
            email in this prototype. Do not rely on SafeCircle as an emergency
            alerting service — contact emergency services or a person you trust
            directly when you are in immediate danger.
          </AlertDescription>
        </div>
      </Alert>

      {activeSession ? (
        <Alert variant="warning">
          <Clock3 />
          <div className="flex-1">
            <AlertTitle>An active check-in session is running</AlertTitle>
            <AlertDescription>
              Deadline {formatDateTime(activeSession.checkin_deadline)} (
              {formatFuture(activeSession.checkin_deadline)}). Check in before the
              deadline if you are safe. Sessions cannot be cancelled from the web
              client because the API contract has no cancel endpoint.
            </AlertDescription>
          </div>
        </Alert>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[380px_1fr]">
        <div className="space-y-4">
          <Card>
            <CardHeader className="flex-row items-start justify-between gap-2">
              <div>
                <CardTitle>Trusted contacts</CardTitle>
                <CardDescription>
                  {contacts.length === 0
                    ? "No contacts yet."
                    : `${contacts.length} on your list.`}
                </CardDescription>
              </div>
              <Users className="mt-0.5 size-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {contactsQuery.error ? (
                <ErrorState
                  title="Contacts could not be loaded"
                  message={contactsQuery.error}
                  onRetry={contactsQuery.refresh}
                />
              ) : contactsQuery.loading && !contactsQuery.data ? (
                <ListSkeleton rows={3} />
              ) : contacts.length === 0 ? (
                <EmptyState
                  icon={<Users className="size-5" />}
                  title="Add someone you trust"
                  description="A contact needs to agree before being listed. Their details are masked in this list."
                  action={
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => setContactDialogOpen(true)}
                    >
                      <UserPlus className="size-3.5" />
                      Add contact
                    </Button>
                  }
                  className="px-4 py-8"
                />
              ) : (
                <ul className="space-y-2">
                  {contacts.map((contact) => (
                    <li
                      key={contact.id}
                      className="flex items-start gap-3 rounded-lg border border-border px-3 py-2.5"
                    >
                      <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full border border-border bg-muted/50 text-muted-foreground">
                        <ContactIcon method={contact.contact_method} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">
                          {contact.name}
                        </p>
                        <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                          {contact.contact_method === "email" ? "Email" : "Phone"}{" "}
                          ·{" "}
                          {maskContactValue(
                            contact.contact_value,
                            contact.contact_method,
                          )}
                        </p>
                        <p className="mt-0.5 text-[10px] text-muted-foreground">
                          Consent recorded · added {formatDateTime(contact.created_at)}
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Remove ${contact.name}`}
                        onClick={() => setPendingDelete(contact)}
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Start a check-in session</CardTitle>
              <CardDescription>
                Choose a contact and a future deadline. Only the session record is
                stored.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {contacts.length === 0 ? (
                <p className="rounded-md border border-dashed border-border bg-muted/25 px-3 py-3 text-xs leading-relaxed text-muted-foreground">
                  Add a trusted contact first. A session must reference someone on
                  your list.
                </p>
              ) : (
                <form
                  onSubmit={onCreateSession}
                  className="space-y-4"
                  noValidate
                >
                  {sessionError ? (
                    <Alert variant="destructive">
                      <AlertCircle />
                      <div>
                        <AlertTitle>Session not started</AlertTitle>
                        <AlertDescription>{sessionError}</AlertDescription>
                      </div>
                    </Alert>
                  ) : null}

                  {sessionForm.formState.errors.root?.message ? (
                    <Alert variant="destructive">
                      <AlertCircle />
                      <div>
                        <AlertTitle>Session not started</AlertTitle>
                        <AlertDescription>
                          {sessionForm.formState.errors.root.message}
                        </AlertDescription>
                      </div>
                    </Alert>
                  ) : null}

                  <div className="space-y-1.5">
                    <Label htmlFor="session-contact">Trusted contact</Label>
                    <Controller
                      control={sessionForm.control}
                      name="trusted_contact_id"
                      render={({ field }) => (
                        <Select
                          value={field.value}
                          onValueChange={field.onChange}
                        >
                          <SelectTrigger id="session-contact">
                            <SelectValue placeholder="Choose a contact" />
                          </SelectTrigger>
                          <SelectContent>
                            {contacts.map((contact) => (
                              <SelectItem key={contact.id} value={contact.id}>
                                {contact.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    />
                    {sessionForm.formState.errors.trusted_contact_id ? (
                      <p className="text-xs text-destructive">
                        {sessionForm.formState.errors.trusted_contact_id.message}
                      </p>
                    ) : null}
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="session-incident">
                      Related incident{" "}
                      <span className="font-normal text-muted-foreground">
                        (optional)
                      </span>
                    </Label>
                    <Controller
                      control={sessionForm.control}
                      name="incident_id"
                      render={({ field }) => (
                        <Select
                          value={field.value}
                          onValueChange={field.onChange}
                        >
                          <SelectTrigger id="session-incident">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value={NONE_INCIDENT}>
                              No linked incident
                            </SelectItem>
                            {incidents.map((incident) => (
                              <SelectItem key={incident.id} value={incident.id}>
                                {incident.title}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="session-deadline">Check-in deadline</Label>
                    <div className="flex flex-wrap gap-1.5">
                      {DEADLINE_PRESETS.map((preset) => (
                        <Button
                          key={preset.label}
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            sessionForm.setValue(
                              "checkin_deadline",
                              toDateTimeLocalValue(
                                new Date(Date.now() + preset.ms),
                              ),
                              { shouldValidate: true },
                            )
                          }
                        >
                          {preset.label}
                        </Button>
                      ))}
                    </div>
                    <Input
                      id="session-deadline"
                      type="datetime-local"
                      min={toDateTimeLocalValue(new Date(now + 60_000))}
                      aria-invalid={Boolean(
                        sessionForm.formState.errors.checkin_deadline,
                      )}
                      {...sessionForm.register("checkin_deadline")}
                    />
                    {sessionForm.formState.errors.checkin_deadline ? (
                      <p className="text-xs text-destructive">
                        {sessionForm.formState.errors.checkin_deadline.message}
                      </p>
                    ) : (
                      <p className="flex items-center gap-1 text-[11px] text-muted-foreground">
                        <CalendarClock className="size-3" />
                        The deadline must be in the future.
                      </p>
                    )}
                  </div>

                  <div className="flex items-start gap-2.5 rounded-lg border border-border p-3">
                    <Controller
                      control={sessionForm.control}
                      name="consent_confirmed"
                      render={({ field }) => (
                        <Checkbox
                          id="session-consent"
                          checked={field.value}
                          onCheckedChange={(checked) =>
                            field.onChange(checked === true)
                          }
                          className="mt-0.5"
                        />
                      )}
                    />
                    <div>
                      <Label
                        htmlFor="session-consent"
                        className="cursor-pointer text-xs font-medium"
                      >
                        I consent to this check-in session
                      </Label>
                      <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">
                        I understand that the session records a deadline and that
                        this prototype does not send a real notification.
                      </p>
                      {sessionForm.formState.errors.consent_confirmed ? (
                        <p className="mt-1 text-xs text-destructive">
                          {sessionForm.formState.errors.consent_confirmed.message}
                        </p>
                      ) : null}
                    </div>
                  </div>

                  <Button
                    type="submit"
                    className="w-full"
                    disabled={sessionForm.formState.isSubmitting}
                  >
                    {sessionForm.formState.isSubmitting ? (
                      <LoaderCircle className="size-4 animate-spin" />
                    ) : (
                      <ShieldCheck className="size-4" />
                    )}
                    {sessionForm.formState.isSubmitting
                      ? "Starting…"
                      : "Start safety session"}
                  </Button>
                </form>
              )}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader className="flex-row flex-wrap items-center justify-between gap-2">
            <div>
              <CardTitle>Safety sessions</CardTitle>
              <CardDescription>
                Active sessions first. Expiry is evaluated from the deadline.
              </CardDescription>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={sessionsQuery.refresh}
              disabled={sessionsQuery.loading}
            >
              Refresh
            </Button>
          </CardHeader>
          <CardContent>
            {sessionsQuery.error ? (
              <ErrorState
                title="Safety sessions could not be loaded"
                message={sessionsQuery.error}
                onRetry={sessionsQuery.refresh}
              />
            ) : sessionsQuery.loading && !sessionsQuery.data ? (
              <ListSkeleton rows={4} />
            ) : sessions.length === 0 ? (
              <EmptyState
                icon={<ShieldCheck className="size-5" />}
                title="No safety sessions yet"
                description="Start a session with a deadline when you want a record of when someone should expect to hear from you."
              />
            ) : (
              <ul className="space-y-3">
                {sessions.map((session) => {
                  const linkedIncident = incidentTitle(session.incident_id);
                  const deadlinePassed =
                    Date.parse(session.checkin_deadline) <= now;
                  const canCheckIn =
                    session.status === "active" && !deadlinePassed;
                  return (
                    <li
                      key={session.id}
                      className="rounded-lg border border-border p-3.5"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-sm font-medium">
                            {contactName(session.trusted_contact_id)}
                          </p>
                          <p className="mt-0.5 text-[11px] text-muted-foreground">
                            Started {formatDateTime(session.created_at)}
                          </p>
                        </div>
                        <SafetyStatusBadge
                          status={
                            session.status === "active" && deadlinePassed
                              ? "expired"
                              : session.status
                          }
                        />
                      </div>

                      <div className="mt-3 grid gap-2 rounded-md border border-border bg-muted/25 px-3 py-2.5 text-[11px] sm:grid-cols-2">
                        <div>
                          <p className="text-[10px] font-medium uppercase tracking-[0.1em] text-muted-foreground">
                            Check-in deadline
                          </p>
                          <p className="mt-0.5 font-medium">
                            {formatDateTime(session.checkin_deadline)}
                          </p>
                          <p className="text-muted-foreground">
                            {formatFuture(session.checkin_deadline)}
                          </p>
                        </div>
                        <div>
                          <p className="text-[10px] font-medium uppercase tracking-[0.1em] text-muted-foreground">
                            Linked incident
                          </p>
                          <p className="mt-0.5 truncate font-medium">
                            {linkedIncident ?? "None"}
                          </p>
                          {session.incident_id ? (
                            <Link
                              href={`/incidents/${session.incident_id}`}
                              className="text-primary underline-offset-4 hover:underline"
                            >
                              Open record
                            </Link>
                          ) : null}
                        </div>
                      </div>

                      <div className="mt-3 flex flex-wrap items-center gap-3">
                        {session.status === "active" && !deadlinePassed ? (
                          <SessionCountdown
                            deadline={session.checkin_deadline}
                          />
                        ) : null}
                        {canCheckIn ? (
                          <Button
                            type="button"
                            size="sm"
                            onClick={() => void handleCheckIn(session)}
                            disabled={checkingInId === session.id}
                          >
                            {checkingInId === session.id ? (
                              <LoaderCircle className="size-3.5 animate-spin" />
                            ) : (
                              <CheckCircle2 className="size-3.5" />
                            )}
                            {checkingInId === session.id
                              ? "Checking in…"
                              : "I’m safe — check in"}
                          </Button>
                        ) : null}
                        {session.status === "checked_in" ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-[#1c6b47]">
                            <CheckCircle2 className="size-3.5" />
                            Checked in{" "}
                            {session.checked_in_at
                              ? formatDateTime(session.checked_in_at)
                              : ""}
                          </span>
                        ) : null}
                        {session.status === "active" && deadlinePassed ? (
                          <span className="text-[11px] text-[#8a5a00]">
                            The deadline has passed. The API marks this session
                            expired.
                          </span>
                        ) : null}
                        {session.status === "cancelled" ? (
                          <span className="text-[11px] text-muted-foreground">
                            Cancelled{" "}
                            {session.cancelled_at
                              ? formatDateTime(session.cancelled_at)
                              : ""}
                          </span>
                        ) : null}
                        {session.status === "expired" ? (
                          <span className="text-[11px] text-[#8a5a00]">
                            No check-in was recorded before the deadline.
                          </span>
                        ) : null}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}

            <div className="mt-4 flex items-start gap-2 rounded-lg border border-border bg-muted/25 px-3 py-2.5 text-[11px] leading-relaxed text-muted-foreground">
              <Info className="mt-0.5 size-3.5 shrink-0" />
              <p>
                There is no cancel control because the locked API contract does not
                define a cancel endpoint. Cancelled sessions may still appear in
                history if the backend records them.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Dialog open={contactDialogOpen} onOpenChange={setContactDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add a trusted contact</DialogTitle>
            <DialogDescription>
              Only add someone who has agreed to be listed. Their contact detail is
              stored for future check-in sessions and masked in this list.
            </DialogDescription>
          </DialogHeader>

          <form
            onSubmit={onCreateContact}
            className="space-y-4"
            noValidate
          >
            {contactForm.formState.errors.root?.message ? (
              <Alert variant="destructive">
                <AlertCircle />
                <div>
                  <AlertTitle>Contact not added</AlertTitle>
                  <AlertDescription>
                    {contactForm.formState.errors.root.message}
                  </AlertDescription>
                </div>
              </Alert>
            ) : null}

            <div className="space-y-1.5">
              <Label htmlFor="contact-name">Name</Label>
              <Input
                id="contact-name"
                placeholder="For example: Meera Kapoor"
                aria-invalid={Boolean(contactForm.formState.errors.name)}
                {...contactForm.register("name")}
              />
              {contactForm.formState.errors.name ? (
                <p className="text-xs text-destructive">
                  {contactForm.formState.errors.name.message}
                </p>
              ) : null}
            </div>

            <div className="grid gap-4 sm:grid-cols-[150px_1fr]">
              <div className="space-y-1.5">
                <Label htmlFor="contact-method">Method</Label>
                <Controller
                  control={contactForm.control}
                  name="contact_method"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger id="contact-method">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="email">Email</SelectItem>
                        <SelectItem value="phone">Phone</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="contact-value">
                  {contactMethod === "email" ? "Email address" : "Phone number"}
                </Label>
                <Input
                  id="contact-value"
                  type={contactMethod === "email" ? "email" : "tel"}
                  placeholder={
                    contactMethod === "email"
                      ? "name@example.test"
                      : "+1 555 0100"
                  }
                  aria-invalid={Boolean(
                    contactForm.formState.errors.contact_value,
                  )}
                  {...contactForm.register("contact_value")}
                />
                {contactForm.formState.errors.contact_value ? (
                  <p className="text-xs text-destructive">
                    {contactForm.formState.errors.contact_value.message}
                  </p>
                ) : null}
              </div>
            </div>

            <div className="flex items-start gap-2.5 rounded-lg border border-border p-3">
              <Controller
                control={contactForm.control}
                name="consent_confirmed"
                render={({ field }) => (
                  <Checkbox
                    id="contact-consent"
                    checked={field.value}
                    onCheckedChange={(checked) =>
                      field.onChange(checked === true)
                    }
                    className="mt-0.5"
                  />
                )}
              />
              <div>
                <Label
                  htmlFor="contact-consent"
                  className="cursor-pointer text-xs font-medium"
                >
                  This person has agreed to be listed
                </Label>
                <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">
                  You are responsible for confirming consent. SHEPHERD does not
                  contact them on your behalf in this prototype.
                </p>
                {contactForm.formState.errors.consent_confirmed ? (
                  <p className="mt-1 text-xs text-destructive">
                    {contactForm.formState.errors.consent_confirmed.message}
                  </p>
                ) : null}
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setContactDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={contactForm.formState.isSubmitting}
              >
                {contactForm.formState.isSubmitting ? (
                  <LoaderCircle className="size-4 animate-spin" />
                ) : (
                  <Plus className="size-4" />
                )}
                {contactForm.formState.isSubmitting ? "Adding…" : "Add contact"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        onOpenChange={(open) => {
          if (!open) setPendingDelete(null);
        }}
        title="Remove this trusted contact?"
        description={
          <span>
            <span className="font-medium text-foreground">
              {pendingDelete?.name}
            </span>{" "}
            will be removed from your list. Historical safety sessions are
            retained. A contact referenced by a session cannot be removed.
          </span>
        }
        confirmLabel="Remove contact"
        destructive
        onConfirm={async () => {
          if (!pendingDelete) return;
          await deleteTrustedContact(pendingDelete.id);
          contactsQuery.refresh();
          toast.success("Trusted contact removed");
        }}
      />
    </div>
  );
}
