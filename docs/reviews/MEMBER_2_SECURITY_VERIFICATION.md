# SHEPHERD — Member 2 Security Verification Report

**Auditor:** Shrey (Member 2 — Core Backend & Database Lead)  
**Role:** Senior Backend Architect, API Security Engineer & Database Lead  
**Audit Target:** Core FastAPI Backend, Supabase Database Migrations, RLS Policies, Storage Security, and API Orchestration  
**Branch:** `feat/backend`  
**Base Commit Hash:** `99167d6612214416a99a81228e853ef215d40db9`  
**Verification Date:** 2026-11-13  

---

## 1. Executive Summary

All three Supabase migrations (`0001_initial_schema.sql`, `0002_rls_policies.sql`, and `0003_storage_buckets.sql`) have been deployed to the remote Supabase project. A comprehensive read-only and transactional security verification pass was conducted against the live remote instance (`https://dhaiobswrbwfgimlktrj.supabase.co`).

- **Remote Database Schema:** **PASS** (All 9 application tables exist and respond `200 OK`)
- **Remote Storage Buckets:** **PASS** (Both private buckets provisioned with strict size limits and RLS)
- **Live User A vs. User B RLS Isolation:** **PASS** (33 live verification tests passed; zero leaks)
- **Live Foreign-Key Cascade:** **PASS** (Deleting parent incident cascades to child records on live PostgreSQL)
- **Live Storage Cleanup:** **PASS** (Real application deletion path removes storage blobs and database records)
- **Vulnerabilities Remediated:** DEFECT-01 (Magic-byte validation) and DEFECT-02 (Storage deletion ordering) **FIXED**
- **Local Test Suite:** **27/27 PASSED** (1.89s)

---

## 2. Remote Database Schema Verification

Querying the deployed PostgREST endpoints confirmed that all 9 tables exist and are registered in the schema cache:

| Table | Remote HTTP Status | RLS Status | Verified Operation |
|---|---|---|---|
| `profiles` | **HTTP 200 OK** | **ENABLED** | Queryable via REST, owned by `auth.users(id)` |
| `incidents` | **HTTP 200 OK** | **ENABLED** | Insert, Select, Update, Delete with `user_id = auth.uid()` |
| `evidence` | **HTTP 200 OK** | **ENABLED** | Relational RLS joining parent incident ownership |
| `threat_analyses` | **HTTP 200 OK** | **ENABLED** | Relational RLS joining parent incident ownership |
| `incident_links` | **HTTP 200 OK** | **ENABLED** | Relational RLS requiring dual incident ownership |
| `trusted_contacts` | **HTTP 200 OK** | **ENABLED** | Direct user ownership with `user_id = auth.uid()` |
| `safety_sessions` | **HTTP 200 OK** | **ENABLED** | Relational RLS with trusted contact verification |
| `alerts` | **HTTP 200 OK** | **ENABLED** | Relational RLS joining safety session ownership |
| `reports` | **HTTP 200 OK** | **ENABLED** | Relational RLS joining parent incident ownership |

---

## 3. Remote Storage Verification

Inspecting the live Supabase Storage API (`GET /storage/v1/bucket`) verified:

1. **`shepherd-evidence` Bucket:**
   - **Status:** Provisioned
   - **Public Access:** `False` (strictly private)
   - **File Size Limit:** `10,485,760` bytes (10 MB maximum, per API contract)
   - **Allowed MIME Types:** `['image/jpeg', 'image/png', 'image/webp']`
2. **`shepherd-reports` Bucket:**
   - **Status:** Provisioned
   - **Public Access:** `False` (strictly private)
   - **File Size Limit:** `20,971,520` bytes (20 MB maximum)
   - **Allowed MIME Types:** `['application/pdf']`
3. **Storage RLS Policies:**
   - Evaluated by `storage.objects` table with policy prefix `auth.uid()::text = (storage.foldername(name))[1]`.

---

