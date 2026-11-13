import type { MockDatabase } from "@/lib/api/mock/types";

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

function iso(base: number, offsetMs: number): string {
  return new Date(base + offsetMs).toISOString();
}

/**
 * SYNTHETIC DEMO DATA.
 *
 * Every record in this file is invented for the hackathon demonstration.
 * Names, contact details and message content are fictional. The extracted
 * OCR text is clearly marked as synthetic. Never replace this with real
 * user evidence.
 */
export function createSeedDatabase(now: number = Date.now()): MockDatabase {
  const incident1 = "1d9a0000-0000-4000-8000-000000000001";
  const incident2 = "1d9a0000-0000-4000-8000-000000000002";
  const incident3 = "1d9a0000-0000-4000-8000-000000000003";
  const incident4 = "1d9a0000-0000-4000-8000-000000000004";
  const incident5 = "1d9a0000-0000-4000-8000-000000000005";

  const evidence1 = "2e8b0000-0000-4000-8000-000000000001";
  const evidence2 = "2e8b0000-0000-4000-8000-000000000002";
  const evidence3 = "2e8b0000-0000-4000-8000-000000000003";
  const evidence4 = "2e8b0000-0000-4000-8000-000000000004";

  const contact1 = "5b5e0000-0000-4000-8000-000000000001";
  const contact2 = "5b5e0000-0000-4000-8000-000000000002";
  const contact3 = "5b5e0000-0000-4000-8000-000000000003";

  return {
    version: 1,
    incidents: [
      {
        id: incident1,
        title: "Repeated messages from an unknown account",
        description:
          "Over two days I received 14 messages from an account I do not know. The messages became increasingly personal after I stopped replying. I have not shared my routine or location with this account.",
        category: "general_harassment",
        occurred_at: iso(now, -2 * DAY),
        location_description: "Direct messages on a social platform",
        status: "open",
        created_at: iso(now, -2 * DAY + 2 * HOUR),
        updated_at: iso(now, -26 * HOUR),
      },
      {
        id: incident2,
        title: "Threatening message after blocking a number",
        description:
          "After I blocked a number, a second number messaged me saying they knew where I study and that I should not ignore them. I saved screenshots of both conversations.",
        category: "threat",
        occurred_at: iso(now, -4 * DAY),
        location_description: "Mobile messages",
        status: "open",
        created_at: iso(now, -4 * DAY + 3 * HOUR),
        updated_at: iso(now, -3 * DAY),
      },
      {
        id: incident3,
        title: "Impersonation profile using my photos",
        description:
          "A profile I did not create is using two of my photos and messaging people I know. I asked the platform to review it and told the people who were contacted that the profile is not mine.",
        category: "impersonation",
        occurred_at: iso(now, -9 * DAY),
        location_description: "Social platform",
        status: "open",
        created_at: iso(now, -9 * DAY + 1 * HOUR),
        updated_at: iso(now, -8 * DAY),
      },
      {
        id: incident4,
        title: "Home area mentioned in a group chat",
        description:
          "Someone in a group chat posted a description of the area I live in and referenced my usual route. I have not shared this information publicly. I left the group and saved the messages.",
        category: "doxxing",
        occurred_at: iso(now, -12 * DAY),
        location_description: "Group chat",
        status: "archived",
        created_at: iso(now, -12 * DAY + 4 * HOUR),
        updated_at: iso(now, -11 * DAY),
      },
      {
        id: incident5,
        title: "Followed after leaving the station",
        description:
          "A person followed me from the station toward my street and turned away when I entered a shop. This is the second time this month that I have noticed the same behaviour.",
        category: "cyberstalking",
        occurred_at: iso(now, -20 * DAY),
        location_description: "Near the east station exit",
        status: "open",
        created_at: iso(now, -20 * DAY + 1 * HOUR),
        updated_at: iso(now, -20 * DAY + 1 * HOUR),
      },
    ],
    evidence: [
      {
        id: evidence1,
        incident_id: incident1,
        file_name: "synthetic-chat-screenshot-01.png",
        mime_type: "image/png",
        size_bytes: 284_512,
        sha256:
          "e088a1be2fe1a88f24b49811f771d918db5ccfc83849e2c9fbd1e7b636520b63",
        uploaded_at: iso(now, -2 * DAY + 3 * HOUR),
        storage_status: "stored",
      },
      {
        id: evidence2,
        incident_id: incident1,
        file_name: "synthetic-chat-screenshot-02.webp",
        mime_type: "image/webp",
        size_bytes: 198_240,
        sha256:
          "ede2ceeb1fb20dc18d135103d52db5f55558fa8ab9a69d5100f82c00d4d403dc",
        uploaded_at: iso(now, -2 * DAY + 3 * HOUR + 4 * MINUTE),
        storage_status: "stored",
      },
      {
        id: evidence3,
        incident_id: incident2,
        file_name: "synthetic-threat-message.jpg",
        mime_type: "image/jpeg",
        size_bytes: 412_870,
        sha256:
          "5001a5261477b0b526b16389f4eb58d8edb8d9ed00adb7ccdd74675a08152099",
        uploaded_at: iso(now, -4 * DAY + 4 * HOUR),
        storage_status: "stored",
      },
      {
        id: evidence4,
        incident_id: incident3,
        file_name: "synthetic-profile-copy.png",
        mime_type: "image/png",
        size_bytes: 156_322,
        sha256:
          "f387c8d26baff359d87f9bfb256b12e7afc41f1926d2f4bbd874cb44e840ef00",
        uploaded_at: iso(now, -9 * DAY + 2 * HOUR),
        storage_status: "stored",
      },
    ],
    analyses: [
      {
        analysis_id: "3f7c0000-0000-4000-8000-000000000001",
        incident_id: incident1,
        status: "completed",
        classification: {
          label: "general_harassment",
          confidence: 0.71,
          confidence_type: "model_score_not_calibrated_probability",
          explanation:
            "The submitted content contains repeated unwanted contact and becomes more personal after the user stops replying. That pattern is consistent with the general harassment category.",
        },
        indicators: [
          {
            name: "repeated_unwanted_contact",
            description:
              "The text describes repeated contact after the user stopped replying.",
          },
          {
            name: "escalation_after_non_response",
            description:
              "The tone becomes more personal once the user is unresponsive.",
          },
          {
            name: "personal_detail_reference",
            description:
              "The sender references details the user does not remember sharing.",
          },
        ],
        risk: {
          score: 46,
          level: "moderate",
          label: "review_priority",
          explanation:
            "The review-priority score reflects repeated contact and escalation indicators, offset by limited evidence completeness. It is not a prediction of harm.",
          factors: [
            {
              name: "Threat language",
              value: 35,
              weight: 0.3,
              description: "Some intimidating phrasing, without a direct threat.",
            },
            {
              name: "Frequency or repetition",
              value: 72,
              weight: 0.25,
              description: "Multiple messages over two days.",
            },
            {
              name: "Evidence completeness",
              value: 60,
              weight: 0.2,
              description: "Two screenshots are attached to the incident.",
            },
            {
              name: "Digital exposure",
              value: 25,
              weight: 0.15,
              description: "No private identifiers were shared in the record.",
            },
            {
              name: "Persistence",
              value: 55,
              weight: 0.1,
              description: "Contact continued after the user stopped replying.",
            },
          ],
        },
        ocr: {
          status: "completed",
          text_available: true,
          extracted_text:
            'Synthetic demo OCR text — "why are you ignoring me? i know you saw this message. reply." (Demo extraction; always compare with the original image.)',
        },
        limitations: [
          "AI output may be inaccurate or incomplete.",
          "This result is not a prediction of crime or future harm.",
          "OCR may misread text; compare the extracted text with the original image.",
          "The model score is not a calibrated probability.",
        ],
        created_at: iso(now, -26 * HOUR),
      },
      {
        analysis_id: "3f7c0000-0000-4000-8000-000000000002",
        incident_id: incident2,
        status: "completed",
        classification: {
          label: "threat",
          confidence: 0.83,
          confidence_type: "model_score_not_calibrated_probability",
          explanation:
            "The content describes an implied threat combined with a reference to the user's location and a demand not to be ignored.",
        },
        indicators: [
          {
            name: "implied_threat",
            description: "The message implies consequences if ignored.",
          },
          {
            name: "location_reference",
            description: "The sender claims to know where the user studies.",
          },
          {
            name: "contact_after_blocking",
            description: "The contact moved to a second number after a block.",
          },
        ],
        risk: {
          score: 72,
          level: "high",
          label: "review_priority",
          explanation:
            "The score reflects threat language and contact after blocking. It summarizes configured indicators only and is not a danger prediction.",
          factors: [
            {
              name: "Threat language",
              value: 85,
              weight: 0.3,
              description: "Directly intimidating language is present.",
            },
            {
              name: "Frequency or repetition",
              value: 60,
              weight: 0.25,
              description: "Contact continued through a second number.",
            },
            {
              name: "Evidence completeness",
              value: 45,
              weight: 0.2,
              description: "One screenshot is attached.",
            },
            {
              name: "Digital exposure",
              value: 40,
              weight: 0.15,
              description: "A study location is referenced.",
            },
            {
              name: "Persistence",
              value: 70,
              weight: 0.1,
              description: "The sender persisted after being blocked.",
            },
          ],
        },
        ocr: { status: "not_applicable", text_available: false },
        limitations: [
          "AI output may be inaccurate or incomplete.",
          "This result is not a prediction of crime or future harm.",
          "The model score is not a calibrated probability.",
        ],
        created_at: iso(now, -3 * DAY),
      },
    ],
    links: [
      {
        id: "4a6d0000-0000-4000-8000-000000000001",
        source: incident1,
        target: incident2,
        relationship: "REPEATED_CONTACT_PATTERN",
        confidence: 0.68,
        explanation:
          "Both incidents describe contact that continued after the user tried to stop it. This is a content-based suggestion, not a shared-person determination.",
      },
      {
        id: "4a6d0000-0000-4000-8000-000000000002",
        source: incident2,
        target: incident4,
        relationship: "SAME_USER_REPORTED_IDENTIFIER",
        confidence: 0.92,
        explanation:
          "You recorded the same account handle in both incidents.",
      },
      {
        id: "4a6d0000-0000-4000-8000-000000000003",
        source: incident1,
        target: incident3,
        relationship: "SIMILAR_MESSAGE_CONTENT",
        confidence: 0.54,
        explanation:
          "The messages share similar phrasing. This is a low-confidence content similarity suggestion.",
      },
      {
        id: "4a6d0000-0000-4000-8000-000000000004",
        source: incident3,
        target: incident5,
        relationship: "USER_REPORTED_RELATED_EVENT",
        confidence: 1,
        explanation:
          "You marked these incidents as related when you created the record.",
      },
    ],
    contacts: [
      {
        id: contact1,
        name: "Aarav Mehta (demo)",
        contact_method: "email",
        contact_value: "aarav.mehta@example.test",
        consent_confirmed: true,
        created_at: iso(now, -30 * DAY),
      },
      {
        id: contact2,
        name: "Meera Kapoor (demo)",
        contact_method: "phone",
        contact_value: "+1 555 0100",
        consent_confirmed: true,
        created_at: iso(now, -18 * DAY),
      },
      {
        id: contact3,
        name: "Support circle (demo)",
        contact_method: "email",
        contact_value: "support.circle@example.test",
        consent_confirmed: true,
        created_at: iso(now, -6 * DAY),
      },
    ],
    sessions: [
      {
        id: "6c4f0000-0000-4000-8000-000000000001",
        trusted_contact_id: contact1,
        incident_id: incident1,
        status: "active",
        checkin_deadline: iso(now, 3 * HOUR + 20 * MINUTE),
        created_at: iso(now, -40 * MINUTE),
        checked_in_at: null,
        cancelled_at: null,
      },
      {
        id: "6c4f0000-0000-4000-8000-000000000002",
        trusted_contact_id: contact2,
        incident_id: null,
        status: "checked_in",
        checkin_deadline: iso(now, -2 * HOUR),
        created_at: iso(now, -8 * HOUR),
        checked_in_at: iso(now, -3 * HOUR),
        cancelled_at: null,
      },
      {
        id: "6c4f0000-0000-4000-8000-000000000003",
        trusted_contact_id: contact1,
        incident_id: incident2,
        status: "expired",
        checkin_deadline: iso(now, -2 * DAY),
        created_at: iso(now, -2 * DAY - 6 * HOUR),
        checked_in_at: null,
        cancelled_at: null,
      },
      {
        id: "6c4f0000-0000-4000-8000-000000000004",
        trusted_contact_id: contact3,
        incident_id: incident3,
        status: "cancelled",
        checkin_deadline: iso(now, 1 * DAY),
        created_at: iso(now, -2 * HOUR),
        checked_in_at: null,
        cancelled_at: iso(now, -90 * MINUTE),
      },
    ],
    reports: [],
    verifications: {},
  };
}
