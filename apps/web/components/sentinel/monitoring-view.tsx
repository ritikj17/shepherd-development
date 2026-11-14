"use client";

import { useEffect, useRef, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  Compass,
  Gauge,
  Navigation,
  Pause,
  Play,
  Radio,
  ShieldAlert,
  StopCircle,
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  pauseSentinelSession,
  respondToVerification,
  resumeSentinelSession,
  sendSentinelLocation,
  stopSentinelSession,
  triggerSilentAssist,
} from "@/lib/api/sentinel";
import type { LocationUpdateInput, SentinelSession, VerificationRecord } from "@/lib/types/sentinel";
import { QuickEvidenceRecorder } from "./quick-evidence-recorder";
import { SafetyVerificationModal } from "./safety-verification-modal";

interface MonitoringViewProps {
  session: SentinelSession;
  onSessionUpdated: (session: SentinelSession | null) => void;
  onDistressActivated?: (incidentId: string, relayToken?: string) => void;
}

export function MonitoringView({
  session,
  onSessionUpdated,
  onDistressActivated,
}: MonitoringViewProps) {
  const [currentSession, setCurrentSession] = useState<SentinelSession>(session);
  const [gpsStatus, setGpsStatus] = useState<"searching" | "active" | "denied" | "error">("searching");
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [lastCoords, setLastCoords] = useState<{ lat: number; lng: number; acc?: number; speed?: number } | null>(
    session.last_location
      ? {
          lat: session.last_location.latitude,
          lng: session.last_location.longitude,
          acc: session.last_location.accuracy,
          speed: session.last_location.speed,
        }
      : null,
  );
  const [verificationModalOpen, setVerificationModalOpen] = useState<boolean>(
    Boolean(session.active_verification),
  );
  const [activeVerification, setActiveVerification] = useState<VerificationRecord | null>(
    session.active_verification || null,
  );
  const [actionLoading, setActionLoading] = useState(false);

  const watchIdRef = useRef<number | null>(null);
  const lastPingTimeRef = useRef<number>(0);

  // Sync props to state
  useEffect(() => {
    setCurrentSession(session);
    if (session.active_verification) {
      setActiveVerification(session.active_verification);
      setVerificationModalOpen(true);
    }
  }, [session]);

  // Setup foreground watchPosition
  useEffect(() => {
    if (currentSession.status !== "active") {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      return;
    }

    if (!("geolocation" in navigator)) {
      setGpsStatus("error");
      setGpsError("Geolocation API is not supported by your browser.");
      return;
    }

    setGpsStatus("searching");

    watchIdRef.current = navigator.geolocation.watchPosition(
      async (pos) => {
        setGpsStatus("active");
        setGpsError(null);
        const { latitude, longitude, accuracy, speed, heading } = pos.coords;
        setLastCoords({
          lat: latitude,
          lng: longitude,
          acc: accuracy,
          speed: speed ?? undefined,
        });

        // Throttle backend ingestion to once every 6 seconds to avoid excessive network traffic
        const now = Date.now();
        if (now - lastPingTimeRef.current >= 6000) {
          lastPingTimeRef.current = now;
          try {
            const updateInput: LocationUpdateInput = {
              latitude,
              longitude,
              accuracy,
              speed: speed ?? undefined,
              heading: heading ?? undefined,
              is_simulated: false,
            };
            const ingestRes = await sendSentinelLocation(currentSession.id, updateInput);

            if (ingestRes.verification_required && ingestRes.verification) {
              setActiveVerification(ingestRes.verification);
              setVerificationModalOpen(true);
            }

            setCurrentSession((prev) => ({
              ...prev,
              concern_level: ingestRes.concern_level,
              active_anomaly: ingestRes.anomaly ?? prev.active_anomaly,
              active_verification: ingestRes.verification ?? prev.active_verification,
            }));
          } catch {
            // Soft fail on background network hiccups
          }
        }
      },
      (err) => {
        if (err.code === err.PERMISSION_DENIED) {
          setGpsStatus("denied");
          setGpsError("Location permission denied. Please enable location permissions in browser settings.");
        } else {
          setGpsStatus("error");
          setGpsError(err.message || "Unable to acquire GPS coordinates.");
        }
      },
      {
        enableHighAccuracy: true,
        maximumAge: 5000,
        timeout: 12000,
      },
    );

    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
    };
  }, [currentSession.id, currentSession.status]);

  const handlePause = async () => {
    setActionLoading(true);
    try {
      const paused = await pauseSentinelSession(currentSession.id);
      setCurrentSession(paused);
      onSessionUpdated(paused);
    } finally {
      setActionLoading(false);
    }
  };

  const handleResume = async () => {
    setActionLoading(true);
    try {
      const resumed = await resumeSentinelSession(currentSession.id);
      setCurrentSession(resumed);
      onSessionUpdated(resumed);
    } finally {
      setActionLoading(false);
    }
  };

  const handleStop = async () => {
    setActionLoading(true);
    try {
      const stopped = await stopSentinelSession(currentSession.id, "completed");
      setCurrentSession(stopped);
      onSessionUpdated(null);
    } finally {
      setActionLoading(false);
    }
  };

  const handleVerificationRespond = async (
    response: "safe" | "help_requested" | "cannot_respond",
    note?: string,
  ) => {
    if (!activeVerification) return;
    try {
      await respondToVerification(currentSession.id, activeVerification.id, {
        response,
        user_note: note,
      });

      setVerificationModalOpen(false);
      setActiveVerification(null);

      if (response === "safe") {
        setCurrentSession((prev) => ({
          ...prev,
          concern_level: "normal",
          active_anomaly: null,
          active_verification: null,
        }));
      } else {
        // Distress triggered
        const distress = await triggerSilentAssist({
          session_id: currentSession.id,
          current_lat: lastCoords?.lat,
          current_lng: lastCoords?.lng,
          accuracy: lastCoords?.acc,
          haptic_confirmed: true,
        });
        onDistressActivated?.(distress.incident_id, distress.relay_token);
      }
    } catch {
      setVerificationModalOpen(false);
    }
  };

  const handleSilentAssist = async () => {
    if (typeof window !== "undefined" && "vibrate" in navigator) {
      try {
        navigator.vibrate([200, 100, 200, 100, 300]);
      } catch {
        // Ignore
      }
    }
    setActionLoading(true);
    try {
      const distress = await triggerSilentAssist({
        session_id: currentSession.id,
        current_lat: lastCoords?.lat,
        current_lng: lastCoords?.lng,
        accuracy: lastCoords?.acc,
        haptic_confirmed: true,
      });
      onDistressActivated?.(distress.incident_id, distress.relay_token);
    } finally {
      setActionLoading(false);
    }
  };

  const speedKmh = lastCoords?.speed ? Math.round(lastCoords.speed * 3.6) : 0;
  const etaDate = new Date(currentSession.expected_arrival);
  const minutesToEta = Math.max(0, Math.round((etaDate.getTime() - Date.now()) / 60000));

  return (
    <div className="space-y-4">
      {/* Honest PWA Transparency Alert */}
      <Alert className="border-sky-200 bg-sky-50 text-sky-900 dark:border-sky-900 dark:bg-sky-950/40 dark:text-sky-200">
        <Radio className="size-4 animate-pulse text-sky-600 dark:text-sky-400" />
        <AlertTitle className="text-xs font-semibold">Foreground Safety Monitoring Active</AlertTitle>
        <AlertDescription className="text-xs text-sky-800 dark:text-sky-300">
          SHEPHERD monitors your journey while this app is in the foreground. Web browsers do not permit continuous GPS tracking when minimized or closed.
        </AlertDescription>
      </Alert>

      {/* Main Monitoring Card */}
      <Card className="border-zinc-200 bg-white shadow-xs dark:border-zinc-800 dark:bg-zinc-950">
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <div className="flex items-center gap-2">
                <Navigation className="size-4 text-emerald-600 animate-spin" style={{ animationDuration: "8s" }} />
                <CardTitle className="text-lg font-bold">
                  Heading to {currentSession.destination_name}
                </CardTitle>
              </div>
              <CardDescription className="text-xs text-zinc-500">
                Mode: {currentSession.travel_mode.toUpperCase()} &bull; Corridor Radius: 200m
              </CardDescription>
            </div>

            <div className="flex items-center gap-2">
              <Badge
                variant={currentSession.status === "active" ? "default" : "secondary"}
                className={
                  currentSession.status === "active"
                    ? "bg-emerald-600 text-white"
                    : "bg-zinc-200 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-200"
                }
              >
                {currentSession.status.toUpperCase()}
              </Badge>

              <Badge
                variant={
                  currentSession.concern_level === "normal"
                    ? "outline"
                    : currentSession.concern_level === "advisory"
                      ? "secondary"
                      : "destructive"
                }
              >
                Concern: {currentSession.concern_level.toUpperCase()}
              </Badge>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Telemetry Metrics */}
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
            <div className="rounded-lg border border-zinc-100 bg-zinc-50 p-2.5 text-center dark:border-zinc-800 dark:bg-zinc-900">
              <div className="flex items-center justify-center gap-1 text-[11px] text-zinc-500">
                <Compass className="size-3.5 text-zinc-400" />
                <span>GPS Status</span>
              </div>
              <div className="mt-1 font-semibold text-xs capitalize text-zinc-800 dark:text-zinc-200">
                {gpsStatus}
              </div>
            </div>

            <div className="rounded-lg border border-zinc-100 bg-zinc-50 p-2.5 text-center dark:border-zinc-800 dark:bg-zinc-900">
              <div className="flex items-center justify-center gap-1 text-[11px] text-zinc-500">
                <Gauge className="size-3.5 text-zinc-400" />
                <span>Speed</span>
              </div>
              <div className="mt-1 font-semibold text-xs text-zinc-800 dark:text-zinc-200">
                {speedKmh} km/h
              </div>
            </div>

            <div className="rounded-lg border border-zinc-100 bg-zinc-50 p-2.5 text-center dark:border-zinc-800 dark:bg-zinc-900">
              <div className="flex items-center justify-center gap-1 text-[11px] text-zinc-500">
                <Clock className="size-3.5 text-zinc-400" />
                <span>Est. Arrival</span>
              </div>
              <div className="mt-1 font-semibold text-xs text-zinc-800 dark:text-zinc-200">
                {minutesToEta > 0 ? `${minutesToEta}m` : "Overdue"}
              </div>
            </div>

            <div className="rounded-lg border border-zinc-100 bg-zinc-50 p-2.5 text-center dark:border-zinc-800 dark:bg-zinc-900">
              <div className="flex items-center justify-center gap-1 text-[11px] text-zinc-500">
                <Radio className="size-3.5 text-zinc-400" />
                <span>Accuracy</span>
              </div>
              <div className="mt-1 font-semibold text-xs text-zinc-800 dark:text-zinc-200">
                {lastCoords?.acc ? `±${Math.round(lastCoords.acc)}m` : "Pinging..."}
              </div>
            </div>
          </div>

          {gpsError && (
            <div className="flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 p-2 text-xs text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300">
              <AlertCircle className="size-4 shrink-0" />
              <span>{gpsError}</span>
            </div>
          )}

          {/* Active Anomaly Banner */}
          {currentSession.active_anomaly && (
            <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900 dark:border-amber-900 dark:bg-amber-950/50 dark:text-amber-200">
              <div className="font-semibold flex items-center gap-1.5">
                <AlertCircle className="size-4 text-amber-600 dark:text-amber-400" />
                <span>Anomaly Detected: {currentSession.active_anomaly.reason}</span>
              </div>
              <p className="mt-1 text-[11px] text-amber-800 dark:text-amber-300">
                Sentinel rules engine identified a deviation from the expected pattern. Safety verification prompt is active.
              </p>
            </div>
          )}

          {/* Journey Controls */}
          <div className="flex flex-wrap items-center gap-2 pt-2">
            {currentSession.status === "active" ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="flex-1"
                disabled={actionLoading}
                onClick={handlePause}
              >
                <Pause className="mr-1.5 size-4" />
                Pause
              </Button>
            ) : (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="flex-1"
                disabled={actionLoading}
                onClick={handleResume}
              >
                <Play className="mr-1.5 size-4" />
                Resume
              </Button>
            )}

            <Button
              type="button"
              variant="outline"
              size="sm"
              className="flex-1 border-emerald-300 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-800 dark:text-emerald-300 dark:hover:bg-emerald-950"
              disabled={actionLoading}
              onClick={handleStop}
            >
              <CheckCircle2 className="mr-1.5 size-4" />
              End Journey Safely
            </Button>
          </div>

          {/* Silent Assist Distress Trigger Button */}
          <div className="pt-2">
            <Button
              type="button"
              variant="destructive"
              className="h-13 w-full bg-linear-to-r from-rose-600 to-red-600 text-base font-bold text-white shadow-md hover:from-rose-700 hover:to-red-700 active:scale-[0.99]"
              disabled={actionLoading}
              onClick={handleSilentAssist}
            >
              <ShieldAlert className="mr-2 size-5" />
              SILENT ASSIST — Trigger Immediate Distress
            </Button>
            <p className="mt-1 text-center text-[10px] text-zinc-500">
              One-touch activation discreetly notifies designated SafeCircle contacts with your live GPS location.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Quick Evidence Capture in Journey */}
      <QuickEvidenceRecorder incidentId={currentSession.incident_id} />

      {/* Safety Verification Modal */}
      <SafetyVerificationModal
        open={verificationModalOpen}
        verification={activeVerification}
        onRespond={handleVerificationRespond}
      />
    </div>
  );
}
