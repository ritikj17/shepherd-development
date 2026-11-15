import { describe, expect, it } from "vitest";

import { createSeedDatabase } from "@/lib/api/mock/seed";
import { GRAPH_RELATIONSHIPS, INCIDENT_CATEGORIES } from "@/lib/types/api";
import { isSha256Hex } from "@/lib/utils/hash";

const FIXED_NOW = Date.UTC(2026, 0, 15, 12, 0, 0);

describe("synthetic mock seed", () => {
  const database = createSeedDatabase(FIXED_NOW);
  const incidentIds = new Set(database.incidents.map((item) => item.id));
  const contactIds = new Set(database.contacts.map((item) => item.id));

  it("uses the documented database version and collection shape", () => {
    expect(database.version).toBe(1);
    expect(Array.isArray(database.incidents)).toBe(true);
    expect(Array.isArray(database.evidence)).toBe(true);
    expect(Array.isArray(database.analyses)).toBe(true);
    expect(Array.isArray(database.links)).toBe(true);
    expect(Array.isArray(database.contacts)).toBe(true);
    expect(Array.isArray(database.sessions)).toBe(true);
    expect(Array.isArray(database.reports)).toBe(true);
    expect(database.verifications).toEqual({});
  });

  it("contains synthetic records across multiple screens", () => {
    expect(database.incidents.length).toBeGreaterThanOrEqual(3);
    expect(database.evidence.length).toBeGreaterThan(0);
    expect(database.analyses.length).toBeGreaterThan(0);
    expect(database.links.length).toBeGreaterThan(0);
    expect(database.contacts.length).toBeGreaterThan(0);
    expect(database.sessions.length).toBeGreaterThan(0);
    expect(database.reports).toHaveLength(0);
  });

  it("has unique ids across every entity type", () => {
    const ids = [
      ...database.incidents.map((item) => item.id),
      ...database.evidence.map((item) => item.id),
      ...database.analyses.map((item) => item.analysis_id),
      ...database.links.map((item) => item.id),
      ...database.contacts.map((item) => item.id),
      ...database.sessions.map((item) => item.id),
    ];
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("uses valid categories and relationship types", () => {
    database.incidents.forEach((incident) => {
      expect(INCIDENT_CATEGORIES).toContain(incident.category);
    });
    database.links.forEach((link) => {
      expect(GRAPH_RELATIONSHIPS).toContain(link.relationship);
    });
  });

  it("keeps graph edges inside the incident set", () => {
    database.links.forEach((link) => {
      expect(incidentIds.has(link.source)).toBe(true);
      expect(incidentIds.has(link.target)).toBe(true);
      expect(link.source).not.toBe(link.target);
      expect(link.explanation.length).toBeGreaterThan(10);
    });
  });

  it("links evidence and analyses to real incidents", () => {
    database.evidence.forEach((item) => {
      expect(incidentIds.has(item.incident_id)).toBe(true);
      expect(isSha256Hex(item.sha256)).toBe(true);
    });
    database.analyses.forEach((analysis) => {
      expect(incidentIds.has(analysis.incident_id)).toBe(true);
      expect(analysis.limitations.length).toBeGreaterThan(0);
    });
  });

  it("links sessions to real contacts and optional incidents", () => {
    database.sessions.forEach((session) => {
      expect(contactIds.has(session.trusted_contact_id)).toBe(true);
      if (session.incident_id) {
        expect(incidentIds.has(session.incident_id)).toBe(true);
      }
    });
  });

  it("contains no public evidence URLs", () => {
    const serialized = JSON.stringify(database);
    expect(serialized).not.toMatch(/https?:\/\/[^"]*(evidence|storage)/i);
    expect(database.evidence.every((item) => !("url" in item))).toBe(true);
  });

  it("is deterministic for a fixed clock", () => {
    const first = createSeedDatabase(FIXED_NOW);
    const second = createSeedDatabase(FIXED_NOW);
    expect(first).toEqual(second);
  });
});
