import * as React from "react";

import { cn } from "@/lib/utils/cn";

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "flex min-h-28 w-full rounded-lg border border-input bg-card px-3 py-2.5 text-sm leading-relaxed text-foreground shadow-[0_1px_1px_rgba(20,27,25,0.03)] outline-none transition-[border-color,box-shadow]",
        "placeholder:text-muted-foreground/70",
        "focus-visible:border-primary/60 focus-visible:ring-2 focus-visible:ring-ring/15",
        "disabled:cursor-not-allowed disabled:opacity-50",
        "aria-invalid:border-destructive aria-invalid:ring-2 aria-invalid:ring-destructive/15",
        "resize-y",
        className,
      )}
      {...props}
    />
  );
}

export { Textarea };
