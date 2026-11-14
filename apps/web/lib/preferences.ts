"use client";

import * as React from "react";

export interface Preferences {
  disclosuresExpanded: boolean;
  confirmBeforeDelete: boolean;
  draftAutosave: boolean;
}

const STORAGE_KEY = "shepherd.preferences.v1";

const DEFAULT_PREFERENCES: Preferences = {
  disclosuresExpanded: true,
  confirmBeforeDelete: true,
  draftAutosave: true,
};

let cached: Preferences | null = null;
const listeners = new Set<() => void>();

function read(): Preferences {
  if (typeof window === "undefined") return DEFAULT_PREFERENCES;
  if (cached) return cached;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      cached = DEFAULT_PREFERENCES;
      return cached;
    }
    const parsed = JSON.parse(raw) as Partial<Preferences>;
    cached = { ...DEFAULT_PREFERENCES, ...parsed };
    return cached;
  } catch {
    cached = DEFAULT_PREFERENCES;
    return cached;
  }
}

function write(next: Preferences) {
  cached = next;
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // Preferences are a convenience; ignore storage failures.
    }
  }
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot() {
  return read();
}

function getServerSnapshot() {
  return DEFAULT_PREFERENCES;
}

export function usePreferences() {
  const preferences = React.useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot,
  );

  const setPreference = React.useCallback(
    <K extends keyof Preferences>(key: K, value: Preferences[K]) => {
      write({ ...read(), [key]: value });
    },
    [],
  );

  return { preferences, setPreference };
}

export { DEFAULT_PREFERENCES };
