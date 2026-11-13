import type { IncidentCategory } from "@/lib/types/api";

export interface CategoryMeta {
  value: IncidentCategory;
  label: string;
  description: string;
  /** Tailwind classes for a quiet category badge. */
  badgeClassName: string;
  /** Tailwind classes for the category dot. */
  dotClassName: string;
}

export const CATEGORY_META: Record<IncidentCategory, CategoryMeta> = {
  cyberstalking: {
    value: "cyberstalking",
    label: "Cyberstalking",
    description: "Repeated monitoring, following or unwanted online contact.",
    badgeClassName: "bg-[#e9eef7] text-[#274a78] border-[#cfdcee]",
    dotClassName: "bg-[#3c6495]",
  },
  threat: {
    value: "threat",
    label: "Threat",
    description: "Threatening language or an implied intent to cause harm.",
    badgeClassName: "bg-[#f9e9e7] text-[#8f2a22] border-[#f0cdc8]",
    dotClassName: "bg-[#b3261e]",
  },
  sextortion: {
    value: "sextortion",
    label: "Sextortion",
    description: "Coercion involving intimate images or threatened exposure.",
    badgeClassName: "bg-[#f4e9f2] text-[#713b68] border-[#e6cfe2]",
    dotClassName: "bg-[#8c4a81]",
  },
  impersonation: {
    value: "impersonation",
    label: "Impersonation",
    description: "Someone pretending to be the user or another person.",
    badgeClassName: "bg-[#f1ecdf] text-[#6d5420] border-[#e2d7bb]",
    dotClassName: "bg-[#8a6a24]",
  },
  doxxing: {
    value: "doxxing",
    label: "Doxxing",
    description: "Sharing or threatening to share private identifying details.",
    badgeClassName: "bg-[#efe8dc] text-[#6a4a2a] border-[#e0d2bd]",
    dotClassName: "bg-[#8a5a2e]",
  },
  image_based_abuse: {
    value: "image_based_abuse",
    label: "Image-based abuse",
    description: "Non-consensual creation, sharing or threat of images.",
    badgeClassName: "bg-[#f6e8ea] text-[#803347] border-[#ecd0d5]",
    dotClassName: "bg-[#a1425a]",
  },
  general_harassment: {
    value: "general_harassment",
    label: "General harassment",
    description: "Unwanted, repeated or intimidating behaviour.",
    badgeClassName: "bg-[#e9efe9] text-[#2e5a43] border-[#cfe0d4]",
    dotClassName: "bg-[#3c7557]",
  },
  other: {
    value: "other",
    label: "Other",
    description: "A safety concern that does not fit another category.",
    badgeClassName: "bg-muted text-muted-foreground border-border",
    dotClassName: "bg-muted-foreground",
  },
};

export const CATEGORY_OPTIONS = Object.values(CATEGORY_META);

export function categoryLabel(value: IncidentCategory | string): string {
  return (
    CATEGORY_META[value as IncidentCategory]?.label ??
    String(value).replaceAll("_", " ")
  );
}

export function categoryMeta(value: IncidentCategory): CategoryMeta {
  return CATEGORY_META[value] ?? CATEGORY_META.other;
}

export const RELATIONSHIP_META = {
  SAME_USER_REPORTED_IDENTIFIER: {
    label: "Same user-reported identifier",
    short: "Same identifier",
    kind: "user_reported" as const,
    description:
      "The user recorded the same identifier (for example an account handle) in both incidents.",
  },
  SIMILAR_MESSAGE_CONTENT: {
    label: "Similar message content",
    short: "Similar content",
    kind: "suggested" as const,
    description:
      "The content of the two incidents has textual similarity. This is a suggestion, not proof of a shared person.",
  },
  REPEATED_CONTACT_PATTERN: {
    label: "Repeated contact pattern",
    short: "Repeated contact",
    kind: "suggested" as const,
    description:
      "The incidents show a repeated contact pattern based on available indicators.",
  },
  USER_REPORTED_RELATED_EVENT: {
    label: "User-reported related event",
    short: "Related event",
    kind: "user_reported" as const,
    description:
      "The user explicitly reported that these incidents are related.",
  },
} as const;

export type RelationshipKind = "user_reported" | "suggested";
