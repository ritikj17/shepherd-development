import { delay, mockId, readDatabase, updateDatabase } from "@/lib/api/mock/store";
import { mockError } from "@/lib/api/mock/errors";
import type {
  AnalysisListResponse,
  IncidentCategory,
  RequestAnalysisInput,
  RiskFactor,
  ThreatAnalysis,
} from "@/lib/types/api";

interface AnalysisTemplate {
  label: IncidentCategory;
  confidence: number;
  score: number;
  level: "low" | "moderate" | "high";
  explanation: string;
  indicators: { name: string; description: string }[];
  factors: Omit<RiskFactor, "weight">[];
}

const TEMPLATES: Record<IncidentCategory, AnalysisTemplate> = {
  cyberstalking: {
    label: "cyberstalking",
    confidence: 0.7,
    score: 58,
    level: "moderate",
    explanation:
      "The record describes repeated monitoring or following behaviour across more than one occasion.",
    indicators: [
      {
        name: "repeated_contact_pattern",
        description: "Contact or following was reported more than once.",
      },
      {
        name: "monitoring_behaviour",
        description: "The record references observation of the user's routine.",
      },
    ],
    factors: [
      { name: "Threat language", value: 40 },
      { name: "Frequency or repetition", value: 75 },
      { name: "Evidence completeness", value: 55 },
      { name: "Digital exposure", value: 45 },
      { name: "Persistence", value: 65 },
    ],
  },
  threat: {
    label: "threat",
    confidence: 0.8,
    score: 74,
    level: "high",
    explanation:
      "The submitted content contains intimidating language and a reference to consequences if ignored.",
    indicators: [
      {
        name: "implied_threat",
        description: "The content implies consequences or harm.",
      },
      {
        name: "location_reference",
        description: "The sender references a location connected to the user.",
      },
    ],
    factors: [
      { name: "Threat language", value: 88 },
      { name: "Frequency or repetition", value: 60 },
      { name: "Evidence completeness", value: 55 },
      { name: "Digital exposure", value: 40 },
      { name: "Persistence", value: 70 },
    ],
  },
  sextortion: {
    label: "sextortion",
    confidence: 0.76,
    score: 81,
    level: "high",
    explanation:
      "The record describes coercion involving intimate content or the threat of exposure.",
    indicators: [
      {
        name: "coercive_demand",
        description: "A demand is tied to a threatened disclosure.",
      },
      {
        name: "intimate_content_reference",
        description: "The content references intimate images or material.",
      },
    ],
    factors: [
      { name: "Threat language", value: 90 },
      { name: "Frequency or repetition", value: 55 },
      { name: "Evidence completeness", value: 50 },
      { name: "Digital exposure", value: 85 },
      { name: "Persistence", value: 75 },
    ],
  },
  impersonation: {
    label: "impersonation",
    confidence: 0.72,
    score: 44,
    level: "moderate",
    explanation:
      "The record describes a profile or identity using the user's material without consent.",
    indicators: [
      {
        name: "identity_misuse",
        description: "A profile is reported as using the user's identity.",
      },
      {
        name: "third_party_contact",
        description: "People known to the user were contacted by the profile.",
      },
    ],
    factors: [
      { name: "Threat language", value: 25 },
      { name: "Frequency or repetition", value: 45 },
      { name: "Evidence completeness", value: 60 },
      { name: "Digital exposure", value: 55 },
      { name: "Persistence", value: 35 },
    ],
  },
  doxxing: {
    label: "doxxing",
    confidence: 0.74,
    score: 66,
    level: "high",
    explanation:
      "The record describes the disclosure or threatened disclosure of private identifying details.",
    indicators: [
      {
        name: "private_information_reference",
        description: "A home area or route is referenced.",
      },
      {
        name: "exposure_threat",
        description: "Private details were shared in a semi-public space.",
      },
    ],
    factors: [
      { name: "Threat language", value: 55 },
      { name: "Frequency or repetition", value: 50 },
      { name: "Evidence completeness", value: 55 },
      { name: "Digital exposure", value: 88 },
      { name: "Persistence", value: 45 },
    ],
  },
  image_based_abuse: {
    label: "image_based_abuse",
    confidence: 0.78,
    score: 78,
    level: "high",
    explanation:
      "The record describes non-consensual use or threatened sharing of images.",
    indicators: [
      {
        name: "non_consensual_image_use",
        description: "Images are reported as used without consent.",
      },
      {
        name: "disclosure_threat",
        description: "There is a threat to share the images further.",
      },
    ],
    factors: [
      { name: "Threat language", value: 80 },
      { name: "Frequency or repetition", value: 55 },
      { name: "Evidence completeness", value: 60 },
      { name: "Digital exposure", value: 90 },
      { name: "Persistence", value: 65 },
    ],
  },
  general_harassment: {
    label: "general_harassment",
    confidence: 0.68,
    score: 42,
    level: "moderate",
    explanation:
      "The record describes unwanted contact or intimidating behaviour without a direct threat.",
    indicators: [
      {
        name: "repeated_unwanted_contact",
        description: "Contact continued after the user stopped engaging.",
      },
      {
        name: "escalation_after_non_response",
        description: "The tone became more personal over time.",
      },
    ],
    factors: [
      { name: "Threat language", value: 30 },
      { name: "Frequency or repetition", value: 65 },
      { name: "Evidence completeness", value: 55 },
      { name: "Digital exposure", value: 25 },
      { name: "Persistence", value: 50 },
    ],
  },
  other: {
    label: "other",
    confidence: 0.51,
    score: 22,
    level: "low",
    explanation:
      "The available content does not clearly match a specific harassment category.",
    indicators: [
      {
        name: "limited_signal",
        description: "The record contains limited category-specific language.",
      },
    ],
    factors: [
      { name: "Threat language", value: 20 },
      { name: "Frequency or repetition", value: 30 },
      { name: "Evidence completeness", value: 40 },
      { name: "Digital exposure", value: 20 },
      { name: "Persistence", value: 20 },
    ],
  },
};

