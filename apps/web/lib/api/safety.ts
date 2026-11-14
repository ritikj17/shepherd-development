import { apiRequest } from "@/lib/api/client";
import { isMockApiEnabled } from "@/lib/api/config";
import {
  mockCheckIn,
  mockCreateSafetySession,
  mockCreateTrustedContact,
  mockDeleteTrustedContact,
  mockListSafetySessions,
  mockListTrustedContacts,
} from "@/lib/api/mock/safety";
import type {
  CheckInInput,
  CheckInResponse,
  CreateSafetySessionInput,
  CreateTrustedContactInput,
  SafetySession,
  SafetySessionListResponse,
  TrustedContact,
  TrustedContactListResponse,
} from "@/lib/types/api";

export async function listTrustedContacts(): Promise<TrustedContactListResponse> {
  if (isMockApiEnabled) return mockListTrustedContacts();
  return apiRequest<TrustedContactListResponse>("/trusted-contacts");
}

export async function createTrustedContact(
  input: CreateTrustedContactInput,
): Promise<TrustedContact> {
  if (isMockApiEnabled) return mockCreateTrustedContact(input);
  return apiRequest<TrustedContact>("/trusted-contacts", {
    method: "POST",
    body: input,
  });
}

export async function deleteTrustedContact(id: string): Promise<void> {
  if (isMockApiEnabled) return mockDeleteTrustedContact(id);
  return apiRequest<void>(`/trusted-contacts/${id}`, { method: "DELETE" });
}

export async function listSafetySessions(): Promise<SafetySessionListResponse> {
  if (isMockApiEnabled) return mockListSafetySessions();
  return apiRequest<SafetySessionListResponse>("/safety-sessions");
}

export async function createSafetySession(
  input: CreateSafetySessionInput,
): Promise<SafetySession> {
  if (isMockApiEnabled) return mockCreateSafetySession(input);
  return apiRequest<SafetySession>("/safety-sessions", {
    method: "POST",
    body: input,
  });
}

export async function checkInToSession(
  sessionId: string,
  input: CheckInInput = {},
): Promise<CheckInResponse> {
  if (isMockApiEnabled) return mockCheckIn(sessionId);
  return apiRequest<CheckInResponse>(`/safety-sessions/${sessionId}/checkin`, {
    method: "POST",
    body: input,
  });
}
