-- SHEPHERD Row Level Security Policies
-- Version: 1.0 (Aligned with docs/DATABASE.md Section 4)

-- Enable RLS on all user-owned tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.incidents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.evidence ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.threat_analyses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.incident_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trusted_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.safety_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 1. profiles (id = auth.uid())
-- ============================================================================
CREATE POLICY profiles_select_own ON public.profiles
    FOR SELECT USING (id = auth.uid());

CREATE POLICY profiles_insert_own ON public.profiles
    FOR INSERT WITH CHECK (id = auth.uid());

CREATE POLICY profiles_update_own ON public.profiles
    FOR UPDATE USING (id = auth.uid()) WITH CHECK (id = auth.uid());

CREATE POLICY profiles_delete_own ON public.profiles
    FOR DELETE USING (id = auth.uid());

-- ============================================================================
-- 2. incidents (user_id = auth.uid())
-- ============================================================================
CREATE POLICY incidents_select_own ON public.incidents
    FOR SELECT USING (user_id = auth.uid());

CREATE POLICY incidents_insert_own ON public.incidents
    FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY incidents_update_own ON public.incidents
    FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY incidents_delete_own ON public.incidents
    FOR DELETE USING (user_id = auth.uid());

-- ============================================================================
-- 3. evidence (user_id = auth.uid() AND linked incident owned by auth.uid())
-- ============================================================================
CREATE POLICY evidence_select_own ON public.evidence
    FOR SELECT USING (
        user_id = auth.uid()
        AND EXISTS (
            SELECT 1 FROM public.incidents i
            WHERE i.id = evidence.incident_id AND i.user_id = auth.uid()
        )
    );

CREATE POLICY evidence_insert_own ON public.evidence
    FOR INSERT WITH CHECK (
        user_id = auth.uid()
        AND EXISTS (
            SELECT 1 FROM public.incidents i
            WHERE i.id = evidence.incident_id AND i.user_id = auth.uid()
        )
    );

CREATE POLICY evidence_update_own ON public.evidence
    FOR UPDATE USING (
        user_id = auth.uid()
        AND EXISTS (
            SELECT 1 FROM public.incidents i
            WHERE i.id = evidence.incident_id AND i.user_id = auth.uid()
        )
    )
    WITH CHECK (
        user_id = auth.uid()
        AND EXISTS (
            SELECT 1 FROM public.incidents i
            WHERE i.id = evidence.incident_id AND i.user_id = auth.uid()
        )
    );

CREATE POLICY evidence_delete_own ON public.evidence
    FOR DELETE USING (
        user_id = auth.uid()
        AND EXISTS (
            SELECT 1 FROM public.incidents i
            WHERE i.id = evidence.incident_id AND i.user_id = auth.uid()
        )
    );

-- ============================================================================
-- 4. threat_analyses (user_id = auth.uid() AND linked incident owned by auth.uid())
-- ============================================================================
CREATE POLICY threat_analyses_select_own ON public.threat_analyses
    FOR SELECT USING (
        user_id = auth.uid()
        AND EXISTS (
            SELECT 1 FROM public.incidents i
            WHERE i.id = threat_analyses.incident_id AND i.user_id = auth.uid()
        )
    );

CREATE POLICY threat_analyses_insert_own ON public.threat_analyses
    FOR INSERT WITH CHECK (
        user_id = auth.uid()
        AND EXISTS (
            SELECT 1 FROM public.incidents i
            WHERE i.id = threat_analyses.incident_id AND i.user_id = auth.uid()
        )
    );

CREATE POLICY threat_analyses_update_own ON public.threat_analyses
    FOR UPDATE USING (
        user_id = auth.uid()
        AND EXISTS (
            SELECT 1 FROM public.incidents i
            WHERE i.id = threat_analyses.incident_id AND i.user_id = auth.uid()
        )
    )
    WITH CHECK (
        user_id = auth.uid()
        AND EXISTS (
            SELECT 1 FROM public.incidents i
            WHERE i.id = threat_analyses.incident_id AND i.user_id = auth.uid()
        )
    );

CREATE POLICY threat_analyses_delete_own ON public.threat_analyses
    FOR DELETE USING (
        user_id = auth.uid()
        AND EXISTS (
            SELECT 1 FROM public.incidents i
            WHERE i.id = threat_analyses.incident_id AND i.user_id = auth.uid()
        )
    );

