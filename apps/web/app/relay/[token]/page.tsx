"use client";

import { use, useEffect, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  ExternalLink,
  MapPin,
  PhoneCall,
  Send,
  ShieldAlert,
  UserCheck,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { acknowledgeRelay, getRelayDetails } from "@/lib/api/sentinel";
import type { ContactRelayData } from "@/lib/types/sentinel";

interface RelayPageProps {
  params: Promise<{ token: string }>;
}

export default function RescueRelayPage({ params }: RelayPageProps) {
  const resolvedParams = use(params);
  const token = resolvedParams.token;

  const [relayData, setRelayData] = useState<ContactRelayData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Form
  const [responderName, setResponderName] = useState("");
  const [responderNote, setResponderNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [acknowledged, setAcknowledged] = useState(false);

  useEffect(() => {
    async function loadRelay() {
      try {
        const data = await getRelayDetails(token);
        setRelayData(data);
        if (data.status === "acknowledged") {
          setAcknowledged(true);
        }
      } catch (err: unknown) {
        setError(
          err instanceof Error ? err.message : "This emergency alert link is invalid or has expired.",
        );
      } finally {
        setLoading(false);
      }
    }
    loadRelay();
  }, [token]);

  const handleAcknowledge = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!responderName.trim()) return;
    setSubmitting(true);
    try {
      const updated = await acknowledgeRelay(token, {
        responder_name: responderName.trim(),
        responder_note: responderNote.trim() || undefined,
      });
      setRelayData(updated);
      setAcknowledged(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to record acknowledgement.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-50 p-4 dark:bg-zinc-950">
        <div className="text-center space-y-2">
          <ShieldAlert className="size-8 animate-pulse text-rose-600 mx-auto" />
          <p className="text-sm font-medium text-zinc-600 dark:text-zinc-400">
            Loading SHEPHERD Rescue Relay...
          </p>
        </div>
      </div>
    );
  }

  if (error || !relayData) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-50 p-4 dark:bg-zinc-950">
        <Card className="max-w-md w-full border-zinc-200 dark:border-zinc-800">
          <CardHeader>
            <div className="flex items-center gap-2 text-rose-600">
              <AlertCircle className="size-5" />
              <CardTitle className="text-base">Alert Unavailable</CardTitle>
            </div>
            <CardDescription className="text-xs">
              {error || "This safety alert link has expired or was revoked."}
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const mapUrl = relayData.last_location
    ? `https://www.google.com/maps/search/?api=1&query=${relayData.last_location.latitude},${relayData.last_location.longitude}`
    : null;

  return (
    <div className="min-h-screen bg-zinc-100/60 p-4 sm:p-8 dark:bg-zinc-950">
      <div className="mx-auto max-w-lg space-y-4">
        {/* Header Banner */}
        <div className="rounded-xl border border-rose-300 bg-linear-to-b from-rose-50 to-white p-4 shadow-sm dark:border-rose-900 dark:from-zinc-900 dark:to-zinc-950">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="flex size-10 items-center justify-center rounded-full bg-rose-600 text-white">
                <ShieldAlert className="size-5" />
              </div>
              <div>
                <h1 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
                  SHEPHERD Rescue Relay
                </h1>
                <p className="text-xs text-zinc-600 dark:text-zinc-400">
                  Emergency alert coordination for trusted contacts
                </p>
              </div>
            </div>

            <Badge
              variant={acknowledged ? "default" : "destructive"}
              className={acknowledged ? "bg-emerald-600 text-white" : "bg-rose-600 text-white animate-pulse"}
            >
              {acknowledged ? "ACKNOWLEDGED" : "ACTION REQUIRED"}
            </Badge>
          </div>
        </div>

        {/* User Alert Details */}
        <Card className="border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold">Distress Signal Details</CardTitle>
            <CardDescription className="text-xs">
              A safety alert was triggered for <span className="font-semibold text-zinc-900 dark:text-zinc-100">{relayData.user_display_name}</span>.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-3">
            <div className="rounded-md border border-zinc-100 bg-zinc-50 p-3 text-xs dark:border-zinc-800 dark:bg-zinc-950">
              <div className="font-semibold text-zinc-800 dark:text-zinc-200">Alert Reason:</div>
              <p className="mt-0.5 text-zinc-600 dark:text-zinc-400">{relayData.reason}</p>

              <div className="mt-2 flex items-center gap-1.5 text-[11px] text-zinc-500">
                <Clock className="size-3.5" />
                <span>Triggered at: {new Date(relayData.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
              </div>
            </div>

            {relayData.last_location && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-zinc-800 dark:text-zinc-200 flex items-center gap-1">
                    <MapPin className="size-3.5 text-rose-600" />
                    Last Known Location:
                  </span>
                  <span className="font-mono text-[11px] text-zinc-500">
                    {relayData.last_location.latitude.toFixed(5)}, {relayData.last_location.longitude.toFixed(5)}
                  </span>
                </div>

                {mapUrl && (
                  <a
                    href={mapUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex h-10 w-full items-center justify-center gap-2 rounded-md bg-zinc-900 text-xs font-semibold text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
                  >
                    <ExternalLink className="size-3.5" />
                    Open in Google Maps
                  </a>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Contact Acknowledgement Section */}
        <Card className="border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <UserCheck className="size-4 text-emerald-600" />
              <CardTitle className="text-sm font-semibold">
                {acknowledged ? "Response Recorded" : "Confirm You Are Responding"}
              </CardTitle>
            </div>
            <CardDescription className="text-xs">
              {acknowledged
                ? "Your acknowledgement has been logged. The user can see you are responding."
                : "Let the user and the system know that you have seen this alert."}
            </CardDescription>
          </CardHeader>

          <CardContent>
            {acknowledged ? (
              <div className="rounded-lg border border-emerald-200 bg-emerald-50/70 p-3.5 dark:border-emerald-900 dark:bg-emerald-950/40">
                <div className="flex items-center gap-2 text-xs font-bold text-emerald-900 dark:text-emerald-200">
                  <CheckCircle2 className="size-4 text-emerald-600" />
                  <span>Acknowledged by {relayData.acknowledged_by || responderName}</span>
                </div>
                {relayData.relay_notes && (
                  <p className="mt-1 text-xs text-zinc-700 dark:text-zinc-300">
                    &ldquo;{relayData.relay_notes}&rdquo;
                  </p>
                )}
                <p className="mt-2 text-[10px] text-emerald-800 dark:text-emerald-400">
                  Timeline updated in real-time. Thank you for coordinating safety.
                </p>
              </div>
            ) : (
              <form onSubmit={handleAcknowledge} className="space-y-3">
                <div className="space-y-1">
                  <Label htmlFor="responderName" className="text-xs font-semibold">
                    Your Name (as known to user)
                  </Label>
                  <Input
                    id="responderName"
                    placeholder="e.g. Pooja Sharma, Mom, Rahul"
                    value={responderName}
                    onChange={(e) => setResponderName(e.target.value)}
                    required
                  />
                </div>

                <div className="space-y-1">
                  <Label htmlFor="responderNote" className="text-xs font-semibold">
                    Status Message / Note (Optional)
                  </Label>
                  <Textarea
                    id="responderNote"
                    placeholder="e.g., I am calling you now / I am on my way to your location."
                    value={responderNote}
                    onChange={(e) => setResponderNote(e.target.value)}
                    rows={2}
                  />
                </div>

                <Button
                  type="submit"
                  className="w-full bg-emerald-600 text-xs font-semibold text-white hover:bg-emerald-700 active:scale-[0.99]"
                  disabled={submitting}
                >
                  <Send className="mr-1.5 size-3.5" />
                  {submitting ? "Confirming..." : "Acknowledge & Confirm Assistance"}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>

        {/* Emergency Calling fallback */}
        <div className="rounded-lg border border-zinc-200 bg-white p-3 text-center dark:border-zinc-800 dark:bg-zinc-900">
          <p className="text-xs text-zinc-600 dark:text-zinc-400">
            If you cannot reach them or believe they are in immediate danger:
          </p>
          <div className="mt-2 flex justify-center gap-2">
            <a
              href="tel:112"
              className="inline-flex items-center gap-1.5 rounded-md bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-rose-700"
            >
              <PhoneCall className="size-3.5" />
              Call 112 (Police)
            </a>
            <a
              href="tel:181"
              className="inline-flex items-center gap-1.5 rounded-md bg-purple-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-purple-700"
            >
              <PhoneCall className="size-3.5" />
              Call 181 (Helpline)
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
