import { z } from "zod";

import { INCIDENT_CATEGORIES } from "@/lib/types/api";

const MAX_FUTURE_SKEW_MS = 5 * 60 * 1000;

export function isValidDateTime(value: string): boolean {
  return !Number.isNaN(Date.parse(value));
}

export function isNotInFuture(value: string): boolean {
  const time = Date.parse(value);
  return Number.isNaN(time) ? false : time <= Date.now() + MAX_FUTURE_SKEW_MS;
}

export const incidentFormSchema = z.object({
  title: z
    .string()
    .trim()
    .min(3, "Give the incident a title of at least 3 characters.")
    .max(120, "Keep the title under 120 characters."),
  description: z
    .string()
    .trim()
    .min(10, "Add at least 10 characters so the record is useful.")
    .max(5000, "Keep the description under 5,000 characters."),
  category: z.enum(INCIDENT_CATEGORIES),
  occurred_at: z
    .string()
    .min(1, "Choose when this happened.")
    .refine(isValidDateTime, "Enter a valid date and time.")
    .refine(isNotInFuture, "Occurrence time cannot be in the future."),
  location_description: z
    .string()
    .trim()
    .max(200, "Keep the location description under 200 characters.")
    .optional()
    .or(z.literal("")),
});

export type IncidentFormValues = z.infer<typeof incidentFormSchema>;

export const incidentFiltersSchema = z.object({
  category: z.enum(INCIDENT_CATEGORIES).optional().or(z.literal("all")),
  status: z.enum(["open", "archived"]).optional().or(z.literal("all")),
  query: z.string().trim().max(120).optional(),
});
