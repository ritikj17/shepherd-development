# SHEPHERD — Member 4 Integration Guide

**Author:** Shrey (Member 2 — Core Backend & Database Lead)  
**Target:** Member 4 (SafeCircle, Notifications, JusticeBridge Reporting Lead)  
**Status:** ACTIVE & LOCKED CONTRACTS  

---

## 1. Overview & Ownership Boundaries

Member 4 owns the following feature directories:
- `services/api/app/safety/**` (SafeCircle check-in sessions & trusted contact APIs)
- `services/api/app/notifications/**` (Consent-based reminder/alert dispatch logic)
- `services/api/app/reports/**` (JusticeBridge chronological PDF report generation)
- Associated test modules in `services/api/tests/` dedicated to those features

### Protected Core Files (DO NOT Modify Without Member 2 Approval)
Member 4 must coordinate with Member 2 before altering any of:
- `services/api/app/main.py`
- `services/api/app/auth/**`
- `services/api/app/core/**`
- `services/api/app/database/**`
- `services/api/app/incidents/**`
- `services/api/app/evidence/**`
- `services/api/app/models/` (shared schemas)
- `supabase/migrations/**` (database schemas and RLS policies)

---

## 2. Router Inclusion Mechanism

In `services/api/app/main.py`, Member 2 has already implemented an automated discovery hook. When you add your router objects, they will be registered at application startup without requiring you to edit `main.py`:

```python
# Exposed module and attribute paths expected:
# 1. services/api/app/safety/router.py -> router
# 2. services/api/app/notifications/router.py -> router
# 3. services/api/app/reports/router.py -> router
```

### Router Definition Example
In `services/api/app/safety/router.py`:
```python
from fastapi import APIRouter, Depends, status
from app.auth.dependencies import get_current_user
from app.auth.models import AuthenticatedUser
from app.models.safety import SafetySessionCreate, SafetySessionResponse

router = APIRouter(prefix="/api/v1/safety-sessions", tags=["SafeCircle"])

@router.post("", response_model=SafetySessionResponse, status_code=status.HTTP_201_CREATED)
async def create_safety_session(
    data: SafetySessionCreate,
    current_user: AuthenticatedUser = Depends(get_current_user),
):
    # Enforce consent_confirmed == True per PRD & API Contracts
    if not data.consent_confirmed:
        raise BadRequestError("Consent confirmation is required.")
    ...
```

---

## 3. Shared Authentication Dependency

All protected endpoints MUST enforce user identity using:
```python
from app.auth.dependencies import get_current_user
from app.auth.models import AuthenticatedUser

@router.get("/my-endpoint")
async def my_endpoint(current_user: AuthenticatedUser = Depends(get_current_user)):
    user_id = current_user.id  # Verified UUID from JWT
```

**Security Rules:**
1. **Never accept `user_id` or `owner_id` from request parameters or request bodies** as proof of identity.
2. Derivation is strictly from the verified Supabase Bearer token.
3. Reject missing or expired tokens automatically via the dependency.

---

## 4. Shared Database Models & Migrations

Member 2 has already created the database schema and RLS policies for your tables:
- `trusted_contacts` (`id`, `user_id`, `name`, `contact_method`, `contact_value`, `consent_confirmed`, timestamps)
- `safety_sessions` (`id`, `user_id`, `trusted_contact_id`, `incident_id`, `status`, `checkin_deadline`, `checked_in_at`, timestamps)
- `alerts` (`id`, `user_id`, `safety_session_id`, `trusted_contact_id`, `channel`, `status`, `provider_reference`, timestamps)
- `reports` (`id`, `user_id`, `incident_id`, `storage_bucket`, `storage_path`, `status`, `generated_at`, `expires_at`)

Shared Pydantic schemas are provided in:
- `services/api/app/models/safety.py`

### Storage Bucket for Reports
- Bucket name: `shepherd-reports` (Private bucket)
- Object path convention: `{user_id}/{incident_id}/{report_id}.pdf`
- Do NOT generate permanent public URLs. Return short-lived authorized URLs.

---

## 5. Standard Error Format & Exceptions

All endpoints must return errors formatted as:
```json
{
  "error": {
    "code": "BAD_REQUEST",
    "message": "Human-readable message",
    "details": {}
  }
}
```

Use the built-in exception classes in `app.core.exceptions`:
- `BadRequestError(message, details)` -> 400
- `AuthenticationError(message, details)` -> 401
- `AuthorizationError(message, details)` -> 403
- `NotFoundError(message, details)` -> 404
- `PayloadTooLargeError(message, details)` -> 413
- `UpstreamServiceError(message, details)` -> 502
- `ServiceUnavailableError(message, details)` -> 503

---

## 6. Testing Conventions

1. Use pytest with the project virtual environment:
   ```powershell
   cd services/api
   .venv/Scripts/pytest -v
   ```
2. Rely on the `conftest.py` fixtures (`client`, `user_1_headers`, `user_2_headers`, `repo`).
3. Ensure cross-user access tests return 404 (`NOT_FOUND`) rather than leaking information about another user's records.
