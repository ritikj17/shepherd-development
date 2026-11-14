import { createSeedDatabase } from "@/lib/api/mock/seed";
import { MOCK_DB_KEY, type MockDatabase } from "@/lib/api/mock/types";

function isBrowser(): boolean {
  return typeof window !== "undefined";
}

function expireOverdueSessions(database: MockDatabase): MockDatabase {
  const now = Date.now();
  let changed = false;
  const sessions = database.sessions.map((session) => {
    if (
      session.status === "active" &&
      Date.parse(session.checkin_deadline) <= now
    ) {
      changed = true;
      return { ...session, status: "expired" as const };
    }
    return session;
  });
  return changed ? { ...database, sessions } : database;
}

export function readDatabase(): MockDatabase {
  if (!isBrowser()) return createSeedDatabase();

  try {
    const raw = window.localStorage.getItem(MOCK_DB_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as MockDatabase;
      if (parsed?.version === 1 && Array.isArray(parsed.incidents)) {
        const normalized = expireOverdueSessions(parsed);
        if (normalized !== parsed) writeDatabase(normalized);
        return normalized;
      }
    }
  } catch {
    // Corrupt demo data should not break the application.
  }

  const seeded = createSeedDatabase();
  writeDatabase(seeded);
  return seeded;
}

export function writeDatabase(database: MockDatabase): void {
  if (!isBrowser()) return;
  try {
    window.localStorage.setItem(MOCK_DB_KEY, JSON.stringify(database));
  } catch {
    // Quota or private-browsing failures are non-fatal; the UI keeps working
    // for the current session but changes may not persist.
  }
}

export function resetDatabase(): MockDatabase {
  const seeded = createSeedDatabase();
  writeDatabase(seeded);
  return seeded;
}

export function updateDatabase(
  updater: (database: MockDatabase) => MockDatabase,
): MockDatabase {
  const next = updater(readDatabase());
  writeDatabase(next);
  return next;
}

export function mockId(): string {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (char) => {
    const random = (Math.random() * 16) | 0;
    const value = char === "x" ? random : (random & 0x3) | 0x8;
    return value.toString(16);
  });
}

export function delay(ms = 380): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
