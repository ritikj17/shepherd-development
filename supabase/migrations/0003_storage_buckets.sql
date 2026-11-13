-- SHEPHERD Private Storage Buckets and Storage Policies
-- Version: 1.0 (Aligned with docs/DATABASE.md Section 5)

-- Create private buckets (public = false)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
    (
        'shepherd-evidence',
        'shepherd-evidence',
        false,
        10485760, -- 10 MB
        ARRAY['image/jpeg', 'image/png', 'image/webp']
    ),
    (
        'shepherd-reports',
        'shepherd-reports',
        false,
        20971520, -- 20 MB
        ARRAY['application/pdf']
    )
ON CONFLICT (id) DO UPDATE SET
    public = EXCLUDED.public,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Storage RLS policies: object path prefix must match authenticated user's UUID
-- Path convention: {user_id}/{incident_id}/{evidence_id}/{safe_file_name}
CREATE POLICY shepherd_evidence_select_own ON storage.objects
    FOR SELECT
    USING (
        bucket_id = 'shepherd-evidence'
        AND auth.uid()::text = (storage.foldername(name))[1]
    );

CREATE POLICY shepherd_evidence_insert_own ON storage.objects
    FOR INSERT
    WITH CHECK (
        bucket_id = 'shepherd-evidence'
        AND auth.uid()::text = (storage.foldername(name))[1]
    );

CREATE POLICY shepherd_evidence_delete_own ON storage.objects
    FOR DELETE
    USING (
        bucket_id = 'shepherd-evidence'
        AND auth.uid()::text = (storage.foldername(name))[1]
    );

CREATE POLICY shepherd_reports_select_own ON storage.objects
    FOR SELECT
    USING (
        bucket_id = 'shepherd-reports'
        AND auth.uid()::text = (storage.foldername(name))[1]
    );

CREATE POLICY shepherd_reports_insert_own ON storage.objects
    FOR INSERT
    WITH CHECK (
        bucket_id = 'shepherd-reports'
        AND auth.uid()::text = (storage.foldername(name))[1]
    );

CREATE POLICY shepherd_reports_delete_own ON storage.objects
    FOR DELETE
    USING (
        bucket_id = 'shepherd-reports'
        AND auth.uid()::text = (storage.foldername(name))[1]
    );