## 4. Live Multi-User RLS Isolation Matrix

Two dedicated synthetic authenticated accounts (`User A` and `User B`) were provisioned via the Supabase Auth Admin API and logged in to acquire real JWT sessions.

### 4.1 Incident Isolation
* **User A Own Operations:**
  - `User A` inserts own incident: **PASS (HTTP 201 Created)**
  - `User A` selects own incident: **PASS (HTTP 200 OK, 1 row returned)**
  - `User A` updates own incident: **PASS (HTTP 200 OK, updated title returned)**
* **Cross-User Protection (User B attacking User A):**
  - `User B` reads `User A` incident: **PASS (HTTP 200 OK, 0 rows returned)** — RLS filters out rows where `user_id != auth.uid()`.
  - `User B` updates `User A` incident: **PASS (HTTP 200 OK, 0 rows affected)** — RLS prevents unauthorized update.
  - `User B` deletes `User A` incident: **PASS (HTTP 200 OK, 0 rows deleted)** — RLS prevents unauthorized delete.
  - `User B` attempts to insert incident with `user_id = User A`: **PASS (HTTP 403 Forbidden)** — PostgREST returns error `42501: new row violates row-level security policy for table "incidents"`. Identity spoofing is completely impossible at the database engine level.
* **Bidirectional Isolation:**
  - `User B` creates own incident: `User A` selects `User B` incident -> **PASS (HTTP 200 OK, 0 rows returned)**.

### 4.2 Evidence & Relational RLS Isolation
* `User A` creates evidence under owned incident: **PASS (HTTP 201 Created)**
* `User A` reads own evidence: **PASS (HTTP 200 OK, 1 row returned)**
* `User B` reads `User A` evidence: **PASS (HTTP 200 OK, 0 rows returned)**
* `User B` attempts to create evidence under `User A` incident: **PASS (HTTP 403 Forbidden)** — PostgREST returns error `42501: new row violates row-level security policy for table "evidence"` because `EXISTS (SELECT 1 FROM incidents WHERE i.id = incident_id AND i.user_id = auth.uid())` evaluates to false.

---

## 5. Live Storage RLS Verification

* **User A Path Access:**
  - Upload to `{user_a_id}/{incident_id}/{evidence_id}/screenshot.png`: **PASS (HTTP 200 OK)**
  - Download own object: **PASS (HTTP 200 OK, bytes match original exactly)**
* **Cross-User Storage Isolation (User B attacking User A):**
  - `User B` downloads `User A` object: **PASS (HTTP 400 Bad Request / RLS denied)**
  - `User B` uploads into `User A` path `{user_a_id}/...`: **PASS (HTTP 400 Bad Request / RLS denied)**
  - `User B` deletes `User A` object: **PASS (HTTP 400 Bad Request / RLS denied)**
* **Anonymous Access:**
  - Anonymous client without authorization token requests object: **PASS (HTTP 400 Bad Request / Access denied)**

---

## 6. Live Cascade Deletion Verification

1. A test incident was created for `User A`.
2. Dependent rows were inserted:
   - `evidence` record referencing `incident_id`
   - `threat_analyses` record referencing `incident_id`
   - `reports` record referencing `incident_id`
3. Incident was deleted via `DELETE /rest/v1/incidents?id=eq.{incident_id}`.
4. Remote database was queried directly with service-role privileges:
   - Remaining `evidence` rows: `0`
   - Remaining `threat_analyses` rows: `0`
   - Remaining `reports` rows: `0`
5. **Result: PASS** — PostgreSQL foreign-key `ON DELETE CASCADE` verified operational on the live database.

---

## 7. Live Application Storage Cleanup Verification

