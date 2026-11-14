import { describe, expect, it } from "vitest";

import {
  incidentFiltersSchema,
  incidentFormSchema,
  isNotInFuture,
  isValidDateTime,
} from "@/lib/validation/incident";

const validIncident = {
  title: "Repeated unwanted messages",
  description: "I received several messages after asking the sender to stop.",
  category: "general_harassment" as const,
  occurred_at: new Date(Date.now() - 60 * 60_000).toISOString(),
  location_description: "Direct messages",
};

describe("incident validation", () => {
  it("accepts a complete past incident", () => {
    const result = incidentFormSchema.safeParse(validIncident);
    expect(result.success).toBe(true);
  });

  it("rejects a future occurrence time beyond the small clock skew", () => {
    const result = incidentFormSchema.safeParse({
      ...validIncident,
      occurred_at: new Date(Date.now() + 10 * 60_000).toISOString(),
    });
    expect(result.success).toBe(false);
  });

  it("rejects a title that is too short", () => {
    const result = incidentFormSchema.safeParse({ ...validIncident, title: "Hi" });
    expect(result.success).toBe(false);
  });

  it("rejects a description that is too short", () => {
    const result = incidentFormSchema.safeParse({
      ...validIncident,
      description: "short",
    });
    expect(result.success).toBe(false);
  });

  it("rejects an unknown category", () => {
    const result = incidentFormSchema.safeParse({
      ...validIncident,
      category: "not_a_category",
    });
    expect(result.success).toBe(false);
  });

  it("allows an empty optional location", () => {
    const result = incidentFormSchema.safeParse({
      ...validIncident,
      location_description: "",
    });
    expect(result.success).toBe(true);
  });

  it("validates date helpers", () => {
    expect(isValidDateTime("2026-01-01T10:00:00.000Z")).toBe(true);
    expect(isValidDateTime("not-a-date")).toBe(false);
    expect(isNotInFuture("2020-01-01T00:00:00.000Z")).toBe(true);
    expect(isNotInFuture("not-a-date")).toBe(false);
  });

  it("accepts filter defaults", () => {
    const result = incidentFiltersSchema.safeParse({
      category: "all",
      status: "all",
      query: "",
    });
    expect(result.success).toBe(true);
  });
});
