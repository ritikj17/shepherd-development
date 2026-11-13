import { Info } from "lucide-react";

import { cn } from "@/lib/utils/cn";
import { riskBand } from "@/lib/utils/risk";
import type { RiskFactor, RiskLevel } from "@/lib/types/api";

export function RiskMeter({
  score,
  level,
  explanation,
  factors,
  className,
}: {
  score: number | null;
  level: RiskLevel;
  explanation?: string;
  factors?: RiskFactor[];
  className?: string;
}) {
  const band = riskBand(level);
  const value = score === null ? 0 : Math.min(100, Math.max(0, score));

  return (
    <div className={cn("space-y-4", className)}>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.13em] text-muted-foreground">
            Review priority
          </p>
          <div className="mt-1 flex items-baseline gap-2">
            <span className={cn("text-3xl font-semibold tabular-nums", band.textClassName)}>
              {score === null ? "—" : value}
            </span>
            <span className="text-sm text-muted-foreground">/ 100</span>
            <span className={cn("text-sm font-medium", band.textClassName)}>
              {band.label}
            </span>
          </div>
        </div>
        <span className="text-[11px] text-muted-foreground">
          Experimental indicator
        </span>
      </div>

      <div className="space-y-1.5">
        <div
          className="relative h-2.5 w-full overflow-hidden rounded-full bg-muted"
          role="meter"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={score ?? 0}
          aria-label="Experimental review-priority score"
        >
          <div
            className={cn("h-full rounded-full transition-[width] duration-500", band.barClassName)}
            style={{ width: `${value}%` }}
          />
          <span
            aria-hidden="true"
            className="absolute inset-y-0 left-[30%] w-px bg-white/80"
          />
          <span
            aria-hidden="true"
            className="absolute inset-y-0 left-[60%] w-px bg-white/80"
          />
        </div>
        <div className="flex justify-between text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
          <span>Low 0–29</span>
          <span>Moderate 30–59</span>
          <span>High 60–100</span>
        </div>
      </div>

      {explanation ? (
        <p className="text-sm leading-relaxed text-muted-foreground">
          {explanation}
        </p>
      ) : null}

      {factors && factors.length > 0 ? (
        <div className="space-y-2.5 rounded-lg border border-border bg-muted/25 p-3.5">
          <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
            Contributing factors
          </p>
          {factors.map((factor) => (
            <div key={factor.name} className="space-y-1">
              <div className="flex items-center justify-between gap-3 text-xs">
                <span className="font-medium text-foreground">{factor.name}</span>
                <span className="tabular-nums text-muted-foreground">
                  {factor.value}
                  {factor.weight ? ` · weight ${factor.weight}` : ""}
                </span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-border/70">
                <div
                  className="h-full rounded-full bg-primary/70"
                  style={{ width: `${Math.min(100, Math.max(0, factor.value))}%` }}
                />
              </div>
              {factor.description ? (
                <p className="text-[11px] leading-relaxed text-muted-foreground">
                  {factor.description}
                </p>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}

      <p className="flex items-start gap-1.5 text-[11px] leading-relaxed text-muted-foreground">
        <Info className="mt-0.5 size-3 shrink-0" />
        This score summarizes configured review indicators. It is not a
        probability of crime, danger or future harm.
      </p>
    </div>
  );
}
