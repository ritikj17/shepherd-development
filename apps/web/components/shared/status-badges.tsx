import * as React from "react";

import { Badge } from "@/components/ui/badge";
import { categoryMeta } from "@/lib/utils/categories";
import { riskBand } from "@/lib/utils/risk";
import type {
  AnalysisStatus,
  EvidenceStorageStatus,
  IncidentCategory,
  IncidentStatus,
  RiskLevel,
  SafetySession,
  SafetySessionStatus,
} from "@/lib/types/api";
import { cn } from "@/lib/utils/cn";

type Tone = "success" | "warning" | "destructive" | "info" | "muted" | "default";

const DOT_TONES: Record<Tone, string> = {
  success: "bg-[#1c6b47]",
  warning: "bg-[#9a6100]",
  destructive: "bg-[#b3261e]",
  info: "bg-[#3c6495]",
  muted: "bg-muted-foreground/60",
  default: "bg-primary-foreground",
};

export function StatusBadge({
  tone = "muted",
  children,
  dot = true,
  className,
}: {
  tone?: Tone;
  children: React.ReactNode;
  dot?: boolean;
  className?: string;
}) {
  return (
    <Badge variant={tone} className={cn("gap-1.5", className)}>
      {dot ? (
        <span
          aria-hidden="true"
          className={cn("size-1.5 rounded-full", DOT_TONES[tone])}
        />
      ) : null}
      {children}
    </Badge>
  );
}

export function IncidentStatusBadge({
  status,
  className,
}: {
  status: IncidentStatus;
  className?: string;
}) {
  return status === "open" ? (
    <StatusBadge tone="success" className={className}>
      Open
    </StatusBadge>
  ) : (
    <StatusBadge tone="muted" className={className}>
      Archived
    </StatusBadge>
  );
}

const SESSION_TONE: Record<SafetySessionStatus, Tone> = {
  active: "info",
  checked_in: "success",
  expired: "warning",
  cancelled: "muted",
};

const SESSION_LABEL: Record<SafetySessionStatus, string> = {
  active: "Active",
  checked_in: "Checked in",
  expired: "Expired",
  cancelled: "Cancelled",
};

export function SafetyStatusBadge({
  status,
  className,
}: {
  status: SafetySessionStatus;
  className?: string;
}) {
  return (
    <StatusBadge tone={SESSION_TONE[status]} className={className}>
      {SESSION_LABEL[status]}
    </StatusBadge>
  );
}

export function displaySessionStatus(session: SafetySession): SafetySessionStatus {
  if (
    session.status === "active" &&
    Date.parse(session.checkin_deadline) <= Date.now()
  ) {
    return "expired";
  }
  return session.status;
}

export function AnalysisStatusBadge({
  status,
  className,
}: {
  status: AnalysisStatus;
  className?: string;
}) {
  return status === "completed" ? (
    <StatusBadge tone="success" className={className}>
      Completed
    </StatusBadge>
  ) : (
    <StatusBadge tone="destructive" className={className}>
      Failed
    </StatusBadge>
  );
}

export function EvidenceStatusBadge({
  status,
  className,
}: {
  status: EvidenceStorageStatus;
  className?: string;
}) {
  const tone: Tone =
    status === "stored" ? "success" : status === "pending" ? "warning" : "destructive";
  const label =
    status === "stored" ? "Stored" : status === "pending" ? "Pending" : "Failed";
  return (
    <StatusBadge tone={tone} className={className}>
      {label}
    </StatusBadge>
  );
}

export function CategoryBadge({
  category,
  className,
}: {
  category: IncidentCategory;
  className?: string;
}) {
  const meta = categoryMeta(category);
  return (
    <Badge
      variant="outline"
      className={cn("gap-1.5 font-medium", meta.badgeClassName, className)}
    >
      <span
        aria-hidden="true"
        className={cn("size-1.5 rounded-full", meta.dotClassName)}
      />
      {meta.label}
    </Badge>
  );
}

export function RiskBadge({
  level,
  className,
}: {
  level: RiskLevel;
  className?: string;
}) {
  const band = riskBand(level);
  return (
    <Badge variant="outline" className={cn(band.badgeClassName, className)}>
      {band.shortLabel}
    </Badge>
  );
}
