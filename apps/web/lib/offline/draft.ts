import type { IncidentCategory } from "@/lib/types/api";

export interface IncidentDraft {
  title: string;
  description: string;
  category: IncidentCategory;
  occurred_at: string;
  location_description: string;
  savedAt: string;
}

const DRAFT_KEY = "shepherd.incident.draft.v1";

export function saveIncidentDraft(
  draft: Omit<IncidentDraft, "savedAt">,
): IncidentDraft | null {
  if (typeof window === "undefined") return null;
  const payload: IncidentDraft = {
    ...draft,
    savedAt: new Date().toISOString(),
  };
  try {
    window.localStorage.setItem(DRAFT_KEY, JSON.stringify(payload));
    return payload;
  } catch {
    return null;
  }
}

export function readIncidentDraft(): IncidentDraft | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as IncidentDraft;
    if (!parsed?.title && !parsed?.description) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function clearIncidentDraft(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(DRAFT_KEY);
  } catch {
    // Ignore storage failures.
  }
}
