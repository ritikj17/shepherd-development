-- SHEPHERD Sentinel & Live Incident Response Schema
-- Migration: 20261115_sentinel_schema.sql

-- 1. Sentinel Sessions
CREATE TABLE IF NOT EXISTS public.sentinel_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    incident_id UUID NULL REFERENCES public.incidents(id) ON DELETE SET NULL,
    destination_name TEXT NOT NULL,
    destination_lat DOUBLE PRECISION NULL,
    destination_lng DOUBLE PRECISION NULL,
    start_lat DOUBLE PRECISION NULL,
    start_lng DOUBLE PRECISION NULL,
    expected_arrival TIMESTAMPTZ NOT NULL,
    travel_mode TEXT NOT NULL DEFAULT 'walking' CHECK (travel_mode IN ('walking', 'transit', 'driving', 'other')),
    trusted_contact_ids UUID[] NOT NULL DEFAULT '{}',
    share_location BOOLEAN NOT NULL DEFAULT true,
    verification_timeout_seconds INTEGER NOT NULL DEFAULT 60,
    deviation_threshold_meters DOUBLE PRECISION NOT NULL DEFAULT 200.0,
    concern_level TEXT NOT NULL DEFAULT 'normal' CHECK (concern_level IN ('normal', 'advisory', 'warning', 'critical')),
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'completed', 'cancelled', 'escalated')),
    last_location JSONB NULL,
    is_demo BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS sentinel_sessions_user_idx ON public.sentinel_sessions(user_id);
CREATE INDEX IF NOT EXISTS sentinel_sessions_status_idx ON public.sentinel_sessions(user_id, status);

CREATE TRIGGER set_sentinel_sessions_updated_at
    BEFORE UPDATE ON public.sentinel_sessions
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();

-- 2. Sentinel Foreground Location Logs
CREATE TABLE IF NOT EXISTS public.sentinel_locations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES public.sentinel_sessions(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    accuracy DOUBLE PRECISION NULL,
    speed DOUBLE PRECISION NULL,
    heading DOUBLE PRECISION NULL,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT now(),
    is_simulated BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS sentinel_locations_session_idx ON public.sentinel_locations(session_id, timestamp DESC);

-- 3. Sentinel Anomalies
CREATE TABLE IF NOT EXISTS public.sentinel_anomalies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES public.sentinel_sessions(id) ON DELETE CASCADE,
    anomaly_type TEXT NOT NULL CHECK (anomaly_type IN ('route_deviation', 'speed_anomaly', 'unexpected_stop', 'journey_timeout', 'stale_location', 'combined')),
    severity TEXT NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    detected_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    reason TEXT NOT NULL,
    confidence DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    rule_triggered TEXT NOT NULL,
    location JSONB NULL,
    resolved BOOLEAN NOT NULL DEFAULT false,
    resolved_at TIMESTAMPTZ NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS sentinel_anomalies_session_idx ON public.sentinel_anomalies(session_id);

-- 4. Sentinel Safety Verifications
CREATE TABLE IF NOT EXISTS public.sentinel_verifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES public.sentinel_sessions(id) ON DELETE CASCADE,
    anomaly_id UUID NULL REFERENCES public.sentinel_anomalies(id) ON DELETE SET NULL,
    prompt TEXT NOT NULL,
    deadline TIMESTAMPTZ NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'safe', 'help_requested', 'unanswered')),
    user_response TEXT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    responded_at TIMESTAMPTZ NULL
);

CREATE INDEX IF NOT EXISTS sentinel_verifications_session_idx ON public.sentinel_verifications(session_id, status);

-- 5. Unified Live Timeline Events
CREATE TABLE IF NOT EXISTS public.sentinel_timeline_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    incident_id UUID NULL REFERENCES public.incidents(id) ON DELETE CASCADE,
    session_id UUID NULL REFERENCES public.sentinel_sessions(id) ON DELETE SET NULL,
    event_type TEXT NOT NULL,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT now(),
    actor TEXT NOT NULL DEFAULT 'user',
    status TEXT NOT NULL DEFAULT 'info' CHECK (status IN ('info', 'warning', 'distress', 'resolved', 'success')),
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    metadata JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS sentinel_timeline_incident_idx ON public.sentinel_timeline_events(incident_id, timestamp);
CREATE INDEX IF NOT EXISTS sentinel_timeline_session_idx ON public.sentinel_timeline_events(session_id, timestamp);

-- 6. Public Contact Rescue Relay Tokens
CREATE TABLE IF NOT EXISTS public.sentinel_relay_tokens (
    token TEXT PRIMARY KEY,
    alert_id UUID NOT NULL,
    session_id UUID NULL REFERENCES public.sentinel_sessions(id) ON DELETE SET NULL,
    incident_id UUID NULL REFERENCES public.incidents(id) ON DELETE SET NULL,
    user_display_name TEXT NOT NULL,
    reason TEXT NOT NULL,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at TIMESTAMPTZ NOT NULL,
    last_location JSONB NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'acknowledged', 'expired')),
    acknowledged_at TIMESTAMPTZ NULL,
    acknowledged_by TEXT NULL,
    relay_notes TEXT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS sentinel_relay_tokens_token_idx ON public.sentinel_relay_tokens(token);

-- ============================================================================
-- Row Level Security (RLS)
-- ============================================================================

ALTER TABLE public.sentinel_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sentinel_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sentinel_anomalies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sentinel_verifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sentinel_timeline_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sentinel_relay_tokens ENABLE ROW LEVEL SECURITY;

-- User Policies: sentinel_sessions
CREATE POLICY sentinel_sessions_select_own ON public.sentinel_sessions FOR SELECT USING (user_id = auth.uid());
CREATE POLICY sentinel_sessions_insert_own ON public.sentinel_sessions FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY sentinel_sessions_update_own ON public.sentinel_sessions FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY sentinel_sessions_delete_own ON public.sentinel_sessions FOR DELETE USING (user_id = auth.uid());

-- User Policies: sentinel_locations
CREATE POLICY sentinel_locations_select_own ON public.sentinel_locations FOR SELECT USING (user_id = auth.uid());
CREATE POLICY sentinel_locations_insert_own ON public.sentinel_locations FOR INSERT WITH CHECK (user_id = auth.uid());

-- User Policies: sentinel_anomalies & verifications via session ownership
CREATE POLICY sentinel_anomalies_select_own ON public.sentinel_anomalies FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.sentinel_sessions s WHERE s.id = session_id AND s.user_id = auth.uid())
);

CREATE POLICY sentinel_verifications_select_own ON public.sentinel_verifications FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.sentinel_sessions s WHERE s.id = session_id AND s.user_id = auth.uid())
);
CREATE POLICY sentinel_verifications_update_own ON public.sentinel_verifications FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.sentinel_sessions s WHERE s.id = session_id AND s.user_id = auth.uid())
);

-- Public Token Relay Policies (Scoped to valid unexpired token)
CREATE POLICY sentinel_relay_select_public ON public.sentinel_relay_tokens FOR SELECT USING (
    expires_at > now()
);
CREATE POLICY sentinel_relay_update_public ON public.sentinel_relay_tokens FOR UPDATE USING (
    expires_at > now()
);
