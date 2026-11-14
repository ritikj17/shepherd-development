# SHEPHERD — Live Integration Mode & End-to-End Stabilization Report

**Date:** November 14, 2026  
**Branch:** `fix/e2e-integration`  
**Base Commit:** `0ab648f` (`origin/main`)  
**Lead Engineer:** Lead Full-Stack Integration, Backend Architect & Member 4 Lead  

---

## 1. Executive Summary

Following the merger of all four team member pull requests (PR #1 Core Backend, PR #2 Frontend, PR #3 SafeCircle/Notifications/JusticeBridge, and PR #4/#5 Intelligence Service) into `main`, a comprehensive cross-service audit identified several critical runtime blockers that prevented the application from functioning end-to-end in live mode.

On the `fix/e2e-integration` branch, all critical issues have been reproduced, isolated, resolved, and verified with automated regression tests. Across the monorepo, **126 automated unit, integration, and end-to-end tests are passing** with zero failures:
* **Frontend (`apps/web`):** 52 tests passing (Vitest), TypeScript 0 errors, ESLint 0 errors, Next.js 16 production build clean.
* **Core API (`services/api`):** 58 tests passing (Pytest) including full 10-step live integration verification.
* **Intelligence Service (`services/intelligence`):** 16 tests passing (Pytest) including description-only and threat-matching regression tests.

---

## 2. Confirmed Root Causes & Fixes Implemented

### Issue 1: Intelligence Risk Engine Crash (`AttributeError: 'dict' object has no attribute 'lower'`)
* **File:** `services/intelligence/app/risk/compute.py`
* **Root Cause:** In `compute_risk()`, the classifier returned indicators formatted as dictionaries (`{"name": "...", "description": "..."}`). Line 54 attempted `any(kw in indicator.lower() ...)`, raising an unhandled `AttributeError` whenever a threat pattern was detected.
* **Fix:** Implemented `_indicator_text(indicator)` to safely inspect `name` and `description` from dictionary indicators, strings, or malformed entries without throwing exceptions.
* **Regression Tests:** Added `test_threat_indicator_dict_matching_sets_t_factor()`, `test_threat_indicator_dict_non_matching()`, and `test_threat_indicator_malformed_and_edge_cases()`.

### Issue 2: Incident Description Ignored by Intelligence Classifier
* **File:** `services/intelligence/app/api/__init__.py`
* **Root Cause:** `/api/v1/analyze` only passed OCR-extracted text (`combined_text`) into `classify_text()`. If an incident had no image evidence or OCR extracted no text, `combined_text` was empty `""`, and the classifier always defaulted to `"other"` with `0.0` confidence.
* **Fix:** Combined the user's `request.description` with `combined_text` (`text_to_classify = f"{desc} {combined_text}".strip()`), ensuring victim descriptions are classified even when evidence images are absent.
* **Regression Tests:** Added `test_analyze_description_only_influences_classification()`, `test_threat_matching_request_returns_valid_200_not_500()`, and `test_analyze_empty_inputs_safe()`.

### Issue 3: Missing `reportlab` in Core API Dependencies
* **File:** `services/api/requirements.txt`
* **Root Cause:** `app/reports/pdf_builder.py` requires ReportLab for Platypus PDF compilation, but `reportlab>=4.0.0` was absent from `requirements.txt`.
* **Fix:** Added `reportlab>=4.0.0` to `services/api/requirements.txt` and verified clean installation and execution with Python 3.14.

### Issue 4: JusticeBridge PDF Download HTTP 401 in Browser
* **Files:** `apps/web/lib/api/reports.ts`, `apps/web/lib/api/index.ts`, `apps/web/components/reports/justicebridge-view.tsx`
* **Root Cause:** The UI used an `<a href="/api/v1/reports/{id}/download" download>` element. Standard browser navigation cannot attach custom `Authorization: Bearer <token>` headers, causing the backend endpoint to reject downloads with 401 Unauthorized.
* **Fix:** Implemented `downloadIncidentReport(reportId, fallbackFileName)` using `fetch` with the `Authorization` header provided by `getApiAccessToken()`. Converts the verified 200 response to a `Blob`, triggers an anchor download, and revokes the object URL. Replaced the bare anchor in `justicebridge-view.tsx` with an interactive button showing loading spinners and error toasts.
* **Regression Tests:** Created `apps/web/tests/reports-download.test.ts` covering 7 test scenarios (success, missing token, 401, 403, 404, 500, and demo mode).

### Issue 5: Missing `AI_SERVICE_TOKEN` in Environment Configurations
* **Files:** `.env.example`, `services/api/.env.example`, `services/intelligence/.env.example`
* **Root Cause:** `services/intelligence` strictly validates `AI_SERVICE_TOKEN` on all server-to-server endpoints. When missing, it returns HTTP 500 `CONFIG_ERROR`.
* **Fix:** Added documented development placeholders (`AI_SERVICE_TOKEN=replace-with-a-local-development-secret`) across all example environment files.

### Issue 6: PatternGraph Fallback Logic
* **File:** `services/api/app/api/analysis_router.py`
* **Root Cause:** The upstream Intelligence API returns `{incident_id: ..., nodes: [], edges: []}`. Because the returned dict was non-empty, `if upstream_graph:` evaluated to `True`, preventing fallback to stored relationships in the repository graph.
* **Fix:** Updated the check to `if upstream_graph and (upstream_graph.get("nodes") or upstream_graph.get("edges")):`. When upstream nodes are empty, it gracefully falls back to `repo.get_incident_graph()`.
* **Regression Tests:** Added `test_incident_graph_upstream_populated()`, `test_incident_graph_upstream_empty_fallback_to_repo()`, and `test_incident_graph_cross_user_denied()`.

### Issue 7: Demo Auth Token for Local In-Memory Development
* **File:** `apps/web/lib/auth/auth-provider.tsx`
* **Root Cause:** When running frontend in demo mode (`!isSupabaseConfigured`) against a local in-memory backend (`USE_IN_MEMORY_ADAPTER=true`), the token provider returned `null`. The backend's token verifier expects `mock-user-*` tokens during development.
* **Fix:** Gated `auth-provider.tsx` so that when Supabase is unconfigured, it supplies `"mock-user-demo"`. Production builds with Supabase continue using real JWT session tokens.

---

## 3. Database Safety & Migrations Assessment

### Migration History Analysis
* **Canonical Schema:** `0001_initial_schema.sql`, `0002_rls_policies.sql`, `0003_storage_buckets.sql` authored by Member 2 (`docs/DATABASE.md`). Defines all 9 application tables (`profiles`, `incidents`, `evidence`, `threat_analyses`, `incident_links`, `trusted_contacts`, `safety_sessions`, `alerts`, `reports`) with complete RLS policies and storage buckets.
* **Redundant Files:** `20231113_create_incidents.sql`, `20231113_create_evidence.sql`, `20231113_create_incident_links.sql`, `20231113_create_threat_analyses.sql` added in PR #5.
  * These files use mismatched column names (`incident_id` vs `id`, `owner_id` vs `user_id`, `byte_size` vs `size_bytes`), lack incident `title`, and lack RLS policies.
  * Every table definition in `20231113_*` uses `CREATE TABLE IF NOT EXISTS`. Since `0001_initial_schema.sql` runs first alphabetically, PostgreSQL skips these redundant statements without crashing.

### Database Safety Action
In accordance with Database Safety Rules:
1. Historical migrations have **not** been destructively deleted.
2. Production RLS has **not** been disabled or weakened.
3. No tables or columns have been dropped.
4. **Recommendation for Team:** Once remote database verification confirms `0001` through `0003` are applied, archive the `20231113_*` files in a subsequent cleanup PR.

---

## 4. Dead Code Inspection (Issue 7)

* **File:** `services/api/app/api/routes/incidents.py`
* **Audit Result:** Confirmed to be 100% unused and unmounted. `services/api/app/main.py` explicitly mounts `app.incidents.router` and `app.api.analysis_router`. The unmounted file contains an invalid cross-service import (`from services.intelligence.app.schemas.analyze...`) and obsolete query parameters.
* **Action:** Documented as dead code. Retained safely without runtime side-effects; proposed for removal in future refactoring.

---

## 5. Automated Test Results

### Core API (`services/api`)
```powershell
uv run --with pytest --with pytest-asyncio --with httpx --with "PyJWT[crypto]" --with pydantic --with pydantic-settings --with python-multipart --with fastapi --with reportlab pytest -v
```
* **Result:** **58 passed**, 1 warning in 1.36s (100% pass rate)
* **Categories:** Incidents, Evidence, Auth, Analysis, PatternGraph fallback, SafeCircle, Notifications, JusticeBridge, and Live E2E workflow.

### Intelligence Service (`services/intelligence`)
```powershell
uv run --with pytest --with pytest-asyncio --with httpx --with fastapi --with pydantic --with pillow --with pytesseract --with networkx --with uvicorn pytest -v
```
* **Result:** **16 passed**, 1 warning in 0.64s (100% pass rate)
* **Categories:** Token authentication, input validation, OCR error handling, description-only classification, threat detection without AttributeError, and malformed indicator resilience.

### Frontend (`apps/web`)
```powershell
npm run typecheck
npm run test
npm run lint
npm run build
```
* **TypeScript:** 0 errors (`tsc --noEmit` passed)
* **Vitest:** **52 passed** across 5 test suites in 883ms
* **ESLint:** 0 errors / clean
* **Next.js 16 Build:** Successfully compiled in 1.7s; 16 routes generated.

**Monorepo Total:** **126 / 126 automated tests passing.**

---

## 6. Local Setup & Service Startup Guide

### Environment Variables
Copy `.env.example` to `.env` in the root (or configure each service):
```env
# Frontend
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000/api/v1
NEXT_PUBLIC_USE_MOCK_API=false

# Core API
API_HOST=0.0.0.0
API_PORT=8000
USE_IN_MEMORY_ADAPTER=true
CORS_ORIGINS=http://localhost:3000
AI_SERVICE_URL=http://localhost:8001
AI_SERVICE_TOKEN=replace-with-a-local-development-secret

# Intelligence Service
AI_HOST=0.0.0.0
AI_PORT=8001
AI_SERVICE_TOKEN=replace-with-a-local-development-secret

# Notifications
NOTIFICATION_PROVIDER=mock
NOTIFICATION_SENDER=SHEPHERD
```

### Running the Services Locally

1. **Terminal 1 — Intelligence Microservice (Port 8001):**
   ```powershell
   cd services/intelligence
   $env:AI_SERVICE_TOKEN="replace-with-a-local-development-secret"
   uv run --with uvicorn --with fastapi --with pydantic --with pillow --with pytesseract --with networkx uvicorn app.main:app --port 8001 --reload
   ```

2. **Terminal 2 — Core FastAPI Backend (Port 8000):**
   ```powershell
   cd services/api
   $env:USE_IN_MEMORY_ADAPTER="true"
   $env:AI_SERVICE_URL="http://localhost:8001"
   $env:AI_SERVICE_TOKEN="replace-with-a-local-development-secret"
   uv run --with uvicorn --with fastapi --with "PyJWT[crypto]" --with pydantic-settings --with python-multipart --with reportlab uvicorn app.main:app --port 8000 --reload
   ```

3. **Terminal 3 — Next.js Web Frontend (Port 3000):**
   ```powershell
   cd apps/web
   $env:NEXT_PUBLIC_USE_MOCK_API="false"
   $env:NEXT_PUBLIC_API_BASE_URL="http://localhost:8000/api/v1"
   npm run dev
   ```

---

## 7. Real vs. Simulated Capabilities

* **Authentication:**
  * Real Supabase JWT authentication is supported when `NEXT_PUBLIC_SUPABASE_URL` and keys are provided.
  * In-memory local demo mode uses deterministically hashed mock UUIDs (`mock-user-*`) restricted strictly to `USE_IN_MEMORY_ADAPTER=true`.
* **Evidence Storage & SHA-256:**
  * Real byte-exact SHA-256 hashing is calculated on every upload and verified on every download/report generation.
  * Real Supabase Storage bucket uploads occur when connected to Supabase; in-memory byte buffers are used locally.
* **OCR & AI Classification:**
  * Rule-based heuristic classification is performed locally by Member 3's deterministic classifier.
  * OCR is executed via native `pytesseract` when Tesseract binary is installed on the host OS; falls back safely to `status: "failed"` without crashing if missing.
* **Notifications:**
  * Marked as `simulated=True` and status `simulated` by default to prevent unauthorized carrier fees or SMS spam during hackathon evaluation.
* **JusticeBridge Reports:**
  * Real, valid PDF documents are compiled dynamically using ReportLab Platypus and downloaded as authenticated binary blobs.
