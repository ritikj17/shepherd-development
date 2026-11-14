"use client";

import { useState } from "react";
import { CheckCircle2, ChevronRight, Compass, Flame, Play, RotateCcw, ShieldAlert, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  acknowledgeRelay,
  getRelayDetails,
  sendSentinelLocation,
  startSentinelSession,
  stopSentinelSession,
  triggerSilentAssist,
} from "@/lib/api/sentinel";
import type { SentinelSession } from "@/lib/types/sentinel";

interface SentinelDemoSimulatorProps {
  onSessionUpdated: (session: SentinelSession | null) => void;
  onRelayTokenGenerated?: (token: string) => void;
}

export function SentinelDemoSimulator({
  onSessionUpdated,
  onRelayTokenGenerated,
}: SentinelDemoSimulatorProps) {
  const [activeScenario, setActiveScenario] = useState<"A" | "B" | "C" | null>(null);
  const [stepIndex, setStepIndex] = useState(0);
  const [log, setLog] = useState<string[]>([]);
  const [simulatedSession, setSimulatedSession] = useState<SentinelSession | null>(null);
  const [running, setRunning] = useState(false);

  const addLog = (msg: string) => {
    setLog((prev) => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...prev.slice(0, 15)]);
  };

  // Scenario A: Normal Journey
  const runScenarioA = async () => {
    setRunning(true);
    setActiveScenario("A");
    setStepIndex(1);
    setLog([]);
    addLog("Starting Scenario A: Normal commute along planned corridor.");

    try {
      const eta = new Date(Date.now() + 30 * 60000).toISOString();
      const session = await startSentinelSession({
        destination_name: "Central Metro Station Exit 2",
        destination_lat: 28.6328,
        destination_lng: 77.2197,
        start_lat: 28.6280,
        start_lng: 77.2150,
        expected_arrival: eta,
        travel_mode: "walking",
        deviation_threshold_meters: 250,
        is_demo: true,
      });

      setSimulatedSession(session);
      onSessionUpdated(session);
      addLog("Step 1: Session created. Pinging origin location...");

      await new Promise((r) => setTimeout(r, 1200));
      setStepIndex(2);
      await sendSentinelLocation(session.id, {
        latitude: 28.6295,
        longitude: 77.2165,
        accuracy: 8,
        speed: 1.3,
        is_simulated: true,
      });
      addLog("Step 2: Location ping along corridor. Concern level: NORMAL.");

      await new Promise((r) => setTimeout(r, 1200));
      setStepIndex(3);
      await sendSentinelLocation(session.id, {
        latitude: 28.6325,
        longitude: 77.2195,
        accuracy: 6,
        speed: 1.2,
        is_simulated: true,
      });
      addLog("Step 3: Arrived near destination (within 40m).");

      await new Promise((r) => setTimeout(r, 1000));
      setStepIndex(4);
      const ended = await stopSentinelSession(session.id, "completed");
      setSimulatedSession(ended);
      onSessionUpdated(null);
      addLog("Scenario A Completed: Normal journey completed safely.");
    } catch (err: unknown) {
      addLog(`Error: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setRunning(false);
    }
  };

  // Scenario B: Route Deviation & Verification Check
  const runScenarioB = async () => {
    setRunning(true);
    setActiveScenario("B");
    setStepIndex(1);
    setLog([]);
    addLog("Starting Scenario B: Unexpected Route Deviation.");

    try {
      const eta = new Date(Date.now() + 40 * 60000).toISOString();
      const session = await startSentinelSession({
        destination_name: "Home — Sector 62",
        destination_lat: 28.6200,
        destination_lng: 77.3600,
        start_lat: 28.6300,
        start_lng: 77.3700,
        expected_arrival: eta,
        travel_mode: "walking",
        deviation_threshold_meters: 150,
        is_demo: true,
      });

      setSimulatedSession(session);
      onSessionUpdated(session);
      addLog("Step 1: Journey active. Normal start coordinate ingested.");

      await new Promise((r) => setTimeout(r, 1200));
      setStepIndex(2);
      addLog("Step 2: Simulating sharp turn 420m away from planned corridor...");
      const devRes = await sendSentinelLocation(session.id, {
        latitude: 28.6390,
        longitude: 77.3820,
        accuracy: 10,
        speed: 3.5,
        is_simulated: true,
      });

      if (devRes.verification_required && devRes.verification) {
        addLog(`Step 3: ANOMALY DETECTED! ${devRes.anomaly?.reason || "Cross-track deviation"}.`);
        addLog("Safety verification check presented to user (60s countdown).");
        setSimulatedSession({
          ...session,
          concern_level: devRes.concern_level,
          active_verification: devRes.verification,
          active_anomaly: devRes.anomaly,
        });
        onSessionUpdated({
          ...session,
          concern_level: devRes.concern_level,
          active_verification: devRes.verification,
          active_anomaly: devRes.anomaly,
        });
      }

      setStepIndex(3);
    } catch (err: unknown) {
      addLog(`Error: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setRunning(false);
    }
  };

  // Scenario C: Silent Assist & Rescue Relay
  const runScenarioC = async () => {
    setRunning(true);
    setActiveScenario("C");
    setStepIndex(1);
    setLog([]);
    addLog("Starting Scenario C: One-Touch Distress & Rescue Relay.");

    try {
      addLog("Step 1: Triggering Silent Assist distress signal with current GPS...");
      const distressRes = await triggerSilentAssist({
        current_lat: 28.6139,
        current_lng: 77.2090,
        accuracy: 8,
        haptic_confirmed: true,
      });

      const token = distressRes.relay_token || distressRes.escalation?.relay_token;
      addLog(`Step 2: Live incident auto-generated (${distressRes.incident_id.slice(0, 8)}).`);
      addLog(`Step 3: Rescue Relay link generated: /relay/${token}`);

      if (token) {
        onRelayTokenGenerated?.(token);

        await new Promise((r) => setTimeout(r, 1500));
        setStepIndex(2);
        addLog("Step 4: Simulating trusted contact opening public rescue relay link...");
        const details = await getRelayDetails(token);
        addLog(`Contact reviewed alert for ${details.user_display_name}. Location verified.`);

        await new Promise((r) => setTimeout(r, 1500));
        setStepIndex(3);
        addLog("Step 5: Trusted contact acknowledging alert ('I am on my way')...");
        await acknowledgeRelay(token, {
          responder_name: "Pooja Sharma (Sister)",
          responder_note: "I have received your alert and am heading to your location now.",
        });
        addLog("SUCCESS: Rescue relay acknowledged! Timeline updated in real-time.");
      }
    } catch (err: unknown) {
      addLog(`Error: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setRunning(false);
    }
  };

  return (
    <Card className="border-indigo-100 bg-linear-to-b from-indigo-50/50 to-white dark:border-indigo-950/60 dark:from-zinc-900/60 dark:to-zinc-950">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="size-5 text-indigo-600 dark:text-indigo-400" />
            <CardTitle className="text-base font-semibold">Interactive Demo Simulator</CardTitle>
          </div>
          <Badge variant="outline" className="border-indigo-300 text-indigo-700 dark:border-indigo-800 dark:text-indigo-300">
            Hackathon Showcase
          </Badge>
        </div>
        <CardDescription className="text-xs">
          Instantly test and demonstrate Sentinel&apos;s intelligent anomaly engine, safety verification, and live rescue relay scenarios.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="grid gap-2 sm:grid-cols-3">
          {/* Scenario A */}
          <div
            className={`rounded-lg border p-3 transition-colors ${
              activeScenario === "A"
                ? "border-emerald-500 bg-emerald-50/60 dark:border-emerald-700 dark:bg-emerald-950/30"
                : "border-zinc-200 bg-white hover:border-zinc-300 dark:border-zinc-800 dark:bg-zinc-900"
            }`}
          >
            <div className="flex items-center justify-between font-semibold text-xs text-zinc-900 dark:text-zinc-100">
              <span>Scenario A</span>
              <Compass className="size-4 text-emerald-600" />
            </div>
            <p className="mt-1 text-[11px] text-zinc-600 dark:text-zinc-400">
              Normal commute along planned route corridor with safe arrival.
            </p>
            <Button
              type="button"
              size="sm"
              variant={activeScenario === "A" ? "default" : "outline"}
              className="mt-2.5 w-full text-xs"
              disabled={running}
              onClick={runScenarioA}
            >
              <Play className="mr-1.5 size-3" />
              Simulate Normal
            </Button>
          </div>

          {/* Scenario B */}
          <div
            className={`rounded-lg border p-3 transition-colors ${
              activeScenario === "B"
                ? "border-amber-500 bg-amber-50/60 dark:border-amber-700 dark:bg-amber-950/30"
                : "border-zinc-200 bg-white hover:border-zinc-300 dark:border-zinc-800 dark:bg-zinc-900"
            }`}
          >
            <div className="flex items-center justify-between font-semibold text-xs text-zinc-900 dark:text-zinc-100">
              <span>Scenario B</span>
              <ShieldAlert className="size-4 text-amber-600" />
            </div>
            <p className="mt-1 text-[11px] text-zinc-600 dark:text-zinc-400">
              Route corridor deviation triggers explainable anomaly & verification.
            </p>
            <Button
              type="button"
              size="sm"
              variant={activeScenario === "B" ? "default" : "outline"}
              className="mt-2.5 w-full text-xs"
              disabled={running}
              onClick={runScenarioB}
            >
              <Play className="mr-1.5 size-3" />
              Simulate Detour
            </Button>
          </div>

          {/* Scenario C */}
          <div
            className={`rounded-lg border p-3 transition-colors ${
              activeScenario === "C"
                ? "border-rose-500 bg-rose-50/60 dark:border-rose-700 dark:bg-rose-950/30"
                : "border-zinc-200 bg-white hover:border-zinc-300 dark:border-zinc-800 dark:bg-zinc-900"
            }`}
          >
            <div className="flex items-center justify-between font-semibold text-xs text-zinc-900 dark:text-zinc-100">
              <span>Scenario C</span>
              <Flame className="size-4 text-rose-600" />
            </div>
            <p className="mt-1 text-[11px] text-zinc-600 dark:text-zinc-400">
              One-touch Silent Assist triggers live rescue relay with contact ack.
            </p>
            <Button
              type="button"
              size="sm"
              variant={activeScenario === "C" ? "default" : "outline"}
              className="mt-2.5 w-full text-xs"
              disabled={running}
              onClick={runScenarioC}
            >
              <Play className="mr-1.5 size-3" />
              Simulate Distress
            </Button>
          </div>
        </div>

        {/* Live Simulator Logs */}
        {log.length > 0 && (
          <div className="rounded-md border border-zinc-200 bg-zinc-900 p-3 font-mono text-[11px] text-zinc-100 dark:border-zinc-800">
            <div className="flex items-center justify-between pb-2 text-[10px] text-zinc-400">
              <span>Simulation Event Log</span>
              <span>{running ? "Simulating..." : "Finished"}</span>
            </div>
            <div className="max-h-36 space-y-1 overflow-y-auto">
              {log.map((entry, idx) => (
                <div key={idx} className="leading-tight">
                  {entry}
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
