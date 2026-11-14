export const MAX_EVIDENCE_BYTES = 10 * 1024 * 1024;

export const SUPPORTED_EVIDENCE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

export function isSupportedEvidenceType(mimeType: string): boolean {
  return (SUPPORTED_EVIDENCE_TYPES as readonly string[]).includes(mimeType);
}

export function isSha256Hex(value: string | null | undefined): boolean {
  return typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
}

export async function sha256HexFromBuffer(buffer: ArrayBuffer): Promise<string> {
  if (!globalThis.crypto?.subtle) {
    throw new Error(
      "SHA-256 is unavailable in this browser context. Use a secure (HTTPS or localhost) context.",
    );
  }
  const digest = await globalThis.crypto.subtle.digest("SHA-256", buffer);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export async function sha256HexFromFile(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  return sha256HexFromBuffer(buffer);
}

export function maskContactValue(
  value: string | null | undefined,
  method: "email" | "phone",
): string {
  if (!value) return "Not displayed";
  if (method === "email") {
    const [local, domain] = value.split("@");
    if (!local || !domain) return "••••";
    const visible = local.slice(0, 2);
    return `${visible}${"•".repeat(Math.max(2, local.length - 2))}@${domain}`;
  }
  const digits = value.replace(/[^\d]/g, "");
  if (digits.length < 4) return "••••";
  return `${"•".repeat(Math.max(0, digits.length - 4))}${digits.slice(-4)}`;
}
