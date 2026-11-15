import type { Metadata } from "next";
import Link from "next/link";
import { CloudOff, LayoutDashboard, RefreshCw } from "lucide-react";

import { BrandLockup } from "@/components/shared/brand";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Offline",
  description: "SHEPHERD is temporarily offline.",
};

export default function OfflinePage() {
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
            <CloudOff className="size-5" />
          </span>
          <h1 className="mt-4 text-xl font-semibold tracking-tight">
            You are offline
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            SHEPHERD cannot reach the network right now. Private API responses,
            evidence and account data are never cached, so application screens are
            unavailable until you reconnect.
          </p>

          <div className="mt-5 rounded-lg border border-[#ecd9b4] bg-[#fbf5e9] px-4 py-3 text-left text-[11px] leading-relaxed text-[#74500a]">
            Any incident draft you saved locally is still in this browser. It has
            not been uploaded and will not sync automatically.
          </div>

          <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
            <Button asChild>
              <Link href="/dashboard">
                <LayoutDashboard className="size-4" />
                Try the dashboard
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/offline">
                <RefreshCw className="size-4" />
                Reload offline page
              </Link>
            </Button>
          </div>
        </div>

        <p className="text-[11px] leading-relaxed text-muted-foreground">
          SHEPHERD is an informational documentation tool. It is not an emergency
          service. If you are in immediate danger, contact local emergency
          services.
        </p>
      </div>
    </main>
  );
}
