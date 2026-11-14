"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { AlertCircle, ArrowRight, Eye, EyeOff, FlaskConical, LoaderCircle } from "lucide-react";
import { useForm } from "react-hook-form";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/lib/auth/auth-provider";
import { loginSchema, type LoginValues } from "@/lib/validation/auth";

function safeNextPath(value: string | null): string {
  if (!value) return "/dashboard";
  if (!value.startsWith("/") || value.startsWith("//")) return "/dashboard";
  return value;
}

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { signIn, enterDemo, authConfigured, status, requestPasswordReset } =
    useAuth();
  const [formError, setFormError] = React.useState<string | null>(null);
  const [showPassword, setShowPassword] = React.useState(false);
  const [resetPending, setResetPending] = React.useState(false);
  const [resetSent, setResetSent] = React.useState(false);

  const nextPath = safeNextPath(searchParams.get("next"));

  const form = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  React.useEffect(() => {
    if (status === "authenticated") {
      router.replace(nextPath);
    }
  }, [status, router, nextPath]);

  const onSubmit = form.handleSubmit(async (values) => {
    setFormError(null);
    try {
      await signIn(values.email, values.password);
      window.location.href = nextPath || "/dashboard";
    } catch (error) {
      setFormError(
        error instanceof Error ? error.message : "Could not sign in. Try again.",
      );
    }
  });

  const handleDemo = () => {
    enterDemo("Demo User");
    window.location.href = nextPath || "/dashboard";
  };

  const handleReset = async () => {
    const email = form.getValues("email");
    if (!email) {
      setFormError("Enter your email address first, then request a reset link.");
      return;
    }
    setResetPending(true);
    setFormError(null);
    try {
      await requestPasswordReset(email);
      setResetSent(true);
    } catch (error) {
      setFormError(
        error instanceof Error ? error.message : "Could not request a reset link.",
      );
    } finally {
      setResetPending(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="space-y-1.5">
        <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
          Welcome back
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">Sign in to SHEPHERD</h1>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Your incidents, evidence metadata and check-ins are scoped to your
          authenticated account.
        </p>
      </div>

      <div className="rounded-xl border border-[#c9e2d3] bg-[#f1f7f3] p-4 text-[#1a5c3d]">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-1.5">
              <FlaskConical className="size-3.5 text-[#1c6b47]" />
              <p className="text-xs font-semibold uppercase tracking-wider text-[#1c6b47]">
                Demo Testing Account
              </p>
            </div>
            <p className="text-xs text-[#1a5c3d]/90 font-mono">
              demo@shepherd.app &middot; DemoUser123!
            </p>
          </div>
          <Button
            type="button"
            size="sm"
            onClick={() => {
              form.setValue("email", "demo@shepherd.app");
              form.setValue("password", "DemoUser123!");
              handleDemo();
            }}
            className="bg-[#0f5a4e] text-xs font-medium text-white shadow-sm hover:bg-[#0c4c42]"
          >
            1-Click Demo Login
            <ArrowRight className="size-3.5" />
          </Button>
        </div>
      </div>

      {formError ? (
        <Alert variant="destructive">
          <AlertCircle />
          <AlertDescription>{formError}</AlertDescription>
        </Alert>
      ) : null}

      {resetSent ? (
        <Alert variant="success">
          <AlertDescription>
            If that email is registered, a password reset link is on its way.
          </AlertDescription>
        </Alert>
      ) : null}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          e.stopPropagation();
          void onSubmit(e);
        }}
        className="space-y-4"
        noValidate
      >
        <div className="space-y-1.5">
          <Label htmlFor="email">Email address</Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            disabled={!authConfigured}
            aria-invalid={Boolean(form.formState.errors.email)}
            {...form.register("email")}
          />
          {form.formState.errors.email ? (
            <p className="text-xs text-destructive">
              {form.formState.errors.email.message}
            </p>
          ) : null}
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between gap-3">
            <Label htmlFor="password">Password</Label>
            {authConfigured ? (
              <button
                type="button"
                onClick={() => void handleReset()}
                disabled={resetPending}
                className="cursor-pointer text-xs font-medium text-primary underline-offset-4 hover:underline disabled:opacity-60"
              >
                {resetPending ? "Sending…" : "Forgot password?"}
              </button>
            ) : null}
          </div>
          <div className="relative">
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              placeholder="Enter your password"
              disabled={!authConfigured}
              className="pr-10"
              aria-invalid={Boolean(form.formState.errors.password)}
              {...form.register("password")}
            />
            <button
              type="button"
              onClick={() => setShowPassword((value) => !value)}
              className="absolute right-2 top-1/2 -translate-y-1/2 cursor-pointer rounded-md p-1.5 text-muted-foreground hover:bg-muted"
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          </div>
          {form.formState.errors.password ? (
            <p className="text-xs text-destructive">
              {form.formState.errors.password.message}
            </p>
          ) : null}
        </div>

        <Button
          type="submit"
          className="w-full"
          disabled={!authConfigured || form.formState.isSubmitting}
        >
          {form.formState.isSubmitting ? (
            <LoaderCircle className="size-4 animate-spin" />
          ) : null}
          {form.formState.isSubmitting ? "Signing in…" : "Sign in"}
        </Button>

        {!authConfigured ? (
          <p className="text-center text-[11px] leading-relaxed text-muted-foreground">
            Email sign-in is disabled until NEXT_PUBLIC_SUPABASE_URL and
            NEXT_PUBLIC_SUPABASE_ANON_KEY are configured.
          </p>
        ) : null}
      </form>

      <p className="text-center text-sm text-muted-foreground">
        New to SHEPHERD?{" "}
        <Link
          href="/signup"
          className="font-medium text-primary underline-offset-4 hover:underline"
        >
          Create an account
        </Link>
      </p>
    </div>
  );
}
