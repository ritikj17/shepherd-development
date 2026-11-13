import { describe, expect, it } from "vitest";

import {
  MAX_EVIDENCE_BYTES,
  isSha256Hex,
  isSupportedEvidenceType,
  maskContactValue,
  sha256HexFromBuffer,
} from "@/lib/utils/hash";
import {
  clampScore,
  formatModelScore,
  riskBand,
  riskLevelFromScore,
} from "@/lib/utils/risk";
import {
  formatBytes,
  formatCountdown,
  initials,
  pluralize,
  shortHash,
} from "@/lib/utils/format";

describe("hash utilities", () => {
  it("computes the known SHA-256 for 'abc'", async () => {
    const buffer = new TextEncoder().encode("abc").buffer;
    expect(await sha256HexFromBuffer(buffer)).toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    );
  });

  it("recognises a 64-character lowercase hex digest", () => {
    expect(isSha256Hex("a".repeat(64))).toBe(true);
    expect(isSha256Hex("a".repeat(63))).toBe(false);
    expect(isSha256Hex("A".repeat(64))).toBe(false);
    expect(isSha256Hex(null)).toBe(false);
  });

  it("checks supported evidence MIME types", () => {
    expect(isSupportedEvidenceType("image/png")).toBe(true);
    expect(isSupportedEvidenceType("image/jpeg")).toBe(true);
    expect(isSupportedEvidenceType("image/webp")).toBe(true);
    expect(isSupportedEvidenceType("image/gif")).toBe(false);
  });

  it("exposes the documented size limit", () => {
    expect(MAX_EVIDENCE_BYTES).toBe(10 * 1024 * 1024);
  });

  it("masks email addresses while keeping the domain", () => {
    expect(maskContactValue("meera@example.test", "email")).toBe(
      "me•••@example.test",
    );
    expect(maskContactValue(null, "email")).toBe("Not displayed");
  });

  it("masks phone numbers down to the last four digits", () => {
    expect(maskContactValue("+1 555 0100", "phone")).toBe("••••0100");
    expect(maskContactValue("12", "phone")).toBe("••••");
  });
});

describe("risk utilities", () => {
  it("maps score boundaries to review-priority bands", () => {
    expect(riskLevelFromScore(null)).toBe("insufficient_data");
    expect(riskLevelFromScore(0)).toBe("low");
    expect(riskLevelFromScore(29)).toBe("low");
    expect(riskLevelFromScore(30)).toBe("moderate");
    expect(riskLevelFromScore(59)).toBe("moderate");
    expect(riskLevelFromScore(60)).toBe("high");
    expect(riskLevelFromScore(100)).toBe("high");
  });

  it("falls back to insufficient data for unknown levels", () => {
    expect(riskBand(null).level).toBe("insufficient_data");
    expect(riskBand("not-a-level" as never).level).toBe("insufficient_data");
  });

  it("clamps and rounds scores", () => {
    expect(clampScore(-4)).toBe(0);
    expect(clampScore(42.6)).toBe(43);
    expect(clampScore(140)).toBe(100);
  });

  it("formats model scores without implying probability", () => {
    expect(formatModelScore(0.714)).toBe("0.71");
    expect(formatModelScore(null)).toBe("Not provided");
  });
});

describe("format utilities", () => {
  it("formats bytes across units", () => {
    expect(formatBytes(0)).toBe("0 B");
    expect(formatBytes(1024)).toBe("1.0 KB");
    expect(formatBytes(10 * 1024 * 1024)).toBe("10 MB");
    expect(formatBytes(null)).toBe("—");
  });

  it("shortens long hashes symmetrically", () => {
    expect(shortHash("abcdef", 2)).toBe("ab…ef");
    expect(shortHash("abcdefghijklmnop", 3)).toBe("abc…nop");
    expect(shortHash(null)).toBe("—");
  });

  it("derives initials", () => {
    expect(initials("Meera Kapoor")).toBe("MK");
    expect(initials("Aarav")).toBe("A");
    expect(initials("")).toBe("S");
  });

  it("pluralizes counts", () => {
    expect(pluralize(1, "incident")).toBe("1 incident");
    expect(pluralize(2, "incident")).toBe("2 incidents");
    expect(pluralize(2, "analysis", "analyses")).toBe("2 analyses");
  });

  it("describes countdowns and passed deadlines", () => {
    expect(formatCountdown(new Date(Date.now() - 1_000))).toBe("Deadline passed");
    expect(formatCountdown(new Date(Date.now() + 45 * 60_000))).toMatch(
      /remaining/,
    );
  });
});