-- ============================================================================
-- 5. incident_links (user_id = auth.uid() AND both incidents owned by auth.uid())
-- ============================================================================
CREATE POLICY incident_links_select_own ON public.incident_links
    FOR SELECT USING (
        user_id = auth.uid()
        AND EXISTS (
            SELECT 1 FROM public.incidents s
            WHERE s.id = incident_links.source_incident_id AND s.user_id = auth.uid()
        )
        AND EXISTS (
            SELECT 1 FROM public.incidents t
            WHERE t.id = incident_links.target_incident_id AND t.user_id = auth.uid()
        )
    );

CREATE POLICY incident_links_insert_own ON public.incident_links
    FOR INSERT WITH CHECK (
        user_id = auth.uid()
        AND EXISTS (
            SELECT 1 FROM public.incidents s
            WHERE s.id = incident_links.source_incident_id AND s.user_id = auth.uid()
        )
        AND EXISTS (
            SELECT 1 FROM public.incidents t
            WHERE t.id = incident_links.target_incident_id AND t.user_id = auth.uid()
        )
    );

CREATE POLICY incident_links_update_own ON public.incident_links
    FOR UPDATE USING (
        user_id = auth.uid()
        AND EXISTS (
            SELECT 1 FROM public.incidents s
            WHERE s.id = incident_links.source_incident_id AND s.user_id = auth.uid()
        )
        AND EXISTS (
            SELECT 1 FROM public.incidents t
            WHERE t.id = incident_links.target_incident_id AND t.user_id = auth.uid()
        )
    )
    WITH CHECK (
        user_id = auth.uid()
        AND EXISTS (
            SELECT 1 FROM public.incidents s
            WHERE s.id = incident_links.source_incident_id AND s.user_id = auth.uid()
        )
        AND EXISTS (
            SELECT 1 FROM public.incidents t
            WHERE t.id = incident_links.target_incident_id AND t.user_id = auth.uid()
        )
    );

CREATE POLICY incident_links_delete_own ON public.incident_links
    FOR DELETE USING (
        user_id = auth.uid()
        AND EXISTS (
            SELECT 1 FROM public.incidents s
            WHERE s.id = incident_links.source_incident_id AND s.user_id = auth.uid()
        )
        AND EXISTS (
            SELECT 1 FROM public.incidents t
            WHERE t.id = incident_links.target_incident_id AND t.user_id = auth.uid()
        )
    );

-- ============================================================================
-- 6. trusted_contacts (user_id = auth.uid())
-- ============================================================================
CREATE POLICY trusted_contacts_select_own ON public.trusted_contacts
    FOR SELECT USING (user_id = auth.uid());

CREATE POLICY trusted_contacts_insert_own ON public.trusted_contacts
    FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY trusted_contacts_update_own ON public.trusted_contacts
    FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY trusted_contacts_delete_own ON public.trusted_contacts
    FOR DELETE USING (user_id = auth.uid());

-- ============================================================================
-- 7. safety_sessions (user_id = auth.uid(), contact & optional incident owned)
-- ============================================================================
CREATE POLICY safety_sessions_select_own ON public.safety_sessions
    FOR SELECT USING (
        user_id = auth.uid()
        AND EXISTS (
            SELECT 1 FROM public.trusted_contacts tc
            WHERE tc.id = safety_sessions.trusted_contact_id AND tc.user_id = auth.uid()
        )
        AND (
            safety_sessions.incident_id IS NULL
            OR EXISTS (
                SELECT 1 FROM public.incidents i
                WHERE i.id = safety_sessions.incident_id AND i.user_id = auth.uid()
            )
        )
    );

CREATE POLICY safety_sessions_insert_own ON public.safety_sessions
    FOR INSERT WITH CHECK (
        user_id = auth.uid()
        AND EXISTS (
            SELECT 1 FROM public.trusted_contacts tc
            WHERE tc.id = safety_sessions.trusted_contact_id AND tc.user_id = auth.uid()
        )
        AND (
            safety_sessions.incident_id IS NULL
            OR EXISTS (
                SELECT 1 FROM public.incidents i
                WHERE i.id = safety_sessions.incident_id AND i.user_id = auth.uid()
            )
        )
    );

