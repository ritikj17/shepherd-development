# SHEPHERD — Database Design

Version: 1.0
Status: LOCKED
Database: Supabase PostgreSQL
Authentication: Supabase Auth
Storage: Private Supabase Storage bucket

## 1. Database Principles

1. Use UUID primary keys.
2. Use TIMESTAMPTZ for timestamps.
3. Use foreign keys for relational integrity.
4. Use authenticated Supabase user IDs as record owners.
5. Enforce Row Level Security on user-owned tables.
6. Never trust a client-supplied user_id.
7. Keep private evidence in private object storage.
8. Store file hashes and metadata, not duplicate file bytes in PostgreSQL.
9. Use migrations for schema changes.
10. Do not manually change production schemas outside migrations.

## 2. Entity Relationship Overview

auth.users
|
| 1:1
v
profiles

auth.users
|
| 1:N
v
incidents
|
| 1:N
+------ evidence
|
| 1:N
+------ threat_analyses
|
| 1:N
+------ incident_links (source incident)
|
| 1:N
+------ incident_links (target incident)
|
| 1:N
+------ safety_sessions (optional incident)
|
| 1:N
+------ reports (recommended report metadata)

auth.users
|
| 1:N
+------ trusted_contacts
|
| 1:N
+------ safety_sessions

safety_sessions
|
| 1:N
v
alerts

trusted_contacts
|
| 1:N
v
safety_sessions

All user-owned records must be isolated by owner ID.

## 3. Tables

### 3.1 profiles

Purpose:
Application profile linked to Supabase Auth.

Columns:

- id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE
- display_name TEXT
- created_at TIMESTAMPTZ NOT NULL DEFAULT now()
- updated_at TIMESTAMPTZ NOT NULL DEFAULT now()

Notes:

- id is the authenticated user's ID.
- Do not store passwords here.
- Supabase Auth manages credentials.

### 3.2 incidents

Purpose:
User-created incident records.

Columns:

- id UUID PRIMARY KEY DEFAULT gen_random_uuid()
- user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE
- title TEXT NOT NULL
- description TEXT NOT NULL
- category TEXT NOT NULL
- occurred_at TIMESTAMPTZ NOT NULL
- location_description TEXT NULL
- status TEXT NOT NULL DEFAULT 'open'
- created_at TIMESTAMPTZ NOT NULL DEFAULT now()
- updated_at TIMESTAMPTZ NOT NULL DEFAULT now()

Allowed category values:

- cyberstalking
- threat
- sextortion
- impersonation
- doxxing
- image_based_abuse
- general_harassment
- other

Allowed status values:

- open
- archived

Indexes:

- incidents_user_id_idx on user_id
- incidents_user_occurred_idx on (user_id, occurred_at DESC)

### 3.3 evidence

Purpose:
Private evidence metadata associated with incidents.

Columns:

- id UUID PRIMARY KEY DEFAULT gen_random_uuid()
- incident_id UUID NOT NULL REFERENCES incidents(id) ON DELETE CASCADE
- user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE
- file_name TEXT NOT NULL
- mime_type TEXT NOT NULL
- size_bytes BIGINT NOT NULL
- storage_bucket TEXT NOT NULL
- storage_path TEXT NOT NULL UNIQUE
- sha256 TEXT NOT NULL
- uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now()

Constraints:

- size_bytes > 0
- sha256 must contain exactly 64 lowercase hexadecimal characters
- storage_path must be unique
- accepted MIME types must be validated by the backend

Indexes:

- evidence_incident_id_idx on incident_id
- evidence_user_id_idx on user_id

Notes:

- Store metadata only.
- The original file is stored in a private Supabase Storage bucket.
- The user must own the incident before uploading evidence.
- File retrieval must be authorized.
- Do not expose permanent public URLs.

### 3.4 threat_analyses

Purpose:
Persist AI-assisted analysis results.

Columns:

- id UUID PRIMARY KEY DEFAULT gen_random_uuid()
- incident_id UUID NOT NULL REFERENCES incidents(id) ON DELETE CASCADE
- user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE
- status TEXT NOT NULL
- classification_label TEXT NOT NULL
- confidence NUMERIC NULL
- confidence_type TEXT NOT NULL
- explanation TEXT NOT NULL
- indicators JSONB NOT NULL DEFAULT '[]'::jsonb
- ocr_status TEXT NOT NULL
- risk_score INTEGER NULL
- risk_level TEXT NULL
- risk_factors JSONB NOT NULL DEFAULT '[]'::jsonb
- limitations JSONB NOT NULL DEFAULT '[]'::jsonb
- created_at TIMESTAMPTZ NOT NULL DEFAULT now()

