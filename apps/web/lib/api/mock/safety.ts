import { delay, mockId, readDatabase, updateDatabase } from "@/lib/api/mock/store";
import { mockError } from "@/lib/api/mock/errors";
import type {
  CheckInResponse,
  CreateSafetySessionInput,
  CreateTrustedContactInput,
  SafetySession,
  SafetySessionListResponse,
  TrustedContact,
  TrustedContactListResponse,
} from "@/lib/types/api";

const STATUS_ORDER: Record<SafetySession["status"], number> = {
  active: 0,
  checked_in: 1,
  expired: 2,
  cancelled: 3,
};

export async function mockListTrustedContacts(): Promise<TrustedContactListResponse> {
  await delay(260);
  const items = [...readDatabase().contacts].sort(
    (a, b) => Date.parse(b.created_at) - Date.parse(a.created_at),
  );
  return { items };
}

export async function mockCreateTrustedContact(
  input: CreateTrustedContactInput,
): Promise<TrustedContact> {
  await delay(420);
  if (input.consent_confirmed !== true) {
    throw mockError(
      400,
      "CONSENT_REQUIRED",
      "Confirm that this contact has agreed to be listed.",
    );
  }

  const contact: TrustedContact = {
    id: mockId(),
    name: input.name,
    contact_method: input.contact_method,
    contact_value: input.contact_value,
    consent_confirmed: true,
    created_at: new Date().toISOString(),
  };

  updateDatabase((database) => ({
    ...database,
    contacts: [contact, ...database.contacts],
  }));

  return {
    id: contact.id,
    name: contact.name,
    contact_method: contact.contact_method,
    created_at: contact.created_at,
  };
}

export async function mockDeleteTrustedContact(id: string): Promise<void> {
  await delay(360);
  const database = readDatabase();
  if (!database.contacts.some((item) => item.id === id)) {
    throw mockError(404, "NOT_FOUND", "That contact could not be found.");
  }

  const referenced = database.sessions.some(
    (session) => session.trusted_contact_id === id,
  );
  if (referenced) {
    throw mockError(
      400,
      "CONTACT_IN_USE",
      "This contact is referenced by a safety session. Historical session records are retained; remove the contact after those sessions are no longer needed.",
    );
  }

  updateDatabase((current) => ({
    ...current,
    contacts: current.contacts.filter((item) => item.id !== id),
  }));
}

export async function mockListSafetySessions(): Promise<SafetySessionListResponse> {
  await delay(260);
  const items = [...readDatabase().sessions].sort((a, b) => {
    const statusDelta = STATUS_ORDER[a.status] - STATUS_ORDER[b.status];
    if (statusDelta !== 0) return statusDelta;
    return Date.parse(b.created_at) - Date.parse(a.created_at);
  });
  return { items };
}

export async function mockCreateSafetySession(
  input: CreateSafetySessionInput,
): Promise<SafetySession> {
  await delay(460);
  if (input.consent_confirmed !== true) {
    throw mockError(
      400,
      "CONSENT_REQUIRED",
      "Explicit consent is required before starting a safety session.",
    );
  }
  if (Date.parse(input.checkin_deadline) <= Date.now()) {
    throw mockError(
      400,
      "INVALID_DEADLINE",
      "The check-in deadline must be in the future.",
    );
  }

  const database = readDatabase();
  if (
    !database.contacts.some((item) => item.id === input.trusted_contact_id)
  ) {
    throw mockError(
      404,
      "NOT_FOUND",
      "That trusted contact could not be found.",
    );
  }
  if (
    input.incident_id &&
    !database.incidents.some((item) => item.id === input.incident_id)
  ) {
    throw mockError(404, "NOT_FOUND", "That incident could not be found.");
  }

  const session: SafetySession = {
    id: mockId(),
    trusted_contact_id: input.trusted_contact_id,
    incident_id: input.incident_id,
    status: "active",
    checkin_deadline: input.checkin_deadline,
    created_at: new Date().toISOString(),
    checked_in_at: null,
    cancelled_at: null,
  };

  updateDatabase((current) => ({
    ...current,
    sessions: [session, ...current.sessions],
  }));

  return session;
}

export async function mockCheckIn(
  sessionId: string,
): Promise<CheckInResponse> {
  await delay(420);
  const database = readDatabase();
  const session = database.sessions.find((item) => item.id === sessionId);
  if (!session) {
    throw mockError(404, "NOT_FOUND", "That safety session could not be found.");
  }

  if (session.status === "checked_in" && session.checked_in_at) {
    return {
      id: session.id,
      status: "checked_in",
      checked_in_at: session.checked_in_at,
    };
  }

  if (session.status !== "active") {
    throw mockError(
      400,
      "INVALID_STATE",
      "Only an active safety session can be checked in.",
    );
  }

  if (Date.parse(session.checkin_deadline) <= Date.now()) {
    throw mockError(
      400,
      "DEADLINE_PASSED",
      "The check-in deadline has passed. The Core API would mark this session expired.",
    );
  }

  const checkedInAt = new Date().toISOString();
  updateDatabase((current) => ({
    ...current,
    sessions: current.sessions.map((item) =>
      item.id === sessionId
        ? { ...item, status: "checked_in", checked_in_at: checkedInAt }
        : item,
    ),
  }));

  return {
    id: sessionId,
    status: "checked_in",
    checked_in_at: checkedInAt,
  };
}
