import type { RiskLevel } from "@/lib/types/api";

export interface RiskBand {
  level: RiskLevel;
  label: string;
  shortLabel: string;
  description: string;
  textClassName: string;
  badgeClassName: string;
  barClassName: string;
}

export const RISK_BANDS: Record<RiskLevel, RiskBand> = {
  low: {
    level: "low",
    label: "Low review priority",
    shortLabel: "Low",
    description: "0–29 on the experimental review-priority scale.",
    textClassName: "text-risk-low",
    badgeClassName: "bg-[#e7f1ea] text-[#1c6b47] border-[#c9e2d3]",
    barClassName: "bg-risk-low",
  },
  moderate: {
    level: "moderate",
    label: "Moderate review priority",
    shortLabel: "Moderate",
    description: "30–59 on the experimental review-priority scale.",
    textClassName: "text-risk-moderate",
    badgeClassName: "bg-[#f8efdc] text-[#8a5a00] border-[#ecd9b4]",
    barClassName: "bg-risk-moderate",
  },
  high: {
    level: "high",
    label: "High review priority",
    shortLabel: "High",
    description: "60–100 on the experimental review-priority scale.",
    textClassName: "text-risk-high",
    badgeClassName: "bg-[#f9e9e7] text-[#a1241c] border-[#f0cdc8]",
    barClassName: "bg-risk-high",
  },
  insufficient_data: {
    level: "insufficient_data",
    label: "Insufficient data",
    shortLabel: "Insufficient data",
    description:
      "There was not enough information to calculate a review-priority score.",
    textClassName: "text-muted-foreground",
    badgeClassName: "bg-muted text-muted-foreground border-border",
    barClassName: "bg-muted-foreground/40",
  },
};

export function riskBand(level: RiskLevel | null | undefined): RiskBand {
  return RISK_BANDS[level ?? "insufficient_data"] ?? RISK_BANDS.insufficient_data;
}

export function riskLevelFromScore(score: number | null | undefined): RiskLevel {
  if (score === null || score === undefined || Number.isNaN(score)) {
    return "insufficient_data";
  }
  if (score <= 29) return "low";
  if (score <= 59) return "moderate";
  return "high";
}

export function clampScore(score: number): number {
  return Math.min(100, Math.max(0, Math.round(score)));
}

export function formatModelScore(confidence: number | null | undefined): string {
  if (confidence === null || confidence === undefined) return "Not provided";
  return confidence.toFixed(2);
}
