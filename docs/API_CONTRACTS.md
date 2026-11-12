# SHEPHERD — API Contracts

Version: 1.0
Status: LOCKED

## 1. General Conventions

Core API base path:
/api/v1

Intelligence API base path:
/api/v1

Content type:
application/json

Authentication:
Authorization: Bearer <SUPABASE_ACCESS_TOKEN>

All timestamps:
ISO 8601 UTC strings.

All IDs:
UUID strings.

All protected Core API endpoints require a valid authenticated user,
except /health.

The Core API derives user identity from the verified token.
Clients must not provide user_id as an authorization mechanism.

## 2. Standard Error Format

All API errors should use:

{
"error": {
"code": "VALIDATION_ERROR",
"message": "A human-readable error message",
"details": {}
}
}

Common HTTP statuses:

- 400: Invalid request or state transition
- 401: Missing or invalid authentication
- 403: Authenticated but not authorized
- 404: Resource not found or not accessible
- 413: Upload too large
- 415: Unsupported media type
- 422: Schema validation error
- 429: Rate limit exceeded
- 500: Unexpected server error
- 502: Upstream service failure
- 503: Service unavailable

Do not disclose private record existence to unauthorized users.
Where appropriate, return 404 instead of revealing another user's data.

## 3. Core API Endpoints

### 3.1 Health

GET /health

Authentication: None

Response 200:
{
"status": "ok",
"service": "core-api"
}

### 3.2 Create Incident

POST /api/v1/incidents

Authentication: Required

Request:
{
"title": "Repeated threatening messages",
"description": "User-provided incident description",
"category": "general_harassment",
"occurred_at": "2026-11-12T10:30:00Z",
"location_description": "Optional user-provided description"
}

Allowed categories:

- cyberstalking
- threat
- sextortion
- impersonation
- doxxing
- image_based_abuse
- general_harassment
- other

Response 201:
{
"id": "UUID",
"title": "Repeated threatening messages",
"description": "User-provided incident description",
"category": "general_harassment",
"occurred_at": "2026-11-12T10:30:00Z",
"location_description": null,
"status": "open",
"created_at": "2026-11-12T10:35:00Z",
"updated_at": "2026-11-12T10:35:00Z"
}

The authenticated user becomes the owner.
Do not accept owner_id or user_id from the client.

### 3.3 List Incidents

GET /api/v1/incidents

Authentication: Required

Optional query parameters:

- limit: integer, default 20, maximum 100
- offset: integer, default 0
- category: approved category
- status: open or archived

Response 200:
{
"items": [],
"total": 0,
"limit": 20,
"offset": 0
}

Only incidents belonging to the authenticated user may be returned.

### 3.4 Get Incident

GET /api/v1/incidents/{incident_id}

Authentication: Required

Response 200:
{
"id": "UUID",
"title": "Repeated threatening messages",
"description": "User-provided description",
"category": "general_harassment",
"occurred_at": "2026-11-12T10:30:00Z",
"location_description": null,
"status": "open",
"created_at": "2026-11-12T10:35:00Z",
"updated_at": "2026-11-12T10:35:00Z"
}

### 3.5 Update Incident

PATCH /api/v1/incidents/{incident_id}

Authentication: Required

Request may contain:
{
"title": "Updated title",
"description": "Updated description",
"category": "threat",
"occurred_at": "2026-11-12T11:00:00Z",
"location_description": "Optional description",
"status": "open"
}

All fields are optional. Reject unknown fields.
Only the incident owner may update it.

Response 200:
Updated incident object.

### 3.6 Delete Incident

DELETE /api/v1/incidents/{incident_id}

Authentication: Required

Response:
204 No Content

Deletion must follow the agreed evidence retention and cascade policy.
Do not leave orphaned private evidence objects.

### 3.7 Upload Evidence

POST /api/v1/evidence

Authentication: Required

Content type:
multipart/form-data

Fields:

- incident_id: UUID
- file: binary file

Initial supported image types:

- image/jpeg
- image/png
- image/webp

A reasonable initial upload limit is 10 MB per file. The Core API must
enforce the limit regardless of frontend validation.

Response 201:
{
"id": "UUID",
"incident_id": "UUID",
"file_name": "synthetic-evidence.png",
"mime_type": "image/png",
"size_bytes": 123456,
"sha256": "64-character-lowercase-hex-string",
"uploaded_at": "2026-11-12T10:40:00Z",
"storage_status": "stored"
}

