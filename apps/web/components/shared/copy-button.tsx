"use client";

import * as React from "react";
import { Check, Copy } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils/cn";

export function CopyButton({
  value,
  label = "Copy",
  className,
}: {
  value: string;
  label?: string;
  className?: string;
}) {
  const [copied, setCopied] = React.useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      toast.success("Copied to clipboard");
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      toast.error("Could not copy. Select the value and copy it manually.");
    }
  };

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      onClick={copy}
      className={cn("text-muted-foreground hover:text-foreground", className)}
      aria-label={copied ? "Copied" : label}
    >
      {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
    </Button>
  );
}
