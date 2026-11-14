import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils/cn";

const alertVariants = cva(
  "relative flex w-full gap-3 rounded-lg border px-4 py-3.5 text-sm [&>svg]:mt-0.5 [&>svg]:size-4 [&>svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "border-border bg-card text-foreground",
        muted: "border-border bg-muted/60 text-foreground",
        info: "border-[#cfdcee] bg-[#f2f6fb] text-[#1f456f] [&>svg]:text-[#3c6495]",
        success:
          "border-[#c9e2d3] bg-[#f1f7f3] text-[#1a5c3d] [&>svg]:text-[#1c6b47]",
        warning:
          "border-[#ecd9b4] bg-[#fbf5e9] text-[#74500a] [&>svg]:text-[#8a5a00]",
        destructive:
          "border-[#f0cdc8] bg-[#fcf2f0] text-[#8f2a22] [&>svg]:text-[#b3261e]",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

function Alert({
  className,
  variant,
  ...props
}: React.ComponentProps<"div"> & VariantProps<typeof alertVariants>) {
  return (
    <div
      data-slot="alert"
      role="alert"
      className={cn(alertVariants({ variant }), className)}
      {...props}
    />
  );
}

function AlertTitle({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-title"
      className={cn("text-sm font-semibold leading-snug", className)}
      {...props}
    />
  );
}

function AlertDescription({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-description"
      className={cn("text-sm leading-relaxed opacity-90", className)}
      {...props}
    />
  );
}

export { Alert, AlertDescription, AlertTitle };
