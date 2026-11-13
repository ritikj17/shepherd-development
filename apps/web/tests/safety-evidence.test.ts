import { describe, expect, it } from "vitest";

import { validateEvidenceFile, isUuid } from "@/lib/validation/evidence";
import {
  NONE_INCIDENT,
  safetySessionSchema,
  trustedContactSchema,
} from "@/lib/validation/safety";
import { MAX_EVIDENCE_BYTES } from "@/lib/utils/hash";

const futureDeadline = new Date(Date.now() + 60 * 60_000).toISOString();

describe("evidence validation", () => {
  it("accepts a supported image under the size limit", () => {
    expect(
      validateEvidenceFile({
        name: "screenshot.png",
        size: 1024,
        type: "image/png",
      }),
    ).toBeNull();
  });

  it("rejects unsupported types", () => {
    expect(
      validateEvidenceFile({
        name: "document.pdf",
        size: 1024,
        type: "application/pdf",
      }),
    ).toMatch(/JPEG, PNG or WebP/i);
  });

  it("rejects empty files", () => {
    expect(
      validateEvidenceFile({
        name: "empty.png",
        size: 0,
        type: "image/png",
      }),
    ).toMatch(/empty/i);
  });

  it("rejects files above the 10 MB limit", () => {
    expect(
      validateEvidenceFile({
        name: "large.png",
        size: MAX_EVIDENCE_BYTES + 1,
        type: "image/png",
      }),
    ).toMatch(/10 MB/i);
  });

  it("checks UUID shape", () => {
    expect(isUuid("1d9a0000-0000-4000-8000-000000000001")).toBe(true);
    expect(isUuid("not-a-uuid")).toBe(false);
  });
});

describe("trusted contact validation", () => {
  const base = {
    name: "Meera Kapoor",
    contact_method: "email" as const,
    contact_value: "meera@example.test",
    consent_confirmed: true,
  };

  it("accepts a valid email contact with consent", () => {
    expect(trustedContactSchema.safeParse(base).success).toBe(true);
  });

  it("rejects a malformed email", () => {
    expect(
      trustedContactSchema.safeParse({
        ...base,
        contact_value: "not-an-email",
      }).success,
    ).toBe(false);
  });

  it("accepts a valid phone contact", () => {
    expect(
      trustedContactSchema.safeParse({
        ...base,
        contact_method: "phone",
        contact_value: "+1 555 0100",
      }).success,
    ).toBe(true);
  });

  it("rejects a malformed phone number", () => {
    expect(
      trustedContactSchema.safeParse({
        ...base,
        contact_method: "phone",
        contact_value: "abc",
      }).success,
    ).toBe(false);
  });

  it("requires explicit consent", () => {
    expect(
      trustedContactSchema.safeParse({ ...base, consent_confirmed: false })
        .success,
    ).toBe(false);
  });
});

describe("safety session validation", () => {
  const base = {
    trusted_contact_id: "contact-1",
    incident_id: NONE_INCIDENT,
    checkin_deadline: futureDeadline,
    consent_confirmed: true,
  };

  it("accepts a future deadline with consent", () => {
    expect(safetySessionSchema.safeParse(base).success).toBe(true);
  });

  it("rejects a past deadline", () => {
    expect(
      safetySessionSchema.safeParse({
        ...base,
        checkin_deadline: new Date(Date.now() - 60_000).toISOString(),
      }).success,
    ).toBe(false);
  });

  it("requires consent", () => {
    expect(
      safetySessionSchema.safeParse({ ...base, consent_confirmed: false }).success,
    ).toBe(false);
  });
});
