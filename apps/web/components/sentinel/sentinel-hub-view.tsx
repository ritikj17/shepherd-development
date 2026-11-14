"use client";

import { useEffect, useState } from "react";
import {
  Car,
  Compass,
  Footprints,
  Navigation,
  Radio,
  Shield,
  ShieldAlert,
  Sparkles,
  Train,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { listTrustedContacts } from "@/lib/api/safety";
import { getActiveSentinelSession, startSentinelSession } from "@/lib/api/sentinel";
import type { TrustedContact } from "@/lib/types/api";
import type { SentinelSession, TravelMode } from "@/lib/types/sentinel";
import { LiveIncidentView } from "./live-incident-view";
import { MonitoringView } from "./monitoring-view";
import { SentinelDemoSimulator } from "./sentinel-demo-simulator";

const DESTINATION_PRESETS = [
  "Central Metro Station Exit 2",
  "Home — Sector 62",
  "Cyber Hub DLF Phase 2",
  "Lajpat Nagar Central Market",
];

export function SentinelHubView() {
  const [activeSession, setActiveSession] = useState<SentinelSession | null>(null);
  const [liveIncidentId, setLiveIncidentId] = useState<string | null>(null);
  const [liveRelayToken, setLiveRelayToken] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"monitor" | "simulator">("monitor");

  // Form state
  const [destination, setDestination] = useState("");
  const [travelMode, setTravelMode] = useState<TravelMode>("walking");
  const [durationMinutes, setDurationMinutes] = useState<number>(30);
  const [corridorRadius, setCorridorRadius] = useState<number>(200);
  const [contacts, setContacts] = useState<TrustedContact[]>([]);
  const [selectedContactIds, setSelectedContactIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [initLoading, setInitLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    async function loadInitialData() {
      try {
        const [session, contactList] = await Promise.all([
          getActiveSentinelSession(),
          listTrustedContacts().catch(() => ({ items: [] })),
        ]);
        if (session && (session.status === "active" || session.status === "paused")) {
          setActiveSession(session);
        }
        setContacts(contactList.items || []);
        if (contactList.items?.length > 0) {
          setSelectedContactIds(contactList.items.map((c) => c.id));
        }
      } catch {
        // Soft fail
      } finally {
        setInitLoading(false);
      }
    }
    loadInitialData();
  }, []);

  const handleStartSession = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!destination.trim()) {
      setErrorMessage("Please enter a destination.");
      return;
    }
    setLoading(true);
    setErrorMessage(null);

    try {
      // Prompt location
      let startLat: number | undefined = undefined;
      let startLng: number | undefined = undefined;

      if ("geolocation" in navigator) {
        try {
          const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, {
              enableHighAccuracy: true,
              timeout: 6000,
            });
          });
          startLat = pos.coords.latitude;
          startLng = pos.coords.longitude;
        } catch {
          // Continue even if initial fix fails; watcher will acquire it
        }
      }

      const eta = new Date(Date.now() + durationMinutes * 60000).toISOString();
      const session = await startSentinelSession({
        destination_name: destination.trim(),
        travel_mode: travelMode,
        expected_arrival: eta,
        start_lat: startLat,
        start_lng: startLng,
        deviation_threshold_meters: corridorRadius,
        trusted_contact_ids: selectedContactIds,
        share_location: true,
      });

      setActiveSession(session);
    } catch (err: unknown) {
      setErrorMessage(
        err instanceof Error ? err.message : "Failed to start Sentinel session.",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
              Sentinel Safety Monitoring
            </h1>
            <Badge className="bg-emerald-600 text-white">Live AI Protection</Badge>
          </div>
          <p className="text-xs text-zinc-600 dark:text-zinc-400">
            Detect unusual patterns. Verify distress. Coordinate help.
          </p>
        </div>

        {activeSession && !liveIncidentId && (
          <Button
            type="button"
            variant="destructive"
            size="sm"
            className="text-xs"
            onClick={() => setLiveIncidentId(activeSession.incident_id || "live-session-distress")}
          >
            <ShieldAlert className="mr-1.5 size-4" />
            Switch to Live Incident Mode
          </Button>
        )}
      </div>

      {/* If Live Distress Incident is Active */}
      {liveIncidentId ? (
        <LiveIncidentView
          incidentId={liveIncidentId}
          relayToken={liveRelayToken}
          onConclude={() => {
            setLiveIncidentId(null);
            setLiveRelayToken(null);
          }}
        />
      ) : activeSession ? (
        /* If Journey Monitoring Session is Active */
        <MonitoringView
          session={activeSession}
          onSessionUpdated={(updated) => setActiveSession(updated)}
          onDistressActivated={(incidentId, relayToken) => {
            setLiveIncidentId(incidentId);
            setLiveRelayToken(relayToken || null);
          }}
        />
      ) : (
        /* Setup / Simulator Tabs */
        <Tabs
          value={activeTab}
          onValueChange={(val) => setActiveTab(val as "monitor" | "simulator")}
          className="space-y-4"
        >
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="monitor" className="flex items-center gap-1.5">
              <Navigation className="size-4" />
              <span>Start Safety Journey</span>
            </TabsTrigger>
            <TabsTrigger value="simulator" className="flex items-center gap-1.5">
              <Sparkles className="size-4 text-indigo-600" />
              <span>Interactive Demo Simulator</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="monitor" className="space-y-4">
            <Card className="border-zinc-200 bg-white shadow-xs dark:border-zinc-800 dark:bg-zinc-950">
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-semibold">
                  Configure Safety Monitoring Session
                </CardTitle>
                <CardDescription className="text-xs">
                  Set your destination and expected travel mode. Sentinel monitors your route corridor in the foreground and prompts for verification if anomalies occur.
                </CardDescription>
              </CardHeader>

              <CardContent>
                <form onSubmit={handleStartSession} className="space-y-4">
                  {errorMessage && (
                    <div className="rounded-md border border-rose-200 bg-rose-50 p-2.5 text-xs text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-300">
                      {errorMessage}
                    </div>
                  )}

                  {/* Destination */}
                  <div className="space-y-1.5">
                    <Label htmlFor="destination" className="text-xs font-semibold">
                      Destination
                    </Label>
                    <Input
                      id="destination"
                      placeholder="e.g., Central Metro Station, Office, Home"
                      value={destination}
                      onChange={(e) => setDestination(e.target.value)}
                      required
                    />
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {DESTINATION_PRESETS.map((p) => (
                        <button
                          key={p}
                          type="button"
                          className="rounded-full border border-zinc-200 bg-zinc-50 px-2 py-0.5 text-[10px] text-zinc-700 hover:bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300"
                          onClick={() => setDestination(p)}
                        >
                          + {p}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Travel Mode & Duration */}
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label htmlFor="travelMode" className="text-xs font-semibold">
                        Travel Mode
                      </Label>
                      <Select
                        value={travelMode}
                        onValueChange={(val) => setTravelMode(val as TravelMode)}
                      >
                        <SelectTrigger id="travelMode" className="w-full">
                          <SelectValue placeholder="Select mode" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="walking">
                            <div className="flex items-center gap-2">
                              <Footprints className="size-4 text-emerald-600" />
                              <span>Walking (Max 12 km/h)</span>
                            </div>
                          </SelectItem>
                          <SelectItem value="transit">
                            <div className="flex items-center gap-2">
                              <Train className="size-4 text-blue-600" />
                              <span>Public Transit / Metro</span>
                            </div>
                          </SelectItem>
                          <SelectItem value="driving">
                            <div className="flex items-center gap-2">
                              <Car className="size-4 text-amber-600" />
                              <span>Driving / Cab</span>
                            </div>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="duration" className="text-xs font-semibold">
                        Expected Arrival Time
                      </Label>
                      <Select
                        value={String(durationMinutes)}
                        onValueChange={(val) => setDurationMinutes(Number(val))}
                      >
                        <SelectTrigger id="duration" className="w-full">
                          <SelectValue placeholder="Arrival time" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="15">In 15 minutes</SelectItem>
                          <SelectItem value="30">In 30 minutes</SelectItem>
                          <SelectItem value="45">In 45 minutes</SelectItem>
                          <SelectItem value="60">In 1 hour</SelectItem>
                          <SelectItem value="90">In 1.5 hours</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Corridor & Contact Summary */}
                  <div className="rounded-lg border border-zinc-100 bg-zinc-50 p-3 text-xs text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-zinc-800 dark:text-zinc-200">
                        SafeCircle Contacts Linked:
                      </span>
                      <span>
                        {contacts.length > 0 ? `${contacts.length} designated contact(s)` : "None (Demo link available)"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between mt-1">
                      <span className="font-semibold text-zinc-800 dark:text-zinc-200">
                        Route Corridor Tolerance:
                      </span>
                      <span>200 meters</span>
                    </div>
                  </div>

                  <Button
                    type="submit"
                    className="h-11 w-full bg-emerald-700 text-sm font-semibold text-white hover:bg-emerald-800 active:scale-[0.99] dark:bg-emerald-600"
                    disabled={loading}
                  >
                    <Shield className="mr-2 size-4" />
                    {loading ? "Initializing Sentinel..." : "Activate Sentinel Monitoring"}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="simulator">
            <SentinelDemoSimulator
              onSessionUpdated={(session) => {
                if (session) {
                  setActiveSession(session);
                }
              }}
              onRelayTokenGenerated={(token) => {
                setLiveRelayToken(token);
              }}
            />
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
