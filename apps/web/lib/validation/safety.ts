import { z } from "zod";

import { CONTACT_METHODS } from "@/lib/types/api";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_PATTERN = /^[+()\d][\d\s().-]{5,24}$/;

export const trustedContactSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(2, "Enter a contact name.")
      .max(80, "Keep the name under 80 characters."),
    contact_method: z.enum(CONTACT_METHODS),
    contact_value: z
      .string()
      .trim()
      .min(5, "Enter a contact detail.")
      .max(120, "Keep the contact detail under 120 characters."),
    consent_confirmed: z.boolean().refine(
      (value) => value === true,
      "Confirm that this contact has agreed to be listed.",
    ),
  })
  .superRefine((values, ctx) => {
    if (
      values.contact_method === "email" &&
      !EMAIL_PATTERN.test(values.contact_value)
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["contact_value"],
        message: "Enter a valid email address.",
      });
    }
    if (
      values.contact_method === "phone" &&
      !PHONE_PATTERN.test(values.contact_value)
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["contact_value"],
        message: "Enter a valid phone number.",
      });
    }
  });

export type TrustedContactValues = z.infer<typeof trustedContactSchema>;

export const NONE_INCIDENT = "__none__";

export const safetySessionSchema = z.object({
  trusted_contact_id: z.string().min(1, "Choose a trusted contact."),
  incident_id: z.string().min(1),
  checkin_deadline: z
    .string()
    .min(1, "Choose a check-in deadline.")
    .refine(
      (value) => !Number.isNaN(Date.parse(value)),
      "Enter a valid date and time.",
    )
    .refine(
      (value) => Date.parse(value) > Date.now() + 60_000,
      "The deadline must be at least a minute in the future.",
    ),
  consent_confirmed: z.boolean().refine(
    (value) => value === true,
    "Confirm that you consent to this check-in session.",
  ),
});

export type SafetySessionValues = z.infer<typeof safetySessionSchema>;

export const checkInSchema = z.object({
  message: z
    .string()
    .trim()
    .max(280, "Keep the check-in note under 280 characters.")
    .optional()
    .or(z.literal("")),
});

export type CheckInValues = z.infer<typeof checkInSchema>;
