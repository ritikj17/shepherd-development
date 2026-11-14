import { format, formatDistanceToNowStrict, isValid, parseISO } from "date-fns";

function toDate(value: string | Date): Date | null {
  const date = typeof value === "string" ? parseISO(value) : value;
  return isValid(date) ? date : null;
}

export function formatDateTime(value: string | Date | null | undefined): string {
  if (!value) return "—";
  const date = toDate(value);
  return date ? format(date, "d MMM yyyy, HH:mm") : "—";
}

export function formatDate(value: string | Date | null | undefined): string {
  if (!value) return "—";
  const date = toDate(value);
  return date ? format(date, "d MMM yyyy") : "—";
}

export function formatTime(value: string | Date | null | undefined): string {
  if (!value) return "—";
  const date = toDate(value);
  return date ? format(date, "HH:mm") : "—";
}

export function formatRelative(value: string | Date | null | undefined): string {
  if (!value) return "—";
  const date = toDate(value);
  if (!date) return "—";
  return `${formatDistanceToNowStrict(date)} ago`;
}

export function formatFuture(value: string | Date | null | undefined): string {
  if (!value) return "—";
  const date = toDate(value);
  if (!date) return "—";
  const diff = date.getTime() - Date.now();
  if (diff <= 0) return "deadline passed";
  return `in ${formatDistanceToNowStrict(date)}`;
}

export function formatBytes(bytes: number | null | undefined): string {
  if (bytes === null || bytes === undefined || Number.isNaN(bytes)) return "—";
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB"];
  let value = bytes / 1024;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  return `${value.toFixed(value >= 10 ? 0 : 1)} ${units[unitIndex]}`;
}

export function formatCountdown(deadline: string | Date): string {
  const date = toDate(deadline);
  if (!date) return "—";
  const diff = date.getTime() - Date.now();
  if (diff <= 0) return "Deadline passed";
  const totalMinutes = Math.floor(diff / 60000);
  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
  const minutes = totalMinutes % 60;
  if (days > 0) return `${days}d ${hours}h remaining`;
  if (hours > 0) return `${hours}h ${minutes}m remaining`;
  return `${minutes}m remaining`;
}

export function shortHash(hash: string | null | undefined, length = 10): string {
  if (!hash) return "—";
  return hash.length <= length * 2
    ? hash
    : `${hash.slice(0, length)}…${hash.slice(-length)}`;
}

export function initials(name: string | null | undefined): string {
  if (!name) return "S";
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((part) => part[0]?.toUpperCase() ?? "").join("") || "S";
}

export function pluralize(count: number, singular: string, plural?: string) {
  return `${count} ${count === 1 ? singular : (plural ?? `${singular}s`)}`;
}

export function toDateTimeLocalValue(value: Date = new Date()): string {
  const offset = value.getTimezoneOffset() * 60000;
  return new Date(value.getTime() - offset).toISOString().slice(0, 16);
}

export function fromDateTimeLocalValue(value: string): string {
  return new Date(value).toISOString();
}

export function truncate(value: string, max = 120): string {
  return value.length > max ? `${value.slice(0, max - 1).trimEnd()}…` : value;
}
