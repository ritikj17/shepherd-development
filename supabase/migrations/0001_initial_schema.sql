-- SHEPHERD Initial Database Schema
-- Version: 1.0 (Aligned with docs/DATABASE.md)
-- PostgreSQL / Supabase Migration

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Trigger helper to keep updated_at current
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

-- 3.1 profiles
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    display_name TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER set_profiles_updated_at
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();

-- 3.2 incidents
CREATE TABLE IF NOT EXISTS public.incidents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    category TEXT NOT NULL CHECK (
        category IN (
            'cyberstalking',
            'threat',
            'sextortion',
            'impersonation',
            'doxxing',
            'image_based_abuse',
            'general_harassment',
            'other'
        )
    ),
    occurred_at TIMESTAMPTZ NOT NULL,
    location_description TEXT NULL,
    status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'archived')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS incidents_user_id_idx ON public.incidents(user_id);
CREATE INDEX IF NOT EXISTS incidents_user_occurred_idx ON public.incidents(user_id, occurred_at DESC);

CREATE TRIGGER set_incidents_updated_at
    BEFORE UPDATE ON public.incidents
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();

-- 3.3 evidence
CREATE TABLE IF NOT EXISTS public.evidence (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    incident_id UUID NOT NULL REFERENCES public.incidents(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    file_name TEXT NOT NULL,
    mime_type TEXT NOT NULL CHECK (mime_type IN ('image/jpeg', 'image/png', 'image/webp')),
    size_bytes BIGINT NOT NULL CHECK (size_bytes > 0),
    storage_bucket TEXT NOT NULL,
    storage_path TEXT NOT NULL UNIQUE,
    sha256 TEXT NOT NULL CHECK (sha256 ~ '^[0-9a-f]{64}$'),
    uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS evidence_incident_id_idx ON public.evidence(incident_id);
CREATE INDEX IF NOT EXISTS evidence_user_id_idx ON public.evidence(user_id);

-- 3.4 threat_analyses
CREATE TABLE IF NOT EXISTS public.threat_analyses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    incident_id UUID NOT NULL REFERENCES public.incidents(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    status TEXT NOT NULL CHECK (status IN ('completed', 'failed')),
    classification_label TEXT NOT NULL CHECK (
        classification_label IN (
            'cyberstalking',
            'threat',
            'sextortion',
            'impersonation',
            'doxxing',
            'image_based_abuse',
            'general_harassment',
            'other'
        )
    ),
    confidence NUMERIC NULL CHECK (confidence IS NULL OR (confidence >= 0 AND confidence <= 1)),
    confidence_type TEXT NOT NULL CHECK (confidence_type = 'model_score_not_calibrated_probability'),
    explanation TEXT NOT NULL,
    indicators JSONB NOT NULL DEFAULT '[]'::jsonb,
    ocr_status TEXT NOT NULL CHECK (ocr_status IN ('completed', 'failed', 'not_applicable')),
    risk_score INTEGER NULL CHECK (risk_score IS NULL OR (risk_score >= 0 AND risk_score <= 100)),
    risk_level TEXT NULL CHECK (
        risk_level IS NULL OR risk_level IN ('low', 'moderate', 'high', 'insufficient_data')
    ),
    risk_factors JSONB NOT NULL DEFAULT '[]'::jsonb,
    limitations JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS threat_analyses_incident_idx ON public.threat_analyses(incident_id);
CREATE INDEX IF NOT EXISTS threat_analyses_user_idx ON public.threat_analyses(user_id);

-- 3.5 incident_links
CREATE TABLE IF NOT EXISTS public.incident_links (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    source_incident_id UUID NOT NULL REFERENCES public.incidents(id) ON DELETE CASCADE,
    target_incident_id UUID NOT NULL REFERENCES public.incidents(id) ON DELETE CASCADE,
    relationship TEXT NOT NULL CHECK (
        relationship IN (
            'SAME_USER_REPORTED_IDENTIFIER',
            'SIMILAR_MESSAGE_CONTENT',
            'REPEATED_CONTACT_PATTERN',
            'USER_REPORTED_RELATED_EVENT'
        )
    ),
    confidence NUMERIC NULL CHECK (confidence IS NULL OR (confidence >= 0 AND confidence <= 1)),
    explanation TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT incident_links_distinct_incidents CHECK (source_incident_id <> target_incident_id),
    CONSTRAINT incident_links_unique_edge UNIQUE (user_id, source_incident_id, target_incident_id, relationship)
);

CREATE INDEX IF NOT EXISTS incident_links_user_idx ON public.incident_links(user_id);
CREATE INDEX IF NOT EXISTS incident_links_source_idx ON public.incident_links(source_incident_id);
CREATE INDEX IF NOT EXISTS incident_links_target_idx ON public.incident_links(target_incident_id);

-- 3.6 trusted_contacts
CREATE TABLE IF NOT EXISTS public.trusted_contacts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    contact_method TEXT NOT NULL CHECK (contact_method IN ('email', 'phone')),
    contact_value TEXT NOT NULL,
    consent_confirmed BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS trusted_contacts_user_idx ON public.trusted_contacts(user_id);

CREATE TRIGGER set_trusted_contacts_updated_at
    BEFORE UPDATE ON public.trusted_contacts
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();

-- 3.7 safety_sessions
CREATE TABLE IF NOT EXISTS public.safety_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    trusted_contact_id UUID NOT NULL REFERENCES public.trusted_contacts(id) ON DELETE RESTRICT,
    incident_id UUID NULL REFERENCES public.incidents(id) ON DELETE SET NULL,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'checked_in', 'expired', 'cancelled')),
    checkin_deadline TIMESTAMPTZ NOT NULL,
    checked_in_at TIMESTAMPTZ NULL,
    cancelled_at TIMESTAMPTZ NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS safety_sessions_user_idx ON public.safety_sessions(user_id);
CREATE INDEX IF NOT EXISTS safety_sessions_status_idx ON public.safety_sessions(user_id, status);

CREATE TRIGGER set_safety_sessions_updated_at
    BEFORE UPDATE ON public.safety_sessions
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();

-- 3.8 alerts
CREATE TABLE IF NOT EXISTS public.alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    safety_session_id UUID NULL REFERENCES public.safety_sessions(id) ON DELETE SET NULL,
    trusted_contact_id UUID NULL REFERENCES public.trusted_contacts(id) ON DELETE SET NULL,
    channel TEXT NOT NULL CHECK (channel IN ('email', 'sms', 'demo')),
    status TEXT NOT NULL CHECK (status IN ('queued', 'sent', 'delivered', 'failed', 'simulated')),
    provider_reference TEXT NULL,
    message_type TEXT NOT NULL,
    error_message TEXT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS alerts_user_idx ON public.alerts(user_id);
CREATE INDEX IF NOT EXISTS alerts_session_idx ON public.alerts(safety_session_id);

CREATE TRIGGER set_alerts_updated_at
    BEFORE UPDATE ON public.alerts
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();

-- 3.9 reports
CREATE TABLE IF NOT EXISTS public.reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    incident_id UUID NOT NULL REFERENCES public.incidents(id) ON DELETE CASCADE,
    storage_bucket TEXT NOT NULL,
    storage_path TEXT NOT NULL UNIQUE,
    status TEXT NOT NULL DEFAULT 'generated' CHECK (status IN ('generated', 'failed', 'expired')),
    generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at TIMESTAMPTZ NULL
);

CREATE INDEX IF NOT EXISTS reports_user_idx ON public.reports(user_id);
CREATE INDEX IF NOT EXISTS reports_incident_idx ON public.reports(incident_id);
