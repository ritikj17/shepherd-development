"use client";

import * as React from "react";
import Link from "next/link";
import {
  Archive,
  ArchiveRestore,
  ChevronLeft,
  ChevronRight,
  FileText,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
} from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { EmptyState, ErrorState } from "@/components/shared/states";
import { ListSkeleton } from "@/components/shared/loading-states";
import { PageHeader } from "@/components/shared/page-header";
import {
  CategoryBadge,
  IncidentStatusBadge,
} from "@/components/shared/status-badges";
import { deleteIncident, listIncidents, updateIncident } from "@/lib/api";
import { errorMessage } from "@/lib/api/client";
import { useAsyncData } from "@/lib/hooks/use-async-data";
import { usePreferences } from "@/lib/preferences";
import type { Incident, IncidentCategory, IncidentStatus } from "@/lib/types/api";
import { CATEGORY_OPTIONS } from "@/lib/utils/categories";
import { formatDateTime, formatRelative, pluralize } from "@/lib/utils/format";

const PAGE_SIZE = 8;

export function IncidentsView() {
  const { preferences } = usePreferences();
  const { data, error, loading, refresh } = useAsyncData(
    () => listIncidents({ limit: 100 }),
    "incidents",
  );

  const [query, setQuery] = React.useState("");
  const [category, setCategory] = React.useState<IncidentCategory | "all">("all");
  const [status, setStatus] = React.useState<IncidentStatus | "all">("all");
  const [page, setPage] = React.useState(0);
  const [pendingDelete, setPendingDelete] = React.useState<Incident | null>(null);
  const [busyId, setBusyId] = React.useState<string | null>(null);

  const filtered = React.useMemo(() => {
    const incidents = data?.items ?? [];
    const normalizedQuery = query.trim().toLowerCase();
    return incidents.filter((incident) => {
      if (category !== "all" && incident.category !== category) return false;
      if (status !== "all" && incident.status !== status) return false;
      if (!normalizedQuery) return true;
      return (
        incident.title.toLowerCase().includes(normalizedQuery) ||
        incident.description.toLowerCase().includes(normalizedQuery) ||
        (incident.location_description ?? "")
          .toLowerCase()
          .includes(normalizedQuery)
      );
    });
  }, [data, query, category, status]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages - 1);
  const visible = filtered.slice(
    safePage * PAGE_SIZE,
    safePage * PAGE_SIZE + PAGE_SIZE,
  );
  const filtersActive =
    query.trim().length > 0 || category !== "all" || status !== "all";

  const clearFilters = () => {
    setQuery("");
    setCategory("all");
    setStatus("all");
    setPage(0);
  };

  const handleArchiveToggle = async (incident: Incident) => {
    setBusyId(incident.id);
    const nextStatus: IncidentStatus =
      incident.status === "open" ? "archived" : "open";
    try {
      await updateIncident(incident.id, { status: nextStatus });
      toast.success(
        nextStatus === "archived" ? "Incident archived" : "Incident reopened",
      );
      refresh();
    } catch (cause) {
      toast.error("Could not update the incident", {
        description: errorMessage(cause),
      });
    } finally {
      setBusyId(null);
    }
  };

  const performDelete = async (incident: Incident) => {
    await deleteIncident(incident.id);
    toast.success("Incident deleted", {
      description:
        "Associated evidence metadata and analyses were removed by the API cascade policy.",
    });
    refresh();
  };

  const requestDelete = (incident: Incident) => {
    if (preferences.confirmBeforeDelete) {
      setPendingDelete(incident);
    } else {
      void performDelete(incident).catch((cause) =>
        toast.error("Could not delete the incident", {
          description: errorMessage(cause),
        }),
      );
    }
  };

  return (
    <div className="space-y-6 animate-fade-up">
      <PageHeader
        eyebrow="Incidents"
        title="Incident records"
        description="A chronological, user-controlled record of what happened. Edit, archive or remove records at any time."
        actions={
          <Button asChild>
            <Link href="/incidents/new">
              <Plus className="size-4" />
              New incident
            </Link>
          </Button>
        }
      />

      <Card>
        <CardContent className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-[1fr_190px_160px_auto] lg:items-center">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setPage(0);
              }}
              placeholder="Search titles, descriptions or locations"
              className="pl-9"
              aria-label="Search incidents"
            />
            {query ? (
              <button
                type="button"
                onClick={() => {
                  setQuery("");
                  setPage(0);
                }}
                className="absolute right-2 top-1/2 -translate-y-1/2 cursor-pointer rounded-md p-1 text-muted-foreground hover:bg-muted"
                aria-label="Clear search"
              >
                <X className="size-3.5" />
              </button>
            ) : null}
          </div>

          <Select
            value={category}
            onValueChange={(value) => {
              setCategory(value as IncidentCategory | "all");
              setPage(0);
            }}
          >
            <SelectTrigger aria-label="Filter by category">
              <SelectValue placeholder="All categories" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All categories</SelectItem>
              {CATEGORY_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={status}
            onValueChange={(value) => {
              setStatus(value as IncidentStatus | "all");
              setPage(0);
            }}
          >
            <SelectTrigger aria-label="Filter by status">
              <SelectValue placeholder="All statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="open">Open</SelectItem>
              <SelectItem value="archived">Archived</SelectItem>
            </SelectContent>
          </Select>

          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={clearFilters}
            disabled={!filtersActive}
            className="justify-self-start lg:justify-self-end"
          >
            Clear filters
          </Button>
        </CardContent>
      </Card>

      {error ? (
        <ErrorState
          title="Incidents could not be loaded"
          message={error}
          onRetry={refresh}
        />
      ) : loading && !data ? (
        <Card>
          <CardContent className="p-5">
            <ListSkeleton rows={6} />
          </CardContent>
        </Card>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<FileText className="size-5" />}
          title={
            filtersActive ? "No incidents match these filters" : "No incidents yet"
          }
          description={
            filtersActive
              ? "Try a different search term or clear the filters to see all of your records."
              : "Create your first incident to begin a chronological record. Evidence and analysis can be added afterwards."
          }
          action={
            filtersActive ? (
              <Button variant="outline" size="sm" onClick={clearFilters}>
                Clear filters
              </Button>
            ) : (
              <Button asChild size="sm">
                <Link href="/incidents/new">Create an incident</Link>
              </Button>
            )
          }
        />
      ) : (
        <Card>
          <CardHeader className="flex-row items-center justify-between gap-3 pb-2">
            <p className="text-xs text-muted-foreground">
              Showing{" "}
              <span className="font-medium text-foreground">
                {safePage * PAGE_SIZE + 1}–
                {Math.min((safePage + 1) * PAGE_SIZE, filtered.length)}
              </span>{" "}
              of {pluralize(filtered.length, "incident")}
              {filtersActive ? " after filters" : ""}
            </p>
            {data && data.total > filtered.length ? (
              <p className="text-[11px] text-muted-foreground">
                Loaded {data.items.length} of {data.total}
              </p>
            ) : null}
          </CardHeader>
          <CardContent className="p-0">
            {/* Desktop table */}
            <div className="hidden md:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-5">Incident</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Occurred</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Updated</TableHead>
                    <TableHead className="pr-5 text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visible.map((incident) => (
                    <TableRow key={incident.id}>
                      <TableCell className="max-w-[320px] pl-5">
                        <Link
                          href={`/incidents/${incident.id}`}
                          className="group block"
                        >
                          <span className="block truncate text-sm font-medium group-hover:text-primary">
                            {incident.title}
                          </span>
                          <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                            {incident.location_description ||
                              incident.description}
                          </span>
                        </Link>
                      </TableCell>
                      <TableCell>
                        <CategoryBadge category={incident.category} />
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                        {formatDateTime(incident.occurred_at)}
                      </TableCell>
                      <TableCell>
                        <IncidentStatusBadge status={incident.status} />
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                        {formatRelative(incident.updated_at)}
                      </TableCell>
                      <TableCell className="pr-5 text-right">
                        <IncidentActions
                          incident={incident}
                          busy={busyId === incident.id}
                          onArchiveToggle={() => void handleArchiveToggle(incident)}
                          onDelete={() => requestDelete(incident)}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Mobile cards */}
            <ul className="divide-y divide-border md:hidden">
              {visible.map((incident) => (
                <li key={incident.id} className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <Link
                      href={`/incidents/${incident.id}`}
                      className="min-w-0 flex-1"
                    >
                      <p className="text-sm font-medium">{incident.title}</p>
                      <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                        {incident.description}
                      </p>
                    </Link>
                    <IncidentActions
                      incident={incident}
                      busy={busyId === incident.id}
                      onArchiveToggle={() => void handleArchiveToggle(incident)}
                      onDelete={() => requestDelete(incident)}
                    />
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <CategoryBadge category={incident.category} />
                    <IncidentStatusBadge status={incident.status} />
                    <span className="text-[11px] text-muted-foreground">
                      {formatDateTime(incident.occurred_at)}
                    </span>
                  </div>
                </li>
              ))}
            </ul>

            {totalPages > 1 ? (
              <div className="flex items-center justify-between border-t border-border px-4 py-3">
                <p className="text-xs text-muted-foreground">
                  Page {safePage + 1} of {totalPages}
                </p>
                <div className="flex items-center gap-1">
                  <Button
                    variant="outline"
                    size="icon-sm"
                    disabled={safePage === 0}
                    onClick={() => setPage((current) => Math.max(0, current - 1))}
                    aria-label="Previous page"
                  >
                    <ChevronLeft className="size-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon-sm"
                    disabled={safePage >= totalPages - 1}
                    onClick={() =>
                      setPage((current) => Math.min(totalPages - 1, current + 1))
                    }
                    aria-label="Next page"
                  >
                    <ChevronRight className="size-4" />
                  </Button>
                </div>
              </div>
            ) : null}
          </CardContent>
        </Card>
      )}

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        onOpenChange={(open) => {
          if (!open) setPendingDelete(null);
        }}
        title="Delete this incident?"
        description={
          <span>
            <span className="font-medium text-foreground">
              {pendingDelete?.title}
            </span>{" "}
            will be permanently removed. The API cascade policy also removes
            associated evidence metadata, analyses and report records. This
            cannot be undone.
          </span>
        }
        confirmLabel="Delete incident"
        destructive
        onConfirm={async () => {
          if (pendingDelete) await performDelete(pendingDelete);
        }}
      />
    </div>
  );
}

function IncidentActions({
  incident,
  busy,
  onArchiveToggle,
  onDelete,
}: {
  incident: Incident;
  busy: boolean;
  onArchiveToggle: () => void;
  onDelete: () => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={`Actions for ${incident.title}`}
          disabled={busy}
        >
          <MoreHorizontal className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem asChild>
          <Link href={`/incidents/${incident.id}`}>
            <FileText />
            View details
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href={`/incidents/${incident.id}/edit`}>
            <Pencil />
            Edit
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={onArchiveToggle}>
          {incident.status === "open" ? <Archive /> : <ArchiveRestore />}
          {incident.status === "open" ? "Archive" : "Reopen"}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onSelect={onDelete}>
          <Trash2 />
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