const WEIGHTS: Record<string, number> = {
  "Threat language": 0.3,
  "Frequency or repetition": 0.25,
  "Evidence completeness": 0.2,
  "Digital exposure": 0.15,
  Persistence: 0.1,
};

export async function mockListAnalyses(
  incidentId: string,
): Promise<AnalysisListResponse> {
  await delay(240);
  const database = readDatabase();
  if (!database.incidents.some((item) => item.id === incidentId)) {
    throw mockError(404, "NOT_FOUND", "That incident could not be found.");
  }
  return {
    items: database.analyses
      .filter((item) => item.incident_id === incidentId)
      .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at)),
  };
}

export async function mockRequestAnalysis(
  incidentId: string,
  input: RequestAnalysisInput,
): Promise<ThreatAnalysis> {
  await delay(900);
  const database = readDatabase();
  const incident = database.incidents.find((item) => item.id === incidentId);
  if (!incident) {
    throw mockError(404, "NOT_FOUND", "That incident could not be found.");
  }

  const incidentEvidence = database.evidence.filter(
    (item) => item.incident_id === incidentId,
  );
  const invalidEvidence = input.evidence_ids.filter(
    (id) => !incidentEvidence.some((item) => item.id === id),
  );
  if (invalidEvidence.length > 0) {
    throw mockError(
      400,
      "VALIDATION_ERROR",
      "One or more evidence records do not belong to this incident.",
    );
  }

  const template = TEMPLATES[incident.category] ?? TEMPLATES.other;
  const selectedEvidence = incidentEvidence.filter((item) =>
    input.evidence_ids.includes(item.id),
  );
  const evidenceBoost = Math.min(20, selectedEvidence.length * 8);
  const score = Math.min(100, template.score + evidenceBoost);

  const factors: RiskFactor[] = template.factors.map((factor) => ({
    ...factor,
    value:
      factor.name === "Evidence completeness"
        ? Math.min(100, factor.value + evidenceBoost)
        : factor.value,
    weight: WEIGHTS[factor.name],
  }));

  const analysis: ThreatAnalysis = {
    analysis_id: mockId(),
    incident_id: incidentId,
    status: "completed",
    classification: {
      label: template.label,
      confidence: template.confidence,
      confidence_type: "model_score_not_calibrated_probability",
      explanation: template.explanation,
    },
    indicators: template.indicators,
    risk: {
      score,
      level: template.level,
      label: "review_priority",
      explanation:
        "The score summarizes the configured review indicators for this category. It is not a danger or crime prediction.",
      factors,
    },
    ocr: {
      status: "not_applicable",
      text_available: false,
    },
    limitations: [
      "Demo adapter: this sample result was generated locally from the incident category. No OCR or classification model ran.",
      "AI output may be inaccurate or incomplete.",
      "This result is not a prediction of crime or future harm.",
      "The model score is not a calibrated probability.",
    ],
    created_at: new Date().toISOString(),
  };

  updateDatabase((current) => ({
    ...current,
    analyses: [analysis, ...current.analyses],
  }));

  return analysis;
}
