import { describe, expect, it } from "vitest";
import {
  mockAcknowledgeRelay,
  mockGetActiveSentinelSession,
  mockGetLiveTimeline,
  mockGetRelayDetails,
  mockSendSentinelLocation,
  mockStartSentinelSession,
  mockStopSentinelSession,
  mockTriggerSilentAssist,
} from "@/lib/api/mock/sentinel";

describe("Sentinel Frontend Mock Flow", () => {
  it("starts, ingests location, and completes a session", async () => {
    const session = await mockStartSentinelSession({
      destination_name: "Central Metro",
      expected_arrival: new Date(Date.now() + 30 * 60000).toISOString(),
      travel_mode: "walking",
    });

    expect(session.status).toBe("active");
    expect(session.destination_name).toBe("Central Metro");

    const active = await mockGetActiveSentinelSession();
    expect(active?.id).toBe(session.id);

    const ingest = await mockSendSentinelLocation(session.id, {
      latitude: 28.6295,
      longitude: 77.2165,
      accuracy: 8,
    });
    expect(ingest.status).toBe("recorded");

    const stopped = await mockStopSentinelSession(session.id, "completed");
    expect(stopped.status).toBe("completed");

    const activeAfterStop = await mockGetActiveSentinelSession();
    expect(activeAfterStop).toBeNull();
  });

  it("triggers silent assist and allows contact relay acknowledgement", async () => {
    const distress = await mockTriggerSilentAssist({
      current_lat: 28.6139,
      current_lng: 77.2090,
      accuracy: 8,
      haptic_confirmed: true,
    });

    expect(distress.status).toBe("escalated");
    expect(distress.relay_token).toBeDefined();

    const token = distress.relay_token!;
    const relay = await mockGetRelayDetails(token);
    expect(relay.status).toBe("pending");
    expect(relay.last_location?.latitude).toBe(28.6139);

    const ack = await mockAcknowledgeRelay(token, {
      responder_name: "Pooja Sharma",
      responder_note: "I am responding now.",
    });
    expect(ack.status).toBe("acknowledged");
    expect(ack.acknowledged_by).toBe("Pooja Sharma");

    const timeline = await mockGetLiveTimeline({ incidentId: distress.incident_id });
    expect(timeline.items.length).toBeGreaterThanOrEqual(1);
  });
});
