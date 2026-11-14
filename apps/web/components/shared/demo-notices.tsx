"use client";

import * as React from "react";
import { FlaskConical, Info, ShieldAlert, WifiOff } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { isMockApiEnabled } from "@/lib/api/config";
import { useAuth } from "@/lib/auth/auth-provider";
import { useOnlineStatus } from "@/lib/hooks/use-online-status";
import { cn } from "@/lib/utils/cn";

export function MockDataBadge({ className }: { className?: string }) {
  if (!isMockApiEnabled) return null;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Badge
          variant="outline"
          className={cn(
            "gap-1.5 border-[#e2d7bb] bg-[#fbf7ee] text-[#74500a]",
            className,
          )}
        >
          <FlaskConical className="size-3" />
          Demo data
        </Badge>
      </TooltipTrigger>
      <TooltipContent>
        Synthetic sample records from the isolated local mock adapter. No live
        backend or real user evidence is involved.
      </TooltipContent>
    </Tooltip>
  );
}

export function DemoModeBanner() {
  const { authConfigured, isDemoSession } = useAuth();
  const showMock = isMockApiEnabled;
  const showAuth = !authConfigured && isDemoSession;

  if (!showMock && !showAuth) return null;

  return (
    <div className="border-b border-[#e8ddc4] bg-[#fbf7ee] px-4 py-2 text-[#6d5420] sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-[1440px] items-start gap-2.5 text-xs leading-relaxed">
        <Info className="mt-0.5 size-3.5 shrink-0" />
        <p>
          {showMock
            ? "Demo data mode: all records are synthetic and come from a local mock adapter. Nothing is uploaded to a backend."
            : null}
          {showMock && showAuth ? " " : null}
          {showAuth
            ? "Supabase authentication is not configured, so this is a clearly labelled local demo session."
            : null}
        </p>
      </div>
    </div>
  );
}

export function OfflineBanner() {
  const online = useOnlineStatus();
  const [wasOffline, setWasOffline] = React.useState(false);

  React.useEffect(() => {
    if (!online) {
      // Remember that this tab went offline so a "restored" notice can appear.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setWasOffline(true);
    }
  }, [online]);

  if (!online) {
    return (
      <div className="border-b border-[#ecd9b4] bg-[#fbf5e9] px-4 py-2 text-[#74500a] sm:px-6 lg:px-8">
        <div className="mx-auto flex max-w-[1440px] items-start gap-2.5 text-xs leading-relaxed">
          <WifiOff className="mt-0.5 size-3.5 shrink-0" />
          <p>
            You are offline. Incident drafts are saved locally and are not
            uploaded. Nothing will sync automatically when you reconnect.
          </p>
        </div>
      </div>
    );
  }

  if (wasOffline) {
    return (
      <div className="border-b border-[#c9e2d3] bg-[#f1f7f3] px-4 py-2 text-[#1a5c3d] sm:px-6 lg:px-8">
        <div className="mx-auto flex max-w-[1440px] items-start gap-2.5 text-xs leading-relaxed">
          <ShieldAlert className="mt-0.5 size-3.5 shrink-0" />
          <p>
            Connection restored. Locally saved drafts are still local — open the
            incident form and submit explicitly to upload.
          </p>
          <button
            type="button"
            onClick={() => setWasOffline(false)}
            className="ml-auto shrink-0 cursor-pointer font-medium underline underline-offset-4"
          >
            Dismiss
          </button>
        </div>
      </div>
    );
  }

  return null;
}