The application's real repository implementation (`SupabasePostgrestRepository`) was executed end-to-end against live Supabase:
1. Created test incident via `create_incident`.
2. Uploaded test evidence via `upload_evidence` (blob stored in live Supabase Storage, metadata inserted in database).
3. Verified the object existed in `shepherd-evidence` bucket.
4. Called `repo.delete_incident`.
5. Verified on live Storage that the blob was deleted from the bucket.
6. Verified on live database that the incident and evidence records were deleted.
7. **Result: PASS** — Zero orphaned blobs; ordering defect remediation verified live.

---

## 8. Defect Status & Code Hardening

### DEFECT-01: Server-Side Magic-Byte Validation (FIXED)
- Implemented `validate_evidence_content` in `app/models/evidence.py`.
- Enforces JPEG (`\xFF\xD8\xFF`), PNG (`\x89PNG\r\n\x1a\n`), WebP (`RIFF....WEBP`).
- Rejects spoofed MIME headers with `415 UNSUPPORTED_MEDIA_TYPE`.
- Regression tests: `test_upload_evidence_misleading_mime_header_rejected` and `test_upload_evidence_all_supported_formats_with_magic_bytes` (PASSED).

### DEFECT-02: Storage Deletion Sequence Ordering (FIXED)
- Reversed deletion sequence in `supabase_client.py`: storage objects deleted prior to database record removal.
- Corrected HTTP DELETE invocation to `client.request("DELETE", url, json=payload)` to support JSON prefix arrays in httpx.
- Regression test: `test_supabase_deletion_ordering_deletes_storage_before_db` (PASSED).

---

## 9. Comprehensive Live Test Execution Log (33 Tests)

