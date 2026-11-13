import { z } from "zod";

export const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, "Enter your email address.")
    .email("Enter a valid email address."),
  password: z.string().min(1, "Enter your password."),
});

export type LoginValues = z.infer<typeof loginSchema>;

export const signupSchema = z
  .object({
    display_name: z
      .string()
      .trim()
      .min(2, "Enter your name (at least 2 characters).")
      .max(80, "Keep your name under 80 characters."),
    email: z
      .string()
      .trim()
      .min(1, "Enter your email address.")
      .email("Enter a valid email address."),
    password: z
      .string()
      .min(8, "Use at least 8 characters.")
      .max(72, "Use 72 characters or fewer."),
    confirm_password: z.string().min(1, "Confirm your password."),
    acknowledge: z
      .boolean()
      .refine(
        (value) => value === true,
        "Please acknowledge that SHEPHERD is not an emergency service.",
      ),
  })
  .refine((values) => values.password === values.confirm_password, {
    path: ["confirm_password"],
    message: "Passwords do not match.",
  });

export type SignupValues = z.infer<typeof signupSchema>;

export const profileSchema = z.object({
  display_name: z
    .string()
    .trim()
    .min(2, "Enter your name (at least 2 characters).")
    .max(80, "Keep your name under 80 characters."),
});

export type ProfileValues = z.infer<typeof profileSchema>;
