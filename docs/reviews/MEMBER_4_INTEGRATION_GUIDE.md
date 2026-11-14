# SHEPHERD — Member 4 Integration & Handoff Guide

**Author:** Mudit (Member 4 — Safety Response, Notifications & JusticeBridge Lead)  
**Target:** Shrey (Member 2 — Core Backend & Database Lead)  
**Status:** IMPLEMENTED & READY FOR INTEGRATION  
**Branch:** `feat/response`  

---

## 1. Overview of Delivered Modules

Member 4 has completed the implementation of all assigned modules within `services/api/`:
- `services/api/app/safety/**` (SafeCircle check-in sessions & trusted contact APIs)
- `services/api/app/notifications/**` (Consent-based reminder/alert dispatch logic & logs)
- `services/api/app/reports/**` (JusticeBridge chronological PDF report generation via ReportLab)
- Associated test modules in `services/api/tests/`:
  - `test_safety.py` (12 tests)
  - `test_notifications.py` (4 tests)
  - `test_reports.py` (5 tests)

All 48 tests (27 Core + 21 Member 4) pass with zero errors.

---

## 2. Router Module Paths & Registration Details

Because Shrey previously implemented the dynamic router hook in `services/api/app/main.py`:
```python
optional_routers = [
    ("app.safety.router", "router"),
    ("app.notifications.router", "router"),
    ("app.reports.router", "router"),
]
```
**No edits to `services/api/app/main.py` are needed!** The application automatically detects and mounts all three routers.

### Router Specifications:

1. **SafeCircle Router:**
   - **Module Path:** `app.safety.router`
   - **Exported Variable:** `router`
   - **Prefix:** `/api/v1`
   - **Tag:** `SafeCircle`
   - **Routes:**
     - `POST /api/v1/trusted-contacts`
     - `GET /api/v1/trusted-contacts`
     - `DELETE /api/v1/trusted-contacts/{contact_id}`
     - `POST /api/v1/safety-sessions`
     - `GET /api/v1/safety-sessions`
     - `POST /api/v1/safety-sessions/{session_id}/checkin`
     - `POST /api/v1/safety-sessions/{session_id}/cancel`

2. **Notifications Router:**
   - **Module Path:** `app.notifications.router`
   - **Exported Variable:** `router`
   - **Prefix:** `/api/v1`
   - **Tag:** `Notifications & Alerts`
   - **Routes:**
     - `GET /api/v1/alerts`
     - `GET /api/v1/alerts/{alert_id}`
     - `POST /api/v1/notifications/check-overdue`

3. **JusticeBridge Reports Router:**
   - **Module Path:** `app.reports.router`
   - **Exported Variable:** `router`
   - **Prefix:** `/api/v1`
   - **Tag:** `JusticeBridge Reports`
   - **Routes:**
     - `POST /api/v1/reports/{incident_id}`
     - `GET /api/v1/reports/{report_id}/download`
     - `GET /api/v1/reports`

---

## 3. Required Shared Dependencies

Member 4 utilized `reportlab` for generating the JusticeBridge PDF summaries.

Please ensure `services/api/requirements.txt` includes:
```text
reportlab>=4.0.0
```

Member 4 did NOT modify `services/api/requirements.txt` directly to preserve Shrey's file ownership.

---

## 4. Environment Variables

All modules utilize the existing Core configuration in `app.core.config.Settings`:

- `APP_ENV`: Used to determine runtime logging and environment level.
- `USE_IN_MEMORY_ADAPTER`: When `true` (or when Supabase credentials are empty), modules use the tested in-memory repositories. When `false` with credentials supplied, modules interact with Supabase PostgREST & Storage.
- `SUPABASE_URL`: Supabase project base URL.
- `SUPABASE_SERVICE_ROLE_KEY`: Service role key for backend PostgREST and storage access.
- `SUPABASE_REPORTS_BUCKET`: Default `"shepherd-reports"` for private PDF storage.

---

## 5. Database Schema & Migration Status

- **Database Tables Reused:**
  - `public.trusted_contacts` (Migration `0001_initial_schema.sql`)
  - `public.safety_sessions` (Migration `0001_initial_schema.sql`)
  - `public.alerts` (Migration `0001_initial_schema.sql`)
  - `public.reports` (Migration `0001_initial_schema.sql`)
- **Storage Buckets Reused:**
  - `shepherd-reports` (Migration `0003_storage_buckets.sql`)
- **Shared Pydantic Schemas Reused:**
  - `app.models.safety.py`

**No migration changes or schema modifications are required.** Everything aligned with Shrey's pre-built tables and RLS policies.

---

## 6. How to Run the Member 4 Test Suite

From repository root:
```powershell
cd services/api
uv run --with pytest --with pytest-asyncio --with httpx --with "PyJWT[crypto]" --with pydantic --with pydantic-settings --with python-multipart --with fastapi --with reportlab pytest -v
```
All 48 tests will execute in <1s.
