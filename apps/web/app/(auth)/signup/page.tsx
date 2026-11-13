import type { Metadata } from "next";
import { Suspense } from "react";

import { AuthFormSkeleton } from "@/components/auth/auth-form-skeleton";
import { SignupForm } from "@/components/auth/signup-form";

export const metadata: Metadata = {
  title: "Create account",
};

export default function SignupPage() {
  return (
    <Suspense fallback={<AuthFormSkeleton />}>
      <SignupForm />
    </Suspense>
  );
}
