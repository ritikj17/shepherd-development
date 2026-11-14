"use client";

import { useEffect, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Copy,
  ExternalLink,
  Flame,
  Link,
  MessageCircle,
  MessageSquare,
  Phone,
  PhoneCall,
  RefreshCw,
  Send,
  Share2,
  ShieldAlert,
  UserCheck,
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { listTrustedContacts } from "@/lib/api/safety";
import { getLiveTimeline, getRelayDetails } from "@/lib/api/sentinel";
import type { TrustedContact } from "@/lib/types/api";
import type { ContactRelayData, LiveIncidentEvent } from "@/lib/types/sentinel";
import { QuickEvidenceRecorder } from "./quick-evidence-recorder";

interface LiveIncidentViewProps {
  incidentId: string;
  relayToken?: string | null;
  onConclude?: () => void;
}

export function LiveIncidentView({
  incidentId,
  relayToken,
  onConclude,
}: LiveIncidentViewProps) {
  const [timeline, setTimeline] = useState<LiveIncidentEvent[]>([]);
  const [relayData, setRelayData] = useState<ContactRelayData | null>(null);
  const [contacts, setContacts] = useState<TrustedContact[]>([]);
  const [overridePhones, setOverridePhones] = useState<Record<string, string>>({});
  const [copied, setCopied] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    async function loadContacts() {
      try {
        const res = await listTrustedContacts();
        setContacts(res.items || []);
      } catch {
        // Soft fail
      }
    }
    loadContacts();
  }, []);

  const fetchTimelineAndRelay = async () => {
    setRefreshing(true);
    try {
      const tl = await getLiveTimeline({ incidentId });
      setTimeline(tl.items);

      if (relayToken) {
        const rd = await getRelayDetails(relayToken);
        setRelayData(rd);
      }
    } catch {
      // Soft fail
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchTimelineAndRelay();
    const interval = setInterval(fetchTimelineAndRelay, 5000);
    return () => clearInterval(interval);
  }, [incidentId, relayToken]);

  const copyRelayLink = async () => {
    if (!relayToken) return;
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const url = `${origin}/relay/${relayToken}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Fallback
    }
  };

  return (
    <div className="space-y-4">
      {/* High-Contrast Live Emergency Status Banner */}
      <div className="rounded-xl border-2 border-rose-600 bg-rose-50 p-4 shadow-md dark:border-rose-500 dark:bg-rose-950/60">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex size-11 items-center justify-center rounded-full bg-rose-600 text-white animate-pulse">
              <Flame className="size-6" />
            </div>
            <div>
              <h2 className="text-lg font-black tracking-tight text-rose-950 dark:text-rose-100">
                LIVE INCIDENT DISTRESS ACTIVE
              </h2>
              <p className="text-xs text-rose-800 dark:text-rose-300">
                Incident ID: {incidentId.slice(0, 8)} &bull; Rescue Relay Coordinated
              </p>
            </div>
          </div>

          <Badge className="bg-rose-600 text-white hover:bg-rose-700">
            ESCALATED
          </Badge>
        </div>
      </div>

      {/* Emergency Action Panel (112, 181, Dialers) */}
      <Card className="border-rose-200 bg-white shadow-xs dark:border-rose-900/60 dark:bg-zinc-950">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <PhoneCall className="size-5 text-rose-600 dark:text-rose-400" />
              <CardTitle className="text-base font-bold">Emergency Action Panel</CardTitle>
            </div>
            <span className="text-[10px] font-semibold text-rose-600 uppercase tracking-wider">
              Immediate Assistance
            </span>
          </div>
          <CardDescription className="text-xs">
            Direct tap opens your native phone dialer with verified Indian emergency support services.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            {/* 112 ERSS */}
            <a
              href="tel:112"
              className="flex items-center justify-between rounded-lg border border-rose-300 bg-linear-to-r from-rose-50 to-red-50 p-3.5 transition-all hover:bg-rose-100 active:scale-[0.98] dark:border-rose-900/80 dark:from-zinc-900 dark:to-rose-950/40"
            >
              <div>
                <div className="text-base font-bold text-rose-900 dark:text-rose-200">
                  Call 112 (ERSS Emergency)
                </div>
                <div className="text-[11px] text-zinc-600 dark:text-zinc-400">
                  Police, Fire & Ambulance India
                </div>
              </div>
              <PhoneCall className="size-5 text-rose-600 animate-bounce" />
            </a>

            {/* 181 Women Helpline */}
            <a
              href="tel:181"
              className="flex items-center justify-between rounded-lg border border-purple-300 bg-linear-to-r from-purple-50 to-fuchsia-50 p-3.5 transition-all hover:bg-purple-100 active:scale-[0.98] dark:border-purple-900/80 dark:from-zinc-900 dark:to-purple-950/40"
            >
              <div>
                <div className="text-base font-bold text-purple-900 dark:text-purple-200">
                  Call 181 (Women Helpline)
                </div>
                <div className="text-[11px] text-zinc-600 dark:text-zinc-400">
                  24/7 National Distress Helpline
                </div>
              </div>
              <PhoneCall className="size-5 text-purple-600" />
            </a>
          </div>

          <p className="text-[10px] text-zinc-500 italic">
            Disclaimer: Selecting an emergency line opens your phone dialer. SHEPHERD does not automatically dispatch emergency authorities.
          </p>
        </CardContent>
      </Card>

      {/* Direct Dispatch to Trusted Contacts (WhatsApp, SMS, Call) */}
      {contacts.length > 0 && relayToken && (
        <Card className="border-emerald-200 bg-emerald-50/50 shadow-xs dark:border-emerald-900/60 dark:bg-emerald-950/20">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Send className="size-4 text-emerald-700 dark:text-emerald-400" />
                <CardTitle className="text-sm font-bold text-emerald-950 dark:text-emerald-100">
                  Direct Dispatch to Trusted Contacts
                </CardTitle>
              </div>
              <Badge className="bg-emerald-600 text-white text-[10px]">Instant 1-Tap</Badge>
            </div>
            <CardDescription className="text-xs text-emerald-900/80 dark:text-emerald-300/80">
              Deliver your emergency rescue relay link directly to your contact&apos;s phone via WhatsApp or native phone SMS without carrier gateway delays.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-3">
            {contacts.map((c) => {
              const origin = typeof window !== "undefined" ? window.location.origin : "http://localhost:3000";
              const relayLink = `${origin}/relay/${relayToken}`;
              const emergencyMsg = `🚨 EMERGENCY ALERT: I have triggered a distress signal in SHEPHERD. Please open my live GPS location and confirm you are responding:\n${relayLink}`;
              const phone = overridePhones[c.id] !== undefined ? overridePhones[c.id] : (c.contact_value || "");
              const cleanDigits = phone.replace(/[^0-9]/g, "");
              const phoneWithCountry = cleanDigits.length === 10 ? `91${cleanDigits}` : cleanDigits;
              const waLink = phoneWithCountry ? `https://wa.me/${phoneWithCountry}?text=${encodeURIComponent(emergencyMsg)}` : `https://wa.me/?text=${encodeURIComponent(emergencyMsg)}`;
              const smsLink = phone ? `sms:${phone}?body=${encodeURIComponent(emergencyMsg)}` : `sms:?body=${encodeURIComponent(emergencyMsg)}`;
              const callLink = phone ? `tel:${phone}` : `tel:`;

              return (
                <div
                  key={c.id}
                  className="rounded-lg border border-emerald-200 bg-white p-3 shadow-xs dark:border-emerald-800 dark:bg-zinc-900"
                >
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <span className="font-bold text-sm text-zinc-900 dark:text-zinc-100">
                        {c.name}
                      </span>
                      {phone && (
                        <span className="ml-2 font-mono text-xs text-zinc-500">
                          {phone}
                        </span>
                      )}
                    </div>
                    <Badge variant="outline" className="border-emerald-300 text-emerald-700 dark:border-emerald-700 dark:text-emerald-300 text-[10px]">
                      Primary SafeCircle Contact
                    </Badge>
                  </div>

                  {!c.contact_value && (
                    <div className="mb-2">
                      <input
                        type="tel"
                        placeholder="Enter phone number (e.g. +91 98765 43210)"
                        value={overridePhones[c.id] || ""}
                        onChange={(e) => setOverridePhones((prev) => ({ ...prev, [c.id]: e.target.value }))}
                        className="h-8 w-full rounded border border-zinc-300 px-2 text-xs text-zinc-900 focus:outline-emerald-600 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                      />
                    </div>
                  )}

                  <div className="grid grid-cols-3 gap-2">
                    <a
                      href={waLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex h-9 items-center justify-center gap-1.5 rounded-md bg-emerald-600 px-3 text-xs font-semibold text-white hover:bg-emerald-700 active:scale-[0.98]"
                    >
                      <MessageCircle className="size-3.5" />
                      <span>WhatsApp</span>
                    </a>

                    <a
                      href={smsLink}
                      className="inline-flex h-9 items-center justify-center gap-1.5 rounded-md bg-sky-600 px-3 text-xs font-semibold text-white hover:bg-sky-700 active:scale-[0.98]"
                    >
                      <MessageSquare className="size-3.5" />
                      <span>Phone SMS</span>
                    </a>

                    <a
                      href={callLink}
                      className="inline-flex h-9 items-center justify-center gap-1.5 rounded-md border border-zinc-300 bg-white px-3 text-xs font-semibold text-zinc-800 hover:bg-zinc-100 active:scale-[0.98] dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-700"
                    >
                      <Phone className="size-3.5 text-zinc-600 dark:text-zinc-300" />
                      <span>Call</span>
                    </a>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* Public Rescue Relay Link & Contact Acknowledgment */}
      {relayToken && (
        <Card className="border-amber-200 bg-amber-50/60 dark:border-amber-900/50 dark:bg-amber-950/20">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Share2 className="size-4 text-amber-700 dark:text-amber-400" />
                <CardTitle className="text-sm font-semibold text-amber-950 dark:text-amber-100">
                  Public Rescue Relay Status
                </CardTitle>
              </div>

              <Badge
                variant={relayData?.status === "acknowledged" ? "default" : "secondary"}
                className={
                  relayData?.status === "acknowledged"
                    ? "bg-emerald-600 text-white"
                    : "bg-amber-200 text-amber-900 dark:bg-amber-900 dark:text-amber-200"
                }
              >
                {relayData?.status === "acknowledged" ? "CONTACT RESPONDING" : "AWAITING RESPONSE"}
              </Badge>
            </div>
            <CardDescription className="text-xs text-amber-900/80 dark:text-amber-300/80">
              Trusted contacts receive a secure tokenized link to view live coordinates and acknowledge assistance.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-3">
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-9 flex-1 border-amber-300 bg-white font-mono text-xs dark:border-amber-800 dark:bg-zinc-900"
                onClick={copyRelayLink}
              >
                {copied ? (
                  <>
                    <CheckCircle2 className="mr-1.5 size-3.5 text-emerald-600" />
                    Copied Rescue Relay Link!
                  </>
                ) : (
                  <>
                    <Copy className="mr-1.5 size-3.5 text-amber-700" />
                    Copy Rescue Relay Link (/relay/{relayToken.slice(0, 8)}...)
                  </>
                )}
              </Button>

              <a
                href={`/relay/${relayToken}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex h-9 items-center justify-center rounded-md border border-amber-300 bg-white px-3 text-xs font-medium text-amber-900 hover:bg-amber-100 dark:border-amber-800 dark:bg-zinc-900 dark:text-amber-200"
              >
                <ExternalLink className="size-3.5" />
              </a>
            </div>

            {relayData?.status === "acknowledged" && (
              <div className="rounded-md border border-emerald-300 bg-emerald-50 p-2.5 text-xs text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200">
                <div className="flex items-center gap-1.5 font-semibold">
                  <UserCheck className="size-4 text-emerald-600" />
                  <span>Acknowledged by: {relayData.acknowledged_by || "Trusted Contact"}</span>
                </div>
                {relayData.relay_notes && (
                  <p className="mt-1 text-[11px] text-zinc-700 dark:text-zinc-300">
                    &ldquo;{relayData.relay_notes}&rdquo;
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Quick Evidence Capture during Live Distress */}
      <QuickEvidenceRecorder
        incidentId={incidentId}
        onEvidenceCaptured={() => fetchTimelineAndRelay()}
      />

      {/* Unified Live Incident Timeline */}
      <Card className="border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-semibold">Live Incident Timeline</CardTitle>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 text-xs text-zinc-500"
              disabled={refreshing}
              onClick={fetchTimelineAndRelay}
            >
              <RefreshCw className={`mr-1 size-3.5 ${refreshing ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>
          <CardDescription className="text-xs">
            Chronological audit trail of distress pings, location changes, evidence submissions, and contact acknowledgements.
          </CardDescription>
        </CardHeader>

        <CardContent>
          {timeline.length === 0 ? (
            <div className="py-6 text-center text-xs text-zinc-500">
              No live timeline events recorded yet.
            </div>
          ) : (
            <div className="relative space-y-3 pl-4 before:absolute before:top-2 before:bottom-2 before:left-1.5 before:w-0.5 before:bg-zinc-200 dark:before:bg-zinc-800">
              {timeline.map((ev) => (
                <div key={ev.id} className="relative pl-3">
                  <span
                    className={`absolute top-1 -left-2 size-2.5 rounded-full ring-2 ring-white dark:ring-zinc-950 ${
                      ev.status === "distress"
                        ? "bg-rose-600"
                        : ev.status === "warning"
                          ? "bg-amber-500"
                          : ev.status === "success"
                            ? "bg-emerald-600"
                            : "bg-blue-500"
                    }`}
                  />
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                      {ev.title}
                    </span>
                    <span className="font-mono text-[10px] text-zinc-500">
                      {new Date(ev.timestamp).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                        second: "2-digit",
                      })}
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs text-zinc-600 dark:text-zinc-400">
                    {ev.description}
                  </p>
                </div>
              ))}
            </div>
          )}

          {onConclude && (
            <div className="pt-4 border-t border-zinc-100 dark:border-zinc-800 mt-4">
              <Button
                type="button"
                variant="outline"
                className="w-full text-xs text-zinc-600 hover:text-zinc-900"
                onClick={onConclude}
              >
                Conclude Live Incident Session
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