| # | Test Name | Expected Behavior | Actual Behavior | Result | Evidence |
|---|---|---|---|---|---|
| 1 | `table_existence_profiles` | HTTP 200 OK | HTTP 200 OK | **PASS** | Table exists in remote schema |
| 2 | `table_existence_incidents` | HTTP 200 OK | HTTP 200 OK | **PASS** | Table exists in remote schema |
| 3 | `table_existence_evidence` | HTTP 200 OK | HTTP 200 OK | **PASS** | Table exists in remote schema |
| 4 | `table_existence_threat_analyses` | HTTP 200 OK | HTTP 200 OK | **PASS** | Table exists in remote schema |
| 5 | `table_existence_incident_links` | HTTP 200 OK | HTTP 200 OK | **PASS** | Table exists in remote schema |
| 6 | `table_existence_trusted_contacts` | HTTP 200 OK | HTTP 200 OK | **PASS** | Table exists in remote schema |
| 7 | `table_existence_safety_sessions` | HTTP 200 OK | HTTP 200 OK | **PASS** | Table exists in remote schema |
| 8 | `table_existence_alerts` | HTTP 200 OK | HTTP 200 OK | **PASS** | Table exists in remote schema |
| 9 | `table_existence_reports` | HTTP 200 OK | HTTP 200 OK | **PASS** | Table exists in remote schema |
| 10 | `storage_bucket_shepherd_evidence_exists` | Bucket exists & private | Exists: True, Public: False | **PASS** | Limit: 10,485,760 bytes |
| 11 | `storage_bucket_shepherd_reports_exists` | Bucket exists & private | Exists: True, Public: False | **PASS** | Limit: 20,971,520 bytes |
| 12 | `auth_create_user_a` | User A provisioned | HTTP 200 OK | **PASS** | UUID acquired |
| 13 | `auth_create_user_b` | User B provisioned | HTTP 200 OK | **PASS** | UUID acquired |
| 14 | `rls_user_a_create_own_incident` | HTTP 201 Created | HTTP 201 Created | **PASS** | User A insert permitted |
| 15 | `rls_user_a_read_own_incident` | 1 row returned | HTTP 200 OK, 1 row | **PASS** | User A select permitted |
| 16 | `rls_user_a_update_own_incident` | Title updated | HTTP 200 OK, title changed | **PASS** | User A update permitted |
| 17 | `rls_user_b_cannot_read_user_a_incident` | 0 rows returned | HTTP 200 OK, 0 rows | **PASS** | Cross-user SELECT blocked |
| 18 | `rls_user_b_cannot_update_user_a_incident` | 0 rows affected | HTTP 200 OK, 0 rows | **PASS** | Cross-user UPDATE blocked |
| 19 | `rls_user_b_cannot_delete_user_a_incident` | 0 rows affected | HTTP 200 OK, 0 rows | **PASS** | Cross-user DELETE blocked |
| 20 | `rls_user_b_cannot_insert_user_a_incident` | 403 RLS violation | HTTP 403 Forbidden (42501) | **PASS** | Client user_id spoofing blocked |
| 21 | `rls_user_a_create_own_evidence` | HTTP 201 Created | HTTP 201 Created | **PASS** | Evidence insert permitted |
| 22 | `rls_user_a_read_own_evidence` | 1 row returned | HTTP 200 OK, 1 row | **PASS** | Evidence select permitted |
| 23 | `rls_user_b_cannot_read_user_a_evidence` | 0 rows returned | HTTP 200 OK, 0 rows | **PASS** | Cross-user evidence SELECT blocked |
| 24 | `rls_user_b_cannot_create_evidence_under_user_a_incident` | 403 RLS violation | HTTP 403 Forbidden (42501) | **PASS** | Relational check enforced |
| 25 | `storage_rls_user_a_upload_own_path` | HTTP 200 OK | HTTP 200 OK | **PASS** | Object upload permitted |
| 26 | `storage_rls_user_a_read_own_object` | HTTP 200 OK, bytes match | HTTP 200 OK, bytes match | **PASS** | Object read permitted |
| 27 | `storage_rls_user_b_cannot_read_user_a_object` | Access denied | HTTP 400 Bad Request | **PASS** | Cross-user read denied |
| 28 | `storage_rls_user_b_cannot_upload_into_user_a_path` | Access denied | HTTP 400 Bad Request | **PASS** | Cross-user upload denied |
| 29 | `storage_rls_user_b_cannot_delete_user_a_object` | Access denied | HTTP 400 Bad Request | **PASS** | Cross-user delete denied |
| 30 | `storage_rls_anonymous_access_denied` | Access denied | HTTP 400 Bad Request | **PASS** | Anonymous access denied |
| 31 | `remote_database_cascade_deletion` | 0 child rows remaining | ev=0, ta=0, rep=0 | **PASS** | ON DELETE CASCADE verified |
| 32 | `rls_bidirectional_user_a_cannot_read_user_b_incident` | 0 rows returned | HTTP 200 OK, 0 rows | **PASS** | Bidirectional isolation verified |
| 33 | `live_application_storage_cleanup` | Blob deleted & row deleted | Storage deleted: True, DB deleted: True | **PASS** | End-to-end app deletion flow verified |

---

## 10. Distinction of Environments

### LIVE VERIFIED
- Remote Supabase database schema (all 9 tables verified via PostgREST).
- Remote Supabase Storage private buckets and configuration (`shepherd-evidence`, `shepherd-reports`).
- Real PostgreSQL Row Level Security (RLS) enforcement across User A and User B.
- Anti-spoofing enforcement at the database layer (preventing cross-user row insertion).
- Remote PostgreSQL `ON DELETE CASCADE` triggers.
- Live Storage object deletion and orphan prevention.

### STATIC VERIFIED
- JWT verification logic (signature, issuer, audience, algorithm whitelist).
- Request model constraints (`extra="forbid"` on all schemas).
- Server-side magic-byte inspection logic.
- Member 3 API contract alignment.

### NOT VERIFIED
- Live Member 3 external microservice integration (upstream service is not running on port 8001; offline contracts and fallback handlers fully verified).

---

## 11. Local Automated Test Suite

All 27 automated tests pass locally:
```text
============================= 27 passed in 1.89s ==============================
```
- Unit tests: 11 passed
- In-memory integration tests: 13 passed
- Mocked external service tests: 3 passed