The response must not contain a public storage URL.
The original file must be stored in a private bucket.

### 3.8 List Incident Evidence

GET /api/v1/incidents/{incident_id}/evidence

Authentication: Required

Response 200:
{
"items": [
{
"id": "UUID",
"incident_id": "UUID",
"file_name": "synthetic-evidence.png",
"mime_type": "image/png",
"size_bytes": 123456,
"sha256": "hex-string",
"uploaded_at": "2026-11-12T10:40:00Z",
"storage_status": "stored"
}
]
}

### 3.9 Verify Evidence Hash

POST /api/v1/evidence/verify

Authentication: Required

Request:
{
"evidence_id": "UUID"
}

Response 200:
{
"evidence_id": "UUID",
"stored_sha256": "original-hash",
"current_sha256": "recalculated-hash",
"matches": true,
"verified_at": "2026-11-12T11:00:00Z",
"message": "Stored file bytes match the original recorded hash."
}

A matching hash proves byte-level consistency with the recorded reference.
It does not establish the original file's source, date, authorship or
legal authenticity.

### 3.10 Request Threat Analysis

POST /api/v1/incidents/{incident_id}/analysis

Authentication: Required

Request:
{
"evidence_ids": ["UUID"],
"include_description": true
}

Rules:

- Every evidence ID must belong to the specified incident.
- The incident must belong to the authenticated user.
- Only supported files may be processed.
- The Core API obtains files through private storage.
- The Core API calls the Intelligence API server-to-server.
- The Core API persists the returned analysis.

Response 200:
{
"analysis_id": "UUID",
"incident_id": "UUID",
"status": "completed",
"classification": {
"label": "general_harassment",
"confidence": 0.78,
"confidence_type": "model_score_not_calibrated_probability",
"explanation": "The extracted text contains repeated unwanted contact."
},
"indicators": [
{
"name": "repeated_unwanted_contact",
"description": "The text indicates repeated unwanted contact."
}
],
"risk": {
"score": 42,
"level": "moderate",
"label": "review_priority",
"explanation": "The score summarizes the configured review indicators."
},
"ocr": {
"status": "completed",
"text_available": true
},
"limitations": [
"AI output may be inaccurate.",
"This result is not a prediction of crime or future harm."
],
"created_at": "2026-11-12T11:05:00Z"
}

Allowed analysis status:

- completed
- failed

Do not return fabricated confidence or evaluation metrics.

### 3.11 Get Incident Analysis

GET /api/v1/incidents/{incident_id}/analysis

Authentication: Required

Response 200:
{
"items": []
}

Return only analyses belonging to the authenticated user's incident.

### 3.12 Get Incident Graph

GET /api/v1/graph/{incident_id}

Authentication: Required

Response 200:
{
"incident_id": "UUID",
"nodes": [
{
"id": "UUID",
"label": "Incident 1",
"category": "general_harassment"
}
],
"edges": [
{
"id": "UUID",
"source": "UUID",
"target": "UUID",
"relationship": "SIMILAR_MESSAGE_CONTENT",
"confidence": 0.74,
"explanation": "The user-provided text contains similar wording."
}
]
}

Only relationships permitted by the approved taxonomy may be returned.
Graph nodes must be restricted to records the authenticated user is
authorized to access.

### 3.13 Create Safety Session

POST /api/v1/safety-sessions

Authentication: Required

Request:
{
"trusted_contact_id": "UUID",
"incident_id": "UUID",
"checkin_deadline": "2026-11-12T12:00:00Z",
"consent_confirmed": true
}

incident_id may be null if the safety session is not associated with
a particular incident.

Response 201:
{
"id": "UUID",
"trusted_contact_id": "UUID",
"incident_id": "UUID",
"status": "active",
"checkin_deadline": "2026-11-12T12:00:00Z",
"created_at": "2026-11-12T11:00:00Z"
}

Reject the request if consent_confirmed is not true.

### 3.14 Check In to Safety Session

POST /api/v1/safety-sessions/{session_id}/checkin

Authentication: Required

Request:
{
"message": "I am safe."
}

Response 200:
{
"id": "UUID",
"status": "checked_in",
"checked_in_at": "2026-11-12T11:30:00Z"
}

Only the session owner may check in.
Repeated requests must not create duplicate check-in events.

### 3.15 List Safety Sessions

GET /api/v1/safety-sessions

Authentication: Required

Response 200:
{
"items": []
}

