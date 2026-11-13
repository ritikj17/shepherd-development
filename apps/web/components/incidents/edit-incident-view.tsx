"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/shared/page-header";
import { ErrorState } from "@/components/shared/states";
import { IncidentForm } from "@/components/incidents/incident-form";
import { getIncident } from "@/lib/api";
import { useAsyncData } from "@/lib/hooks/use-async-data";

export function EditIncidentView() {
  const params = useParams<{ id: string }>();
  const incidentId = params?.id ?? "";
  const { data, error, loading, refresh } = useAsyncData(
    () => getIncident(incidentId),
    `edit-incident-${incidentId}`,
    Boolean(incidentId),
  );

  if (loading && !data) {
    return (
      <div className="mx-auto max-w-3xl space-y-4">
        <div className="h-8 w-64 animate-pulse rounded bg-muted" />
        <div className="h-96 w-full animate-pulse rounded-xl bg-muted" />
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="mx-auto max-w-3xl space-y-4">
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

  return (
    <div className="mx-auto max-w-3xl space-y-6 animate-fade-up">
      <PageHeader
        eyebrow="Edit incident"
        title={data.title}
        description="Changes are validated and saved to the Core API. Editing a record does not modify original evidence files."
      />
      <IncidentForm mode="edit" incident={data} />
    </div>
  );
}