Allowed status values:

- completed
- failed

Allowed classification labels:

- cyberstalking
- threat
- sextortion
- impersonation
- doxxing
- image_based_abuse
- general_harassment
- other

Allowed confidence_type:

- model_score_not_calibrated_probability

Allowed OCR statuses:

- completed
- failed
- not_applicable

Allowed risk levels:

- low
- moderate
- high
- insufficient_data

Constraints:

- risk_score must be between 0 and 100 when present.
- confidence, when present, must be between 0 and 1.
- confidence must never be represented as a calibrated probability unless
  a separately validated calibration process exists.

Indexes:

- threat_analyses_incident_idx on incident_id
- threat_analyses_user_idx on user_id

### 3.5 incident_links

Purpose:
Store explainable relationships between incidents.

Columns:

- id UUID PRIMARY KEY DEFAULT gen_random_uuid()
- user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE
- source_incident_id UUID NOT NULL REFERENCES incidents(id) ON DELETE CASCADE
- target_incident_id UUID NOT NULL REFERENCES incidents(id) ON DELETE CASCADE
- relationship TEXT NOT NULL
- confidence NUMERIC NULL
- explanation TEXT NOT NULL
- created_at TIMESTAMPTZ NOT NULL DEFAULT now()

Allowed relationship values:

- SAME_USER_REPORTED_IDENTIFIER
- SIMILAR_MESSAGE_CONTENT
- REPEATED_CONTACT_PATTERN
- USER_REPORTED_RELATED_EVENT

Constraints:

- source_incident_id must differ from target_incident_id.
- confidence, when present, must be between 0 and 1.
- Both incidents must belong to user_id.
- Duplicate relationship records should be prevented.

### 3.6 trusted_contacts

Purpose:
Store user-controlled trusted contacts.

Columns:

- id UUID PRIMARY KEY DEFAULT gen_random_uuid()
- user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE
- name TEXT NOT NULL
- contact_method TEXT NOT NULL
- contact_value TEXT NOT NULL
- consent_confirmed BOOLEAN NOT NULL DEFAULT false
- created_at TIMESTAMPTZ NOT NULL DEFAULT now()
- updated_at TIMESTAMPTZ NOT NULL DEFAULT now()

Allowed contact_method values:

- email
- phone

Notes:

- A contact must not be used for notifications without explicit consent.
- Contact information is private.
- Never expose contact details to another user.
- Use synthetic contacts in hackathon demonstrations.

### 3.7 safety_sessions

Purpose:
Track user-initiated check-in sessions.

Columns:

- id UUID PRIMARY KEY DEFAULT gen_random_uuid()
- user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE
- trusted_contact_id UUID NOT NULL REFERENCES trusted_contacts(id) ON DELETE RESTRICT
- incident_id UUID NULL REFERENCES incidents(id) ON DELETE SET NULL
- status TEXT NOT NULL DEFAULT 'active'
- checkin_deadline TIMESTAMPTZ NOT NULL
- checked_in_at TIMESTAMPTZ NULL
- cancelled_at TIMESTAMPTZ NULL
- created_at TIMESTAMPTZ NOT NULL DEFAULT now()
- updated_at TIMESTAMPTZ NOT NULL DEFAULT now()

Allowed status values:

- active
- checked_in
- expired
- cancelled

Rules:

- The contact must belong to the same user.
- The optional incident must belong to the same user.
- The deadline must be in the future when a session is created.
- Only the session owner may check in or cancel.
- Expiration may create a reminder workflow only.
- No automatic emergency dispatch.

### 3.8 alerts

Purpose:
Record notification and reminder attempts.

Columns:

