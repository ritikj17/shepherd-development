import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Compass } from "lucide-react";

import { BrandLockup } from "@/components/shared/brand";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Page not found",
};

export default function NotFound() {
  return (
    <main
      id="main-content"
      className="flex min-h-dvh flex-col items-center justify-center px-6 py-16"
    >
      <div className="w-full max-w-md space-y-6 text-center">
        <div className="flex justify-center">
          <BrandLockup tone="light" />
        </div>
        <div className="rounded-xl border border-border bg-card p-7 shadow-[0_18px_50px_-30px_rgba(11,18,16,0.4)]">
          <span className="mx-auto flex size-12 items-center justify-center rounded-full border border-border bg-muted/50 text-muted-foreground">
            <Compass className="size-5" />
          </span>
          <p className="mt-4 text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
            404
          </p>
          <h1 className="mt-1 text-xl font-semibold tracking-tight">
            This page could not be found
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            The link may be outdated, or the record may have been removed. Your
            other incident records are unaffected.
          </p>
          <Button asChild className="mt-6">
            <Link href="/dashboard">
              <ArrowLeft className="size-4" />
              Back to dashboard
            </Link>
          </Button>
        </div>
      </div>
    </main>
  );
}
