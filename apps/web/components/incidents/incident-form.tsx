"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  AlertCircle,
  CalendarClock,
  CloudOff,
  LoaderCircle,
  Save,
  Undo2,
  X,
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { createIncident, updateIncident } from "@/lib/api";
import { errorMessage } from "@/lib/api/client";
import { useOnlineStatus } from "@/lib/hooks/use-online-status";
import {
  clearIncidentDraft,
  readIncidentDraft,
  saveIncidentDraft,
  type IncidentDraft,
} from "@/lib/offline/draft";
import { usePreferences } from "@/lib/preferences";
import type { Incident } from "@/lib/types/api";
import { CATEGORY_OPTIONS } from "@/lib/utils/categories";
import {
  formatDateTime,
  fromDateTimeLocalValue,
  toDateTimeLocalValue,
} from "@/lib/utils/format";
import {
  incidentFormSchema,
  type IncidentFormValues,
} from "@/lib/validation/incident";

export function IncidentForm({
  mode,
  incident,
}: {
  mode: "create" | "edit";
  incident?: Incident;
}) {
  const router = useRouter();
  const online = useOnlineStatus();
  const { preferences } = usePreferences();
  const [formError, setFormError] = React.useState<string | null>(null);
  const [offlineSaved, setOfflineSaved] = React.useState(false);
  const [existingDraft, setExistingDraft] = React.useState<IncidentDraft | null>(
    null,
  );
  const [draftSavedAt, setDraftSavedAt] = React.useState<string | null>(null);

  const defaultValues: IncidentFormValues = React.useMemo(
    () => ({
      title: incident?.title ?? "",
      description: incident?.description ?? "",
      category: incident?.category ?? "general_harassment",
      occurred_at: incident
        ? toDateTimeLocalValue(new Date(incident.occurred_at))
        : toDateTimeLocalValue(new Date()),
      location_description: incident?.location_description ?? "",
    }),
    [incident],
  );

  const form = useForm<IncidentFormValues>({
    resolver: zodResolver(incidentFormSchema),
    defaultValues,
  });

  const watchedValues = useWatch({ control: form.control });

  React.useEffect(() => {
    if (mode !== "create") return;
    const draft = readIncidentDraft();
    if (draft && (draft.title.trim() || draft.description.trim())) {
      // The draft lives in localStorage and is read after mount.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setExistingDraft(draft);
    }
  }, [mode]);

  React.useEffect(() => {
    if (mode !== "create" || !preferences.draftAutosave) return;

    const timer = window.setTimeout(() => {
      const values = form.getValues();
      if (!values.title.trim() && !values.description.trim()) return;
      const saved = saveIncidentDraft({
        title: values.title,
        description: values.description,
        category: values.category,
        occurred_at: values.occurred_at,
        location_description: values.location_description ?? "",
      });
      if (saved) setDraftSavedAt(saved.savedAt);
    }, 900);

    return () => window.clearTimeout(timer);
  }, [watchedValues, mode, preferences.draftAutosave, form]);

  const restoreDraft = () => {
    if (!existingDraft) return;
    form.reset({
      title: existingDraft.title,
      description: existingDraft.description,
      category: existingDraft.category,
      occurred_at: existingDraft.occurred_at,
      location_description: existingDraft.location_description,
    });
    setExistingDraft(null);
    toast.success("Local draft restored", {
      description: "Nothing has been uploaded yet.",
    });
  };

  const discardDraft = () => {
    clearIncidentDraft();
    setExistingDraft(null);
    setDraftSavedAt(null);
    toast.success("Local draft discarded");
  };

  const onSubmit = form.handleSubmit(async (values) => {
    setFormError(null);
    setOfflineSaved(false);

    if (!online) {
      saveIncidentDraft({
        title: values.title,
        description: values.description,
        category: values.category,
        occurred_at: values.occurred_at,
        location_description: values.location_description ?? "",
      });
      setOfflineSaved(true);
      return;
    }

    const payload = {
      title: values.title,
      description: values.description,
      category: values.category,
      occurred_at: fromDateTimeLocalValue(values.occurred_at),
      location_description: values.location_description?.trim() || null,
    };

    try {
      if (mode === "create") {
        const created = await createIncident(payload);
        clearIncidentDraft();
        toast.success("Incident recorded", {
          description: "You can now attach evidence and request analysis.",
        });
        router.push(`/incidents/${created.id}`);
      } else if (incident) {
        await updateIncident(incident.id, payload);
        toast.success("Incident updated");
        router.push(`/incidents/${incident.id}`);
      }
    } catch (cause) {
      setFormError(errorMessage(cause));
    }
  });

  const titleLength = watchedValues.title?.length ?? 0;
  const descriptionLength = watchedValues.description?.length ?? 0;
  const isSubmitting = form.formState.isSubmitting;

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      {existingDraft ? (
        <Alert variant="warning">
          <Undo2 />
          <div className="flex-1">
            <AlertTitle>Local draft found</AlertTitle>
            <AlertDescription>
              Saved {formatDateTime(existingDraft.savedAt)} in this browser. It
              has not been uploaded. Restore it or discard it before continuing.
            </AlertDescription>
            <div className="mt-2 flex flex-wrap gap-2">
              <Button type="button" size="sm" variant="outline" onClick={restoreDraft}>
                Restore draft
              </Button>
              <Button type="button" size="sm" variant="ghost" onClick={discardDraft}>
                Discard
              </Button>
            </div>
          </div>
        </Alert>
      ) : null}

      {!online ? (
        <Alert variant="warning">
          <CloudOff />
          <div>
            <AlertTitle>You are offline</AlertTitle>
            <AlertDescription>
              This form can still be filled in. Submitting while offline saves a
              local draft only — it is not uploaded and does not sync
              automatically.
            </AlertDescription>
          </div>
        </Alert>
      ) : null}

      {offlineSaved ? (
        <Alert variant="warning">
          <CloudOff />
          <div className="flex-1">
            <AlertTitle>Saved locally — not uploaded</AlertTitle>
            <AlertDescription>
              Reconnect, then submit this form explicitly to create the incident
              in your workspace.
            </AlertDescription>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="mt-2"
              onClick={() => setOfflineSaved(false)}
            >
              Keep editing
            </Button>
          </div>
        </Alert>
      ) : null}

      {formError ? (
        <Alert variant="destructive">
          <AlertCircle />
          <div>
            <AlertTitle>Could not save the incident</AlertTitle>
            <AlertDescription>{formError}</AlertDescription>
          </div>
        </Alert>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Incident details</CardTitle>
          <CardDescription>
            Write a clear, factual record in your own words. You can edit this
            later.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-3">
              <Label htmlFor="title">Title</Label>
              <span className="text-[11px] tabular-nums text-muted-foreground">
                {titleLength}/120
              </span>
            </div>
            <Input
              id="title"
              placeholder="For example: Repeated messages from an unknown account"
              aria-invalid={Boolean(form.formState.errors.title)}
              {...form.register("title")}
            />
            {form.formState.errors.title ? (
              <p className="text-xs text-destructive">
                {form.formState.errors.title.message}
              </p>
            ) : null}
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-3">
              <Label htmlFor="description">Description</Label>
              <span className="text-[11px] tabular-nums text-muted-foreground">
                {descriptionLength}/5000
              </span>
            </div>
            <Textarea
              id="description"
              placeholder="What happened, in your own words? Include context that matters to you."
              className="min-h-40"
              aria-invalid={Boolean(form.formState.errors.description)}
              {...form.register("description")}
            />
            {form.formState.errors.description ? (
              <p className="text-xs text-destructive">
                {form.formState.errors.description.message}
              </p>
            ) : (
              <p className="text-[11px] leading-relaxed text-muted-foreground">
                This text stays in your workspace. It is only sent for analysis
                when you explicitly request it.
              </p>
            )}
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="category">Category</Label>
              <Controller
                control={form.control}
                name="category"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger id="category" aria-invalid={Boolean(form.formState.errors.category)}>
                      <SelectValue placeholder="Choose a category" />
                    </SelectTrigger>
                    <SelectContent>
                      {CATEGORY_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              <p className="text-[11px] leading-relaxed text-muted-foreground">
                {
                  CATEGORY_OPTIONS.find(
                    (option) => option.value === watchedValues.category,
                  )?.description
                }
              </p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="occurred_at">When did it happen?</Label>
              <Input
                id="occurred_at"
                type="datetime-local"
                max={toDateTimeLocalValue(new Date())}
                aria-invalid={Boolean(form.formState.errors.occurred_at)}
                {...form.register("occurred_at")}
              />
              {form.formState.errors.occurred_at ? (
                <p className="text-xs text-destructive">
                  {form.formState.errors.occurred_at.message}
                </p>
              ) : (
                <p className="flex items-center gap-1 text-[11px] text-muted-foreground">
                  <CalendarClock className="size-3" />
                  Stored as an ISO timestamp in UTC.
                </p>
              )}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="location_description">
              Location description{" "}
              <span className="font-normal text-muted-foreground">(optional)</span>
            </Label>
            <Input
              id="location_description"
              placeholder="For example: near the east station exit"
              aria-invalid={Boolean(form.formState.errors.location_description)}
              {...form.register("location_description")}
            />
            {form.formState.errors.location_description ? (
              <p className="text-xs text-destructive">
                {form.formState.errors.location_description.message}
              </p>
            ) : (
              <p className="text-[11px] leading-relaxed text-muted-foreground">
                A description you choose to provide. SHEPHERD does not collect
                device location.
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-[11px] leading-relaxed text-muted-foreground">
          {mode === "create" && draftSavedAt
            ? `Draft saved locally at ${new Date(draftSavedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} · not uploaded`
            : "Fields are validated before anything is sent to the API."}
        </p>
        <div className="flex items-center gap-2">
          <Button asChild variant="ghost">
            <Link href={mode === "edit" && incident ? `/incidents/${incident.id}` : "/incidents"}>
              Cancel
            </Link>
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? (
              <LoaderCircle className="size-4 animate-spin" />
            ) : (
              <Save className="size-4" />
            )}
            {isSubmitting
              ? "Saving…"
              : mode === "create"
                ? "Save incident"
                : "Save changes"}
          </Button>
        </div>
      </div>

      {mode === "create" && draftSavedAt ? (
        <button
          type="button"
          onClick={discardDraft}
          className="mx-auto flex cursor-pointer items-center gap-1 text-[11px] text-muted-foreground underline-offset-4 hover:underline"
        >
          <X className="size-3" />
          Clear local draft
        </button>
      ) : null}
    </form>
  );
}
