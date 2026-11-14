-- Migration: create incidents table
CREATE TABLE IF NOT EXISTS incidents (
    incident_id UUID PRIMARY KEY,
    owner_id UUID NOT NULL,
    description TEXT,
    category TEXT,
    severity TEXT,
    occurred_at TIMESTAMPTZ DEFAULT now(),
    location_description TEXT,
    status TEXT
);
