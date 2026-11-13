import {
  MAX_EVIDENCE_BYTES,
  isSupportedEvidenceType,
} from "@/lib/utils/hash";

export interface FileLike {
  name: string;
  size: number;
  type: string;
}

export function validateEvidenceFile(file: FileLike): string | null {
  if (!file.name || file.name.length > 200) {
    return "Choose a file with a name under 200 characters.";
  }
  if (!isSupportedEvidenceType(file.type)) {
    return "Only JPEG, PNG or WebP images are supported.";
  }
  if (file.size <= 0) {
    return "The selected file is empty.";
  }
  if (file.size > MAX_EVIDENCE_BYTES) {
    return "The file is larger than the 10 MB limit.";
  }
  return null;
}

export function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}
