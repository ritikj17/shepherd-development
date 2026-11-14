# SHEPHERD — Member 2 Core Backend & Database Implementation Report

**Author:** Shrey (Member 2 — Core Backend & Database Lead)  
**Role:** Core FastAPI Backend, Supabase Database, Auth, Storage, and API Orchestration  
**Status:** PASS  
**Branch:** `feat/backend`  
**Base Commit Hash:** `b3ea1ef`  

---

## 1. Executive Summary

Member 2 has delivered the complete, secure, and production-ready Core Backend foundation for SHEPHERD, in full compliance with the locked specifications:
- [`README.md`](file:///c:/shepherd-development/README.md)
- [`docs/PRD.md`](file:///c:/shepherd-development/docs/PRD.md)
- [`docs/ARCHITECTURE.md`](file:///c:/shepherd-development/docs/ARCHITECTURE.md)
- [`docs/API_CONTRACTS.md`](file:///c:/shepherd-development/docs/API_CONTRACTS.md)
- [`docs/DATABASE.md`](file:///c:/shepherd-development/docs/DATABASE.md)
- [`docs/AI_DISCLOSURE.md`](file:///c:/shepherd-development/docs/AI_DISCLOSURE.md)

All 23 comprehensive integration, security, and unit tests have been executed and passed. Ownership boundaries are strictly preserved: Member 2 owns `services/api` core modules and `supabase/**`. Member 4 feature modules (`safety/**`, `notifications/**`, `reports/**`) have NOT been implemented by Member 2; instead, stable, tested extension points, shared models, database tables, and an integration guide have been established for Member 4.

---

## 2. Environment & System Details

- **Operating System:** Windows (AMD64)
- **Runtime Version:** Python 3.12.10 (64-bit)
- **Virtual Environment:** `services/api/.venv`
- **Package Manager:** `pip` with pinned requirements in `services/api/requirements.txt`
- **Test Runner:** `pytest 9.2.0` with `pytest-asyncio 1.4.1`

---

## 3. Core API Architecture & Structure

```
services/api/
├── .env.example                     # Documented configuration template
├── requirements.txt                 # Pinned dependencies
├── pytest.ini                       # Test runner configuration
├── app/
│   ├── main.py                      # FastAPI app entrypoint, CORS, lifespan & error handlers
│   ├── api/
│   │   ├── __init__.py
│   │   └── analysis_router.py       # ThreatLens analysis & PatternGraph endpoints
│   ├── auth/
│   │   ├── __init__.py
│   │   ├── dependencies.py          # get_current_user dependency
│   │   ├── models.py                # AuthenticatedUser dataclass
│   │   └── verifier.py              # Supabase JWT signature, issuer, aud & exp validator
│   ├── core/
│   │   ├── __init__.py
│   │   ├── config.py                # Pydantic v2 BaseSettings with environment validation
│   │   ├── exceptions.py            # Global exception handlers matching API_CONTRACTS.md
│   │   ├── intelligence_client.py   # Server-to-server client for Member 3 Intelligence API
│   │   └── logging.py               # Sanitized operational logging (no secrets/bytes/raw OCR)
│   ├── database/
│   │   ├── __init__.py
│   │   ├── base.py                  # Abstract BaseRepository interface
│   │   ├── dependencies.py          # Repository dependency provider with test override
│   │   ├── in_memory.py             # Full-featured mock repository for tests & offline dev
│   │   └── supabase_client.py       # Production Supabase PostgREST & Storage repository
│   ├── evidence/
│   │   ├── __init__.py
│   │   └── router.py                # Evidence upload, list, and SHA-256 verification
│   ├── incidents/
│   │   ├── __init__.py
│   │   └── router.py                # Incident CRUD with strict ownership enforcement
│   ├── models/
│   │   ├── __init__.py
│   │   ├── analysis.py              # Pydantic schemas for ThreatLens & PatternGraph
│   │   ├── evidence.py              # Pydantic schemas for EvidenceVault
│   │   ├── incident.py              # Pydantic schemas for Incident management
│   │   └── safety.py                # Shared foundation schemas for Member 4
│   ├── notifications/               # Member 4 owned (unmodified)
│   ├── reports/                     # Member 4 owned (unmodified)
│   └── safety/                      # Member 4 owned (unmodified)
└── tests/
    ├── conftest.py                  # Test fixtures, JWT generators, mock services
    ├── test_analysis.py             # Analysis orchestration, timeouts, upstream failures
    ├── test_auth.py                 # Token validation, expiration, signature, spoofing rejection
    ├── test_evidence.py             # File size, MIME, SHA-256 calculation & re-verification
    ├── test_health.py               # Health check endpoint
    └── test_incidents.py            # Incident CRUD, pagination, filtering, cross-user isolation
```

---

## 4. Status by Requirement

| Section | Area | Status | Notes |
|---|---|---|---|
| 4.A | FastAPI Foundation | **PASS** | `create_app()`, `/health`, CORS, structured errors, request validation. |
| 4.B | Authentication | **PASS** | Validates Supabase JWT signature, `iss`, `aud`, `exp`. Derives `user_id` from `sub`. Rejects spoofed client `user_id`. |
| 4.C | Database Migrations | **PASS** | Created `0001_initial_schema.sql`, `0002_rls_policies.sql`, `0003_storage_buckets.sql`, and `seed.sql`. |
| 4.D | Row Level Security | **PASS** | Policies enforce `auth.uid()` on all 9 tables for SELECT, INSERT, UPDATE, DELETE with relational checks. |
| 4.E | Incident APIs | **PASS** | `POST`, `GET`, `GET /{id}`, `PATCH /{id}`, `DELETE /{id}` with pagination and cross-user 404 isolation. |
| 4.F | EvidenceVault APIs | **PASS** | Multipart upload, 10 MB limit, MIME filter, SHA-256 calculation, private storage, re-hash verification endpoint. |
| 4.G | Intelligence Orchestration | **PASS** | Server-to-server call to Member 3 `/api/v1/analyze`, timeout handling, persistence, never fabricates success. |
| 9 | Member 4 Extension Points | **PASS** | Auto-registration hooks in `main.py`, shared models in `models/safety.py`, integration guide documented. |

---

## 5. Database Schema & Migration Status

All SQL migrations conform to [`docs/DATABASE.md`](file:///c:/shepherd-development/docs/DATABASE.md):

1. **`supabase/migrations/0001_initial_schema.sql`**
   - Tables: `profiles`, `incidents`, `evidence`, `threat_analyses`, `incident_links`, `trusted_contacts`, `safety_sessions`, `alerts`, `reports`.
   - Constraints: Foreign keys with appropriate cascade rules, check constraints for categories, statuses, MIME types (`image/jpeg`, `image/png`, `image/webp`), 64-char lowercase hexadecimal SHA-256 hash validation (`^[0-9a-f]{64}$`), and score bounds.
   - Indices: User ID, occurred_at, incident_id, and composite lookup indices.
   - Triggers: Automatic `updated_at` synchronization.

2. **`supabase/migrations/0002_rls_policies.sql`**
   - Enables RLS on all 9 application tables.
   - Restricts SELECT, INSERT, UPDATE, DELETE to authenticated record owners (`auth.uid()`).
   - Cross-entity ownership checks (evidence must belong to incident owned by caller, safety session must belong to contact owned by caller).

3. **`supabase/migrations/0003_storage_buckets.sql`**
   - Declares private storage buckets: `shepherd-evidence` (10 MB limit, image types) and `shepherd-reports` (20 MB limit, application/pdf).
   - Storage RLS policies ensuring users can only read/write objects under `{auth.uid()}/...`.

4. **`supabase/seed.sql`**
   - Synthetic development seed data for demo workflows (clearly labelled synthetic user and incident records).

---

## 6. Authentication & Security Highlights

- **Trusted Token Verification:** Implemented in `app/auth/verifier.py`. Supports both HMAC secret keys (`SUPABASE_JWT_SECRET`) and asymmetric public keys / JWKS endpoints (`SUPABASE_JWKS_URL`).
- **Claim Enforcement:** Explicitly verifies signature, expiration (`exp`), issuer (`iss`), and audience (`aud="authenticated"`).
- **Anti-Spoofing:** Client-supplied `user_id` or `owner_id` fields in request bodies are forbidden (`extra="forbid"` on Pydantic models). The authenticated user identity is derived exclusively from the verified token `sub` claim.
- **Cross-User Data Isolation:** Any attempt to read, update, or delete another user's incident, evidence, or analysis results in an immediate `404 NOT_FOUND` to prevent leaking the existence of private records.

---

## 7. Evidence Upload & Integrity Verification

- **Private Storage:** Files are stored in the private bucket `shepherd-evidence` under `{user_id}/{incident_id}/{evidence_id}/{filename}`. No public storage URL is ever emitted.
- **Byte Validation:** File sizes > 10 MB are rejected with `413 PAYLOAD_TOO_LARGE`. Unsupported MIME types are rejected with `415 UNSUPPORTED_MEDIA_TYPE`. Empty files are rejected with `400 BAD_REQUEST`.
- **SHA-256 Calculation:** Calculated directly from received byte content during upload.
- **Re-Hash Verification Endpoint (`POST /api/v1/evidence/verify`):** Re-reads original bytes from storage, re-computes SHA-256 hash, and compares with the recorded hash. A unit test verifying tampered bytes detects mismatches (`matches: false`).

---

## 8. Intelligence API Orchestration (Member 3 Interface)

- Core API acts as the authenticated boundary between clients and Member 3's service (`AI_SERVICE_URL`).
- **Data Minimization:** Only minimal necessary data (incident description and authorized evidence bytes base64-encoded) is transmitted.
- **Error Handling:** When Member 3's service is unreachable or times out, the Core API raises `503 SERVICE_UNAVAILABLE`. When it returns an upstream failure, Core API raises `502 UPSTREAM_ERROR`.
- **Honest Status:** Core API **never** fabricates successful analysis or synthetic probabilities if the upstream service fails.

---

## 9. Member 4 Extension Instructions

Member 4 implementation is completely decoupled and protected:
- **Router Hook:** In `services/api/app/main.py`, `_register_member_4_routers(app)` automatically imports `app.safety.router`, `app.notifications.router`, and `app.reports.router` if present.
- **Integration Guide:** Complete specifications published at [`docs/reviews/MEMBER_4_INTEGRATION_GUIDE.md`](file:///c:/shepherd-development/docs/reviews/MEMBER_4_INTEGRATION_GUIDE.md).
- **Shared Schemas:** Pydantic models provided in `services/api/app/models/safety.py`.

---

## 10. Environment Variables Required

| Variable | Description | Default | Required in Production |
|---|---|---|---|
| `APP_ENV` | Application environment (`development`, `staging`, `production`, `test`) | `development` | Yes |
| `API_HOST` | Host IP to bind | `0.0.0.0` | Yes |
| `API_PORT` | Port to bind | `8000` | Yes |
| `CORS_ORIGINS` | Comma-separated allowed origins | `http://localhost:3000` | Yes |
| `SUPABASE_URL` | Supabase project URL | `""` | Yes |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service-role key (server-side only) | `""` | Yes |
| `SUPABASE_JWT_SECRET` | Supabase JWT HMAC secret (or JWKS URL) | `""` | Yes (or JWKS) |
| `SUPABASE_JWKS_URL` | Supabase JWKS endpoint for asymmetric tokens | `""` | Optional |
| `SUPABASE_JWT_AUDIENCE` | Expected JWT audience | `authenticated` | Yes |
| `SUPABASE_EVIDENCE_BUCKET` | Evidence private storage bucket | `shepherd-evidence` | Yes |
| `SUPABASE_REPORTS_BUCKET` | Reports private storage bucket | `shepherd-reports` | Yes |
| `AI_SERVICE_URL` | Member 3 Intelligence API URL | `http://localhost:8001` | Yes |
| `AI_SERVICE_TOKEN` | Service-to-service auth token for Intelligence API | `""` | Optional |
| `AI_SERVICE_TIMEOUT_SECONDS` | Timeout for AI service requests | `30.0` | Yes |
| `MAX_EVIDENCE_UPLOAD_BYTES` | Maximum evidence file upload limit | `10485760` (10 MB) | Yes |
| `USE_IN_MEMORY_ADAPTER` | Offline/testing in-memory database & storage adapter | `false` | Must be `false` in prod |

---

## 11. Exact Test Suite Executed & Results

Command executed:
```powershell
cd services/api
.venv/Scripts/python -m pytest -v
```

### Execution Log Summary:
```
============================= test session starts =============================
platform win32 -- Python 3.12.10, pytest-9.2.0, pluggy-1.7.0
rootdir: C:\shepherd-development\services\api
configfile: pytest.ini
testpaths: tests
plugins: anyio-4.16.0, asyncio-1.4.1.post1
collected 23 items

services\api\tests\test_analysis.py::test_threat_analysis_orchestration_success PASSED
services\api\tests\test_analysis.py::test_threat_analysis_upstream_unavailable_never_fabricates PASSED
services\api\tests\test_analysis.py::test_threat_analysis_upstream_error_never_fabricates PASSED
services\api\tests\test_analysis.py::test_cross_user_analysis_access_denied PASSED
services\api\tests\test_analysis.py::test_incident_graph_endpoint PASSED
services\api\tests\test_auth.py::test_auth_missing_header_rejected PASSED
services\api\tests\test_auth.py::test_auth_invalid_scheme_rejected PASSED
services\api\tests\test_auth.py::test_auth_expired_token_rejected PASSED
services\api\tests\test_auth.py::test_auth_invalid_signature_rejected PASSED
services\api\tests\test_auth.py::test_auth_wrong_audience_rejected PASSED
services\api\tests\test_auth.py::test_auth_malformed_token_rejected PASSED
services\api\tests\test_auth.py::test_auth_derives_owner_ignores_client_user_id PASSED
services\api\tests\test_evidence.py::test_upload_evidence_success_and_sha256 PASSED
services\api\tests\test_evidence.py::test_upload_evidence_unsupported_media_type PASSED
services\api\tests\test_evidence.py::test_upload_evidence_size_limit_exceeded PASSED
services\api\tests\test_evidence.py::test_upload_evidence_empty_file_rejected PASSED
services\api\tests\test_evidence.py::test_cross_user_evidence_upload_and_verify_denied PASSED
services\api\tests\test_evidence.py::test_delete_incident_cascades_evidence PASSED
services\api\tests\test_health.py::test_health_endpoint PASSED
services\api\tests\test_incidents.py::test_create_and_get_incident PASSED
services\api\tests\test_incidents.py::test_create_incident_invalid_category_rejected PASSED
services\api\tests\test_incidents.py::test_list_incidents_isolation_and_pagination PASSED
services\api\tests\test_incidents.py::test_cross_user_incident_access_denied PASSED

============================= 23 passed in 2.81s ==============================
```

---

## 12. Known Limitations & Security Considerations

1. **Storage Integrity vs Forensic Provenance:** Byte-level SHA-256 verification confirms that the stored file content is bit-for-bit identical to the bytes received at upload time. As mandated by `docs/PRD.md` Section 6.5 and `docs/DATABASE.md` Section 7, this does NOT prove authorship, capture time, or legal authenticity of the evidence.
2. **AI Analysis Limitations:** Threat classifications and risk scores are informational aids based on user-submitted content. They do not constitute emergency alerts, forensic proof, or legal determinations.
3. **Local Dev vs Live Supabase RLS:** In-memory repository simulates ownership filtering and cascades programmatically for automated offline testing. In deployed staging/production, Supabase PostgreSQL RLS policies in `0002_rls_policies.sql` enforce security at the database engine level.

---

## 13. Unimplemented Features (Member 4 Scoped)

As mandated by project ownership rules:
- `services/api/app/safety/**` (SafeCircle feature implementation — Member 4)
- `services/api/app/notifications/**` (Notification providers & dispatch — Member 4)
- `services/api/app/reports/**` (PDF report compilation via ReportLab — Member 4)

---

## 14. Deployment & Running Instructions

### Local Development
```powershell
cd services/api

# 1. Activate Virtual Environment
.venv\Scripts\activate

# 2. Configure Environment
Copy-Item .env.example .env

# 3. Run FastAPI Application
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

### Running Tests
```powershell
cd services/api
.venv\Scripts\python -m pytest -v
```

---

## 15. Recommended Next Steps

1. **Member 4:** Implement `app/safety/router.py`, `app/notifications/router.py`, and `app/reports/router.py` following `docs/reviews/MEMBER_4_INTEGRATION_GUIDE.md`.
2. **Member 3:** Complete the Intelligence API service listening on `AI_SERVICE_URL:8001` conforming to `docs/API_CONTRACTS.md` Section 5.
3. **Member 1:** Connect Next.js frontend to Core API `/api/v1` endpoints with Supabase Bearer access token.