CREATE POLICY safety_sessions_update_own ON public.safety_sessions
    FOR UPDATE USING (
        user_id = auth.uid()
        AND EXISTS (
            SELECT 1 FROM public.trusted_contacts tc
            WHERE tc.id = safety_sessions.trusted_contact_id AND tc.user_id = auth.uid()
        )
        AND (
            safety_sessions.incident_id IS NULL
            OR EXISTS (
                SELECT 1 FROM public.incidents i
                WHERE i.id = safety_sessions.incident_id AND i.user_id = auth.uid()
            )
        )
    )
    WITH CHECK (
        user_id = auth.uid()
        AND EXISTS (
            SELECT 1 FROM public.trusted_contacts tc
            WHERE tc.id = safety_sessions.trusted_contact_id AND tc.user_id = auth.uid()
        )
        AND (
            safety_sessions.incident_id IS NULL
            OR EXISTS (
                SELECT 1 FROM public.incidents i
                WHERE i.id = safety_sessions.incident_id AND i.user_id = auth.uid()
            )
        )
    );

CREATE POLICY safety_sessions_delete_own ON public.safety_sessions
    FOR DELETE USING (user_id = auth.uid());

-- ============================================================================
-- 8. alerts (user_id = auth.uid(), related session & contact owned if present)
-- ============================================================================
CREATE POLICY alerts_select_own ON public.alerts
    FOR SELECT USING (
        user_id = auth.uid()
        AND (
            alerts.safety_session_id IS NULL
            OR EXISTS (
                SELECT 1 FROM public.safety_sessions ss
                WHERE ss.id = alerts.safety_session_id AND ss.user_id = auth.uid()
            )
        )
        AND (
            alerts.trusted_contact_id IS NULL
            OR EXISTS (
                SELECT 1 FROM public.trusted_contacts tc
                WHERE tc.id = alerts.trusted_contact_id AND tc.user_id = auth.uid()
            )
        )
    );

CREATE POLICY alerts_insert_own ON public.alerts
    FOR INSERT WITH CHECK (
        user_id = auth.uid()
        AND (
            alerts.safety_session_id IS NULL
            OR EXISTS (
                SELECT 1 FROM public.safety_sessions ss
                WHERE ss.id = alerts.safety_session_id AND ss.user_id = auth.uid()
            )
        )
        AND (
            alerts.trusted_contact_id IS NULL
            OR EXISTS (
                SELECT 1 FROM public.trusted_contacts tc
                WHERE tc.id = alerts.trusted_contact_id AND tc.user_id = auth.uid()
            )
        )
    );

CREATE POLICY alerts_update_own ON public.alerts
    FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (
        user_id = auth.uid()
        AND (
            alerts.safety_session_id IS NULL
            OR EXISTS (
                SELECT 1 FROM public.safety_sessions ss
                WHERE ss.id = alerts.safety_session_id AND ss.user_id = auth.uid()
            )
        )
        AND (
            alerts.trusted_contact_id IS NULL
            OR EXISTS (
                SELECT 1 FROM public.trusted_contacts tc
                WHERE tc.id = alerts.trusted_contact_id AND tc.user_id = auth.uid()
            )
        )
    );

CREATE POLICY alerts_delete_own ON public.alerts
    FOR DELETE USING (user_id = auth.uid());

-- ============================================================================
-- 9. reports (user_id = auth.uid() AND linked incident owned by auth.uid())
-- ============================================================================
CREATE POLICY reports_select_own ON public.reports
    FOR SELECT USING (
        user_id = auth.uid()
        AND EXISTS (
            SELECT 1 FROM public.incidents i
            WHERE i.id = reports.incident_id AND i.user_id = auth.uid()
        )
    );

CREATE POLICY reports_insert_own ON public.reports
    FOR INSERT WITH CHECK (
        user_id = auth.uid()
        AND EXISTS (
            SELECT 1 FROM public.incidents i
            WHERE i.id = reports.incident_id AND i.user_id = auth.uid()
        )
    );

CREATE POLICY reports_update_own ON public.reports
    FOR UPDATE USING (
        user_id = auth.uid()
        AND EXISTS (
            SELECT 1 FROM public.incidents i
            WHERE i.id = reports.incident_id AND i.user_id = auth.uid()
        )
    )
    WITH CHECK (
        user_id = auth.uid()
        AND EXISTS (
            SELECT 1 FROM public.incidents i
            WHERE i.id = reports.incident_id AND i.user_id = auth.uid()
        )
    );

CREATE POLICY reports_delete_own ON public.reports
    FOR DELETE USING (
        user_id = auth.uid()
        AND EXISTS (
            SELECT 1 FROM public.incidents i
            WHERE i.id = reports.incident_id AND i.user_id = auth.uid()
        )
    );
