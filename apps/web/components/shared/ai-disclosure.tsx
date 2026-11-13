"use client";

import * as React from "react";
import { ChevronDown, Sparkles } from "lucide-react";

import { cn } from "@/lib/utils/cn";
import { usePreferences } from "@/lib/preferences";

const COPY = {
  analysis:
    "AI-assisted analysis: This result is an informational aid based on the content you submitted. OCR and classification may be inaccurate or incomplete. Review the original evidence and use your judgment. This result does not establish that an incident occurred, identify an offender, or predict future harm.",
  risk: "This score is an experimental review-priority indicator. It is not a probability of crime, danger or future harm. Its values and weights have not been independently validated.",
  ocr: "Extracted text may contain errors. Always compare it with the original image.",
  graph:
    "Suggested relationships indicate content or user-reported similarities. They do not establish that two incidents involve the same person.",
  report:
    "This report includes AI-generated analysis labels. They are informational, may be inaccurate, and are not verified facts or a legal determination.",
} as const;

export type DisclosureVariant = keyof typeof COPY;

export function AiDisclosure({
  variant = "analysis",
  sample = false,
  className,
}: {
  variant?: DisclosureVariant;
  sample?: boolean;
  className?: string;
}) {
  const { preferences } = usePreferences();
  const [open, setOpen] = React.useState(preferences.disclosuresExpanded);

  return (
    <div
      className={cn(
        "rounded-lg border border-[#e2d7bb] bg-[#fbf7ee] px-4 py-3.5 text-[#6d5420]",
        className,
      )}
    >
      <div className="flex items-start gap-3">
        <Sparkles className="mt-0.5 size-4 shrink-0 text-[#8a6a24]" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold">AI-assisted content</p>
            {sample ? (
              <span className="rounded-full border border-[#e2d7bb] bg-white/60 px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.1em]">
                Sample data
              </span>
            ) : null}
          </div>
          <p
            className={cn(
              "mt-1 text-sm leading-relaxed text-[#6d5420]/90",
              !open && "line-clamp-2",
            )}
          >
            {COPY[variant]}
          </p>
          <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            className="mt-1.5 inline-flex cursor-pointer items-center gap-1 text-xs font-medium underline-offset-4 hover:underline"
            aria-expanded={open}
          >
            {open ? "Show less" : "Read full disclosure"}
            <ChevronDown
              className={cn("size-3.5 transition-transform", open && "rotate-180")}
            />
          </button>
        </div>
      </div>
    </div>
  );
}
