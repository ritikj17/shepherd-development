"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, HelpCircle, ShieldAlert, VolumeX } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import type { VerificationRecord } from "@/lib/types/sentinel";

interface SafetyVerificationModalProps {
  open: boolean;
  verification: VerificationRecord | null;
  onRespond: (response: "safe" | "help_requested" | "cannot_respond", note?: string) => Promise<void>;
}

export function SafetyVerificationModal({
  open,
  verification,
  onRespond,
}: SafetyVerificationModalProps) {
  const [secondsRemaining, setSecondsRemaining] = useState<number>(60);
  const [totalSeconds, setTotalSeconds] = useState<number>(60);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open || !verification) return;

    // Calculate deadline delta
    const deadlineMs = new Date(verification.deadline).getTime();
    const nowMs = Date.now();
    const remaining = Math.max(1, Math.round((deadlineMs - nowMs) / 1000));
    setTotalSeconds(remaining > 0 ? remaining : 60);
    setSecondsRemaining(remaining > 0 ? remaining : 60);

    // Haptic buzz on prompt opening if supported
    if (typeof window !== "undefined" && "vibrate" in navigator) {
      try {
        navigator.vibrate([150, 100, 150]);
      } catch {
        // Ignore haptic errors on restricted platforms
      }
    }

    const interval = setInterval(() => {
      setSecondsRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          // Auto-escalate on timer expiry
          onRespond("cannot_respond", "Safety verification timed out with no user response.");
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [open, verification, onRespond]);

  const handleAction = async (response: "safe" | "help_requested" | "cannot_respond") => {
    setSubmitting(true);
    try {
      await onRespond(response);
    } finally {
      setSubmitting(false);
    }
  };

  const progressPercent = Math.max(0, Math.min(100, (secondsRemaining / totalSeconds) * 100));

  return (
    <Dialog open={open}>
      <DialogContent
        className="border-amber-200 bg-amber-50/95 sm:max-w-md dark:border-amber-900 dark:bg-zinc-900"
        onEscapeKeyDown={(e) => e.preventDefault()}
        onPointerDownOutside={(e) => e.preventDefault()}
      >
        <DialogHeader className="space-y-3 text-center sm:text-left">
          <div className="flex items-center gap-3">
            <div className="flex size-12 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400">
              <AlertTriangle className="size-6 animate-pulse" />
            </div>
            <div>
              <DialogTitle className="text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
                Safety Verification Check
              </DialogTitle>
              <DialogDescription className="text-xs text-zinc-600 dark:text-zinc-400">
                Sentinel detected a journey anomaly. Please confirm your status.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="rounded-lg border border-amber-200/80 bg-white/80 p-3.5 text-sm font-medium text-zinc-800 shadow-xs dark:border-zinc-800 dark:bg-zinc-800/80 dark:text-zinc-200">
            {verification?.prompt ||
              "Your journey seems different from your planned route. Are you safe?"}
          </div>

          <div className="space-y-1.5">
            <div className="flex justify-between text-xs font-semibold text-zinc-600 dark:text-zinc-400">
              <span>Auto-escalating to trusted contacts in:</span>
              <span className="font-mono text-amber-700 dark:text-amber-400">
                {secondsRemaining}s
              </span>
            </div>
            <Progress value={progressPercent} className="h-2 bg-amber-200/60 dark:bg-zinc-800" />
          </div>

          <div className="grid gap-2.5 pt-2">
            <Button
              type="button"
              size="lg"
              className="h-13 bg-emerald-600 text-base font-semibold text-white hover:bg-emerald-700 active:scale-[0.99] dark:bg-emerald-700 dark:hover:bg-emerald-600"
              disabled={submitting}
              onClick={() => handleAction("safe")}
            >
              <CheckCircle2 className="mr-2 size-5" />
              I&apos;M SAFE — All Good
            </Button>

            <Button
              type="button"
              variant="destructive"
              size="lg"
              className="h-13 bg-rose-600 text-base font-semibold text-white hover:bg-rose-700 active:scale-[0.99] dark:bg-rose-700 dark:hover:bg-rose-600"
              disabled={submitting}
              onClick={() => handleAction("help_requested")}
            >
              <ShieldAlert className="mr-2 size-5" />
              I NEED HELP — Alert Contacts
            </Button>

            <Button
              type="button"
              variant="outline"
              size="lg"
              className="h-11 border-zinc-300 text-sm font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
              disabled={submitting}
              onClick={() => handleAction("cannot_respond")}
            >
              <VolumeX className="mr-2 size-4 text-zinc-500" />
              I Cannot Respond (Silent Distress)
            </Button>
          </div>
        </div>

        <DialogFooter className="sm:justify-center">
          <p className="text-center text-[11px] text-zinc-500 dark:text-zinc-500">
            If you do not respond, SHEPHERD will automatically dispatch an emergency rescue relay to your designated SafeCircle contacts.
          </p>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