Return only the authenticated user's sessions.

### 3.16 Generate JusticeBridge Report

POST /api/v1/reports/{incident_id}

Authentication: Required

Request:
{
"include_evidence_index": true,
"include_analysis": true
}

Response 200:
{
"report_id": "UUID",
"incident_id": "UUID",
"status": "generated",
"file_name": "incident-report.pdf",
"download_url": "short-lived-authorized-url",
"generated_at": "2026-11-12T11:30:00Z",
"expires_at": "2026-11-12T11:40:00Z"
}

The download URL must be short-lived and authorized. It must not make
the storage bucket public.

### 3.17 Manage Trusted Contacts

POST /api/v1/trusted-contacts

Authentication: Required

Request:
{
"name": "Demo Contact",
"contact_method": "email",
"contact_value": "demo@example.test",
"consent_confirmed": true
}

Response 201:
{
"id": "UUID",
"name": "Demo Contact",
"contact_method": "email",
"created_at": "2026-11-12T11:00:00Z"
}

Supported contact methods:

- email
- phone

Do not return contact details to unrelated users.

GET /api/v1/trusted-contacts

Authentication: Required

Response 200:
{
"items": []
}

DELETE /api/v1/trusted-contacts/{contact_id}

Authentication: Required

Response:
204 No Content

Deletion must not silently delete historical session audit records.

## 4. Notification Contract

Notifications are internal Core API functionality, not a third backend.

Each notification record must use one of these statuses:

- queued
- sent
- delivered
- failed
- simulated

Only a configured provider response can justify sent or delivered.
If no provider is configured, use simulated.

A missed check-in may create a reminder notification only.
It must never trigger an automatic emergency dispatch claim.

## 5. Intelligence API Contracts

The Core API calls the Intelligence API server-to-server.

Intelligence base path:
/api/v1

### 5.1 Health

GET /health

Response:
{
"status": "ok",
"service": "intelligence-api"
}

### 5.2 Analyze Incident

POST /api/v1/analyze

Authentication:
Server-to-server authentication required in deployed environments.

Request:
{
"incident_id": "UUID",
"description": "User-provided incident description",
"evidence": [
{
"evidence_id": "UUID",
"mime_type": "image/png",
"content_base64": "base64-encoded-image"
}
]
}

Response:
{
"incident_id": "UUID",
"classification": {
"label": "general_harassment",
"confidence": 0.78,
"confidence_type": "model_score_not_calibrated_probability",
"explanation": "Reason for classification."
},
"indicators": [],
"ocr": {
"status": "completed",
"extracted_text": "Extracted synthetic demo text."
},
"risk": {
"score": 42,
"level": "moderate",
"label": "review_priority",
"factors": [],
"explanation": "Explanation of the review-priority score."
},
"limitations": [
"AI output may be inaccurate.",
"This result is not a prediction of crime or future harm."
]
}

Do not send unnecessary user profile or contact data to this service.

### 5.3 Classify Text

POST /api/v1/classify-text

Authentication:
Server-to-server authentication required in deployed environments.

Request:
{
"text": "Synthetic sample text for classification."
}

Response:
{
"label": "general_harassment",
"confidence": 0.78,
"confidence_type": "model_score_not_calibrated_probability",
"explanation": "Classification explanation.",
"indicators": []
}

### 5.4 Build Incident Graph

GET /api/v1/graph/{incident_id}

Authentication:
Server-to-server authentication required in deployed environments.

Request context must contain only incidents the Core API has authorized
for the requesting user.

Response:
{
"incident_id": "UUID",
"nodes": [],
"edges": []
}

### 5.5 Approved Classification Taxonomy

- cyberstalking
- threat
- sextortion
- impersonation
- doxxing
- image_based_abuse
- general_harassment
- other

The classifier may return other when evidence is insufficient.

## 6. Approved Graph Relationship Types

- SAME_USER_REPORTED_IDENTIFIER
- SIMILAR_MESSAGE_CONTENT
- REPEATED_CONTACT_PATTERN
- USER_REPORTED_RELATED_EVENT

Every edge must include:

- source
- target
- relationship
- confidence
- explanation

Do not connect people or incidents based only on similar names,
profile photos or unverified identity assumptions.

## 7. Contract Change Policy

Any endpoint, schema, field, authentication or status change requires:

1. Agreement between affected members.
2. Update to this file.
3. Update to backend and frontend types.
4. A corresponding test.
5. Documentation in the relevant pull request.
