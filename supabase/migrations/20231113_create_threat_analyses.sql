-- Migration: create threat_analyses table
CREATE TABLE IF NOT EXISTS threat_analyses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    incident_id UUID NOT NULL REFERENCES incidents(incident_id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    status TEXT NOT NULL,
    classification_label TEXT NOT NULL,
    confidence NUMERIC NULL CHECK (confidence >= 0 AND confidence <= 1),
    confidence_type TEXT NOT NULL,
    explanation TEXT NOT NULL,
    indicators JSONB NOT NULL DEFAULT '[]'::jsonb,
    ocr_status TEXT NOT NULL,
    risk_score INTEGER NULL CHECK (risk_score >= 0 AND risk_score <= 100),
    risk_level TEXT NULL,
    risk_factors JSONB NOT NULL DEFAULT '[]'::jsonb,
    limitations JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
