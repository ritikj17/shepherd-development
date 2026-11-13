import * as React from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils/cn";

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-lg border border-dashed border-border bg-muted/25 px-6 py-12 text-center",
        className,
      )}
    >
      {icon ? (
        <div className="mb-4 flex size-11 items-center justify-center rounded-full border border-border bg-card text-muted-foreground shadow-[0_1px_2px_rgba(20,27,25,0.04)]">
          {icon}
        </div>
      ) : null}
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      {description ? (
        <p className="mt-1.5 max-w-md text-sm leading-relaxed text-muted-foreground">
          {description}
        </p>
      ) : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

export function ErrorState({
  title = "We could not load this information",
  message,
  onRetry,
  className,
}: {
  title?: string;
  message?: string | null;
  onRetry?: () => void;
  className?: string;
}) {
  return (
    <div
      role="alert"
      className={cn(
        "flex flex-col items-start gap-3 rounded-lg border border-[#f0cdc8] bg-[#fcf2f0] px-4 py-4 sm:flex-row sm:items-center sm:justify-between",
        className,
      )}
    >
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 size-4 shrink-0 text-destructive" />
        <div>
          <p className="text-sm font-semibold text-[#8f2a22]">{title}</p>
          {message ? (
            <p className="mt-0.5 text-sm leading-relaxed text-[#8f2a22]/85">
              {message}
            </p>
          ) : null}
        </div>
      </div>
      {onRetry ? (
        <Button
          variant="outline"
          size="sm"
          onClick={onRetry}
          className="shrink-0 border-[#e8bdb7] bg-white/70 text-[#8f2a22] hover:bg-white"
        >
          <RefreshCw className="size-3.5" />
          Retry
        </Button>
      ) : null}
    </div>
  );
}
