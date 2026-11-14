import type { Metadata } from "next";
import { Lock, Sparkles, Users } from "lucide-react";

import { BrandLockup } from "@/components/shared/brand";

export const metadata: Metadata = {
  title: "Account",
};

const PRINCIPLES = [
  {
    icon: Lock,
    title: "Private by design",
    description:
      "Evidence is private, hashes are explicit, and the app never pretends a local draft was uploaded.",
  },
  {
    icon: Sparkles,
    title: "Explainable, not verdicts",
    description:
      "AI-assisted labels include their indicators and limitations. You keep the final judgment.",
  },
  {
    icon: Users,
    title: "Consent-based response",
    description:
      "Trusted-contact check-ins require explicit consent. SHEPHERD never dispatches emergency services.",
  },
];

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[1.05fr_1fr]">
      <aside className="sidebar-grid relative hidden flex-col justify-between overflow-hidden bg-sidebar p-10 text-white lg:flex xl:p-14">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-24 top-1/3 size-[420px] rounded-full border border-white/[0.06]"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-10 top-1/2 size-[280px] rounded-full border border-white/[0.05]"
        />

        <BrandLockup tone="dark" />

        <div className="relative max-w-[460px] space-y-7">
          <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-[#9ccbb8]">
            Safety intelligence workspace
          </p>
          <h1 className="font-display text-4xl leading-[1.12] tracking-[-0.02em] text-balance xl:text-[44px]">
            A calmer way to document, understand, and prepare.
          </h1>
          <p className="max-w-[420px] text-sm leading-relaxed text-sidebar-muted">
            Organize incidents and private evidence, read explainable
            AI-assisted analysis, and coordinate consent-based check-ins — in
            one user-controlled workspace.
          </p>

          <ul className="space-y-4 pt-2">
            {PRINCIPLES.map((principle) => {
              const Icon = principle.icon;
              return (
                <li key={principle.title} className="flex gap-3">
                  <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/[0.04]">
                    <Icon className="size-3.5 text-[#b9dccd]" />
                  </span>
                  <div>
                    <p className="text-xs font-semibold text-white">
                      {principle.title}
                    </p>
                    <p className="mt-0.5 text-xs leading-relaxed text-sidebar-muted">
                      {principle.description}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>

        <div className="relative space-y-1 border-t border-sidebar-border pt-5 text-[11px] leading-relaxed text-sidebar-muted">
          <p className="font-medium text-white/80">
            SHEPHERD is not an emergency service.
          </p>
          <p>
            If you are in immediate danger, contact local emergency services.
            This prototype does not predict crime or guarantee safety.
          </p>
        </div>
      </aside>

      <main className="flex min-h-dvh flex-col items-center justify-center px-5 py-10 sm:px-8">
        <div className="w-full max-w-[420px]">
          <div className="mb-8 lg:hidden">
            <BrandLockup tone="light" />
          </div>
          {children}
          <p className="mt-8 text-center text-[11px] leading-relaxed text-muted-foreground lg:hidden">
            SHEPHERD is an informational tool, not an emergency service. Call
            local emergency services if you are in immediate danger.
          </p>
        </div>
      </main>
    </div>
  );
}
