-- Migration: create incident_links table
CREATE TABLE IF NOT EXISTS incident_links (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    source_incident_id UUID NOT NULL REFERENCES incidents(incident_id) ON DELETE CASCADE,
    target_incident_id UUID NOT NULL REFERENCES incidents(incident_id) ON DELETE CASCADE,
    relationship TEXT NOT NULL,
    confidence NUMERIC NULL CHECK (confidence >= 0 AND confidence <= 1),
    explanation TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
