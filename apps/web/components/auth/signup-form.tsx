"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  AlertCircle,
  ArrowRight,
  Eye,
  EyeOff,
  FlaskConical,
  LoaderCircle,
  MailCheck,
} from "lucide-react";
import { Controller, useForm } from "react-hook-form";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils/cn";
import { useAuth } from "@/lib/auth/auth-provider";
import { signupSchema, type SignupValues } from "@/lib/validation/auth";

export function SignupForm() {
  const router = useRouter();
  const { signUp, enterDemo, authConfigured, status } = useAuth();
  const [formError, setFormError] = React.useState<string | null>(null);
  const [showPassword, setShowPassword] = React.useState(false);
  const [awaitingConfirmation, setAwaitingConfirmation] = React.useState(false);

  const form = useForm<SignupValues>({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      display_name: "",
      email: "",
      password: "",
      confirm_password: "",
      acknowledge: false,
    },
  });

  React.useEffect(() => {
    if (status === "authenticated" && !awaitingConfirmation) {
      router.replace("/dashboard");
    }
  }, [status, router, awaitingConfirmation]);

  const onSubmit = form.handleSubmit(async (values) => {
    setFormError(null);
    try {
      const result = await signUp({
        displayName: values.display_name,
        email: values.email,
        password: values.password,
      });
      if (result.requiresConfirmation) {
        setAwaitingConfirmation(true);
      } else {
        router.replace("/dashboard");
      }
    } catch (error) {
      setFormError(
        error instanceof Error
          ? error.message
          : "Could not create the account. Try again.",
      );
    }
  });

  const handleDemo = () => {
    enterDemo("Demo User");
    window.location.href = "/dashboard";
  };

  if (awaitingConfirmation) {
    return (
      <div className="space-y-6">
        <div className="flex size-12 items-center justify-center rounded-xl border border-[#c9e2d3] bg-[#f1f7f3]">
          <MailCheck className="size-6 text-[#1c6b47]" />
        </div>
        <div className="space-y-1.5">
          <h1 className="text-2xl font-semibold tracking-tight">
            Confirm your email
          </h1>
          <p className="text-sm leading-relaxed text-muted-foreground">
            We sent a confirmation link to{" "}
            <span className="font-medium text-foreground">
              {form.getValues("email")}
            </span>
            . Open it to activate your account, then sign in.
          </p>
        </div>
        <Button asChild className="w-full">
          <Link href="/login">
            Back to sign in
            <ArrowRight className="size-4" />
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="space-y-1.5">
        <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
          Create an account
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">
          Start your private workspace
        </h1>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Records you create are scoped to your account. You stay in control of
          what is saved, analysed and shared.
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
            onClick={handleDemo}
            className="bg-[#0f5a4e] text-xs font-medium text-white shadow-sm hover:bg-[#0c4c42]"
          >
            1-Click Demo Access
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
          <Label htmlFor="display_name">Your name</Label>
          <Input
            id="display_name"
            autoComplete="name"
            placeholder="How should SHEPHERD address you?"
            disabled={!authConfigured}
            aria-invalid={Boolean(form.formState.errors.display_name)}
            {...form.register("display_name")}
          />
          {form.formState.errors.display_name ? (
            <p className="text-xs text-destructive">
              {form.formState.errors.display_name.message}
            </p>
          ) : null}
        </div>

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

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="password">Password</Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                placeholder="At least 8 characters"
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
                {showPassword ? (
                  <EyeOff className="size-4" />
                ) : (
                  <Eye className="size-4" />
                )}
              </button>
            </div>
            {form.formState.errors.password ? (
              <p className="text-xs text-destructive">
                {form.formState.errors.password.message}
              </p>
            ) : null}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="confirm_password">Confirm password</Label>
            <Input
              id="confirm_password"
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              placeholder="Repeat password"
              disabled={!authConfigured}
              aria-invalid={Boolean(form.formState.errors.confirm_password)}
              {...form.register("confirm_password")}
            />
            {form.formState.errors.confirm_password ? (
              <p className="text-xs text-destructive">
                {form.formState.errors.confirm_password.message}
              </p>
            ) : null}
          </div>
        </div>

        <Controller
          control={form.control}
          name="acknowledge"
          render={({ field }) => (
            <div className="space-y-1.5">
              <div
                role="button"
                tabIndex={0}
                onClick={() => {
                  if (authConfigured) {
                    field.onChange(!field.value);
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === " " || e.key === "Enter") {
                    e.preventDefault();
                    if (authConfigured) {
                      field.onChange(!field.value);
                    }
                  }
                }}
                className={cn(
                  "flex items-start gap-3 rounded-lg border p-3.5 transition-colors select-none",
                  authConfigured
                    ? "cursor-pointer"
                    : "cursor-not-allowed opacity-60",
                  field.value
                    ? "border-primary/50 bg-primary/5 text-foreground"
                    : "border-border bg-muted/30 hover:bg-muted/50 text-muted-foreground",
                  form.formState.errors.acknowledge &&
                    "border-destructive/60 bg-destructive/5"
                )}
              >
                <Checkbox
                  id="acknowledge"
                  checked={field.value}
                  onCheckedChange={(checked) => field.onChange(checked === true)}
                  disabled={!authConfigured}
                  className="mt-0.5 pointer-events-none"
                />
                <div className="space-y-1">
                  <p className="text-xs font-normal leading-relaxed">
                    I understand that SHEPHERD is an informational documentation
                    tool, not an emergency service, and that it does not
                    automatically contact authorities or guarantee a response.
                  </p>
                </div>
              </div>
              {form.formState.errors.acknowledge ? (
                <p className="text-xs text-destructive">
                  {form.formState.errors.acknowledge.message}
                </p>
              ) : null}
            </div>
          )}
        />

        <Button
          type="submit"
          className="w-full"
          disabled={!authConfigured || form.formState.isSubmitting}
        >
          {form.formState.isSubmitting ? (
            <LoaderCircle className="size-4 animate-spin" />
          ) : null}
          {form.formState.isSubmitting ? "Creating account…" : "Create account"}
        </Button>
      </form>

      <p className="text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link
          href="/login"
          className="font-medium text-primary underline-offset-4 hover:underline"
        >
          Sign in
        </Link>
      </p>
    </div>
  );
}
