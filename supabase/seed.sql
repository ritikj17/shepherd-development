-- SHEPHERD Synthetic Seed Data (Development / Hackathon Demo Only)
-- Notice: All records below are 100% synthetic demo data.
-- Seed data is NOT required for production authentication.
-- To apply in local Supabase, ensure the synthetic demo auth user exists in auth.users.

DO $$
DECLARE
    demo_user_id UUID := '00000000-0000-4000-8000-000000000001';
    incident_1_id UUID := '11111111-1111-4111-8111-111111111111';
    incident_2_id UUID := '22222222-2222-4222-8222-222222222222';
    demo_contact_id UUID := '33333333-3333-4333-8333-333333333333';
BEGIN
    IF EXISTS (SELECT 1 FROM auth.users WHERE id = demo_user_id) THEN
        INSERT INTO public.profiles (id, display_name)
        VALUES (demo_user_id, 'Demo User (Synthetic)')
        ON CONFLICT (id) DO NOTHING;

        INSERT INTO public.incidents (id, user_id, title, description, category, occurred_at, location_description, status)
        VALUES
            (
                incident_1_id,
                demo_user_id,
                '[DEMO] Repeated unwanted messages on messaging platform',
                'Synthetic demo incident: User received repeated unwanted messages from an unknown account.',
                'general_harassment',
                '2026-11-10T14:30:00Z',
                'Online messaging app (synthetic)',
                'open'
            ),
            (
                incident_2_id,
                demo_user_id,
                '[DEMO] Follow-up threatening message',
                'Synthetic demo incident: Follow-up message with threatening phrasing.',
                'threat',
                '2026-11-11T09:15:00Z',
                'Online messaging app (synthetic)',
                'open'
            )
        ON CONFLICT (id) DO NOTHING;

        INSERT INTO public.incident_links (user_id, source_incident_id, target_incident_id, relationship, confidence, explanation)
        VALUES (
            demo_user_id,
            incident_1_id,
            incident_2_id,
            'REPEATED_CONTACT_PATTERN',
            0.76,
            '[DEMO] Synthetic example link showing repeated contact pattern across two demo incidents.'
        )
        ON CONFLICT DO NOTHING;

        INSERT INTO public.trusted_contacts (id, user_id, name, contact_method, contact_value, consent_confirmed)
        VALUES (
            demo_contact_id,
            demo_user_id,
            'Demo Trusted Contact (Synthetic)',
            'email',
            'demo-contact@example.test',
            true
        )
        ON CONFLICT (id) DO NOTHING;
    END IF;
END $$;