- id UUID PRIMARY KEY DEFAULT gen_random_uuid()
- user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE
- safety_session_id UUID NULL REFERENCES safety_sessions(id) ON DELETE SET NULL
- trusted_contact_id UUID NULL REFERENCES trusted_contacts(id) ON DELETE SET NULL
- channel TEXT NOT NULL
- status TEXT NOT NULL
- provider_reference TEXT NULL
- message_type TEXT NOT NULL
- error_message TEXT NULL
- created_at TIMESTAMPTZ NOT NULL DEFAULT now()
- updated_at TIMESTAMPTZ NOT NULL DEFAULT now()

Allowed channel values:

- email
- sms
- demo

Allowed status values:

- queued
- sent
- delivered
- failed
- simulated

Rules:

- Only claim sent or delivered when supported by provider responses.
- If no provider is configured, use simulated.
- Never store authentication tokens or unnecessary message contents.
- A missed check-in can generate a reminder only.

### 3.9 reports

Purpose:
Store generated JusticeBridge report metadata.

Columns:

- id UUID PRIMARY KEY DEFAULT gen_random_uuid()
- user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE
- incident_id UUID NOT NULL REFERENCES incidents(id) ON DELETE CASCADE
- storage_bucket TEXT NOT NULL
- storage_path TEXT NOT NULL UNIQUE
- status TEXT NOT NULL DEFAULT 'generated'
- generated_at TIMESTAMPTZ NOT NULL DEFAULT now()
- expires_at TIMESTAMPTZ NULL

Allowed status values:

- generated
- failed
- expired

Notes:

- PDF files must be stored privately.
- Generate short-lived authorized download links.
- Do not expose permanent public report URLs.

## 4. Row Level Security

RLS must be enabled on:

- profiles
- incidents
- evidence
- threat_analyses
- incident_links
- trusted_contacts
- safety_sessions
- alerts
- reports

General rule:
A user can access only records whose user_id equals auth.uid().

For profiles:

- id = auth.uid()

For incidents:

- user_id = auth.uid()

For evidence:

- user_id = auth.uid()
- The linked incident must also belong to auth.uid().

For threat_analyses:

- user_id = auth.uid()
- The linked incident must belong to auth.uid().

For incident_links:

- user_id = auth.uid()
- Both linked incidents must belong to auth.uid().

For trusted_contacts:

- user_id = auth.uid()

For safety_sessions:

- user_id = auth.uid()
- The linked trusted contact must belong to auth.uid().
- The optional incident must belong to auth.uid().

For alerts:

- user_id = auth.uid()
- Related session and contact must be owned by auth.uid().

For reports:

- user_id = auth.uid()
- The linked incident must belong to auth.uid().

Policies must cover SELECT, INSERT, UPDATE and DELETE as appropriate.
For INSERT, enforce ownership through WITH CHECK.
For UPDATE, enforce both USING and WITH CHECK.
For DELETE, enforce ownership through USING.

Do not rely on frontend filtering as an authorization mechanism.

## 5. Storage

Create private bucket:

shepherd-evidence

Recommended object path:

{user_id}/{incident_id}/{evidence_id}/{safe_file_name}

PDF reports may use a separate private bucket:

shepherd-reports

Recommended object path:

{user_id}/{incident_id}/{report_id}.pdf

Rules:

- Both buckets must be private.
- Validate ownership before upload, read or delete.
- Use short-lived signed URLs only when necessary.
- Never store service-role credentials in frontend code.
- Restrict file types and file sizes in the backend.
- Remove storage objects when associated evidence is permanently deleted.
- Define retention and deletion behavior before production use.

## 6. Migrations and Seed Data

All schema changes must be represented by ordered SQL migrations
under supabase/migrations/.

Member 2 owns migrations and database integration.

Seed data must be synthetic.
Never insert real user evidence or contact information into the seed file.

Seed data must not be required for production authentication.

## 7. Integrity and Deletion Rules

- Use foreign keys and appropriate ON DELETE behavior.
- Avoid orphaned storage objects.
- Deleting an incident must follow the agreed evidence and report cleanup
  workflow.
- Deleting a trusted contact must not erase historical alert records.
- A hash verifies byte-level consistency with a recorded reference, not
  the provenance or legal authenticity of a file.

## 8. Database Change Control

Any change to table names, columns, constraints, foreign keys, ownership
or RLS requires:

1. Member 2 approval.
2. Coordination with affected members.
3. A migration.
4. Updated API schemas.
5. Updated documentation.
6. Tests for authorization and data integrity.
