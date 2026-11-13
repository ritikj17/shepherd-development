import * as React from "react";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils/cn";

export function StatCard({
  label,
  value,
  hint,
  icon,
  href,
  className,
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
  icon: React.ReactNode;
  href?: string;
  className?: string;
}) {
  const content = (
    <Card
      className={cn(
        "group h-full transition-colors",
        href && "hover:border-primary/25 hover:bg-card",
        className,
      )}
    >
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3">
          <p className="text-[11px] font-medium uppercase tracking-[0.13em] text-muted-foreground">
            {label}
          </p>
          <span className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-border bg-muted/50 text-muted-foreground">
            {icon}
          </span>
        </div>
        <div className="mt-3 flex items-end justify-between gap-2">
          <p className="text-[28px] font-semibold leading-none tracking-tight tabular-nums">
            {value}
          </p>
          {href ? (
            <ArrowUpRight className="mb-0.5 size-4 text-muted-foreground/50 transition-colors group-hover:text-primary" />
          ) : null}
        </div>
        {hint ? (
          <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
            {hint}
          </p>
        ) : null}
      </CardContent>
    </Card>
  );

  return href ? (
    <Link href={href} className="block h-full rounded-xl">
      {content}
    </Link>
  ) : (
    content
  );
}
