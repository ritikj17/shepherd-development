"""Comprehensive Live Supabase Verification Script for SHEPHERD Member 2.

Executes live tests against the configured remote Supabase instance.
Never exposes credentials or secret values in output.
"""

import hashlib
import json
import os
import sys
import uuid
from datetime import datetime, timezone

import httpx
from dotenv import dotenv_values

cfg = dotenv_values(".env")
if not cfg:
    cfg = dotenv_values("services/api/.env")

url = cfg.get("SUPABASE_URL", "").rstrip("/")
if url.endswith("/rest/v1"):
    url = url[:-len("/rest/v1")]

service_key = cfg.get("SUPABASE_SERVICE_ROLE_KEY", "")
anon_key = cfg.get("NEXT_PUBLIC_SUPABASE_ANON_KEY", "")

if not url or not service_key or not anon_key:
    print("FATAL: Missing required Supabase configuration in .env")
    sys.exit(1)

admin_headers = {
    "apikey": service_key,
    "Authorization": f"Bearer {service_key}",
    "Content-Type": "application/json",
}

anon_headers = {
    "apikey": anon_key,
    "Content-Type": "application/json",
}

test_results = []

def record(name: str, expected: str, actual: str, passed: bool, evidence: str = ""):
    status = "PASS" if passed else "FAIL"
    test_results.append({
        "name": name,
        "expected": expected,
        "actual": actual,
        "status": status,
        "evidence": evidence,
    })
    print(f"[{status}] {name}: {actual}")


print("=================================================================")
print("STARTING LIVE SUPABASE VERIFICATION PASS")
print(f"Target Instance: {url}")
print("=================================================================\n")

# -----------------------------------------------------------------
# 1. VERIFY APPLICATION TABLES EXIST (9 TABLES)
# -----------------------------------------------------------------
expected_tables = [
    "profiles", "incidents", "evidence", "threat_analyses",
    "incident_links", "trusted_contacts", "safety_sessions",
    "alerts", "reports"
]

for tbl in expected_tables:
    r = httpx.get(f"{url}/rest/v1/{tbl}?limit=0", headers=admin_headers)
    passed = r.status_code == 200
    record(
        f"table_existence_{tbl}",
        "HTTP 200 OK",
        f"HTTP {r.status_code}",
        passed,
        f"Endpoint /rest/v1/{tbl} reachable and registered"
    )

# -----------------------------------------------------------------
# 2. VERIFY STORAGE BUCKETS
# -----------------------------------------------------------------
r = httpx.get(f"{url}/storage/v1/bucket", headers=admin_headers)
buckets = r.json() if r.status_code == 200 else []
bucket_ids = {b.get("id"): b for b in buckets}

ev_b = bucket_ids.get("shepherd-evidence")
rep_b = bucket_ids.get("shepherd-reports")

record(
    "storage_bucket_shepherd_evidence_exists",
    "Bucket exists and is private",
    f"Exists: {bool(ev_b)}, Public: {ev_b.get('public') if ev_b else None}",
    bool(ev_b and ev_b.get("public") is False),
    f"Size limit: {ev_b.get('file_size_limit') if ev_b else None}"
)

record(
    "storage_bucket_shepherd_reports_exists",
    "Bucket exists and is private",
    f"Exists: {bool(rep_b)}, Public: {rep_b.get('public') if rep_b else None}",
    bool(rep_b and rep_b.get("public") is False),
    f"Size limit: {rep_b.get('file_size_limit') if rep_b else None}"
)

# -----------------------------------------------------------------
# 3. CREATE ISOLATED TEST USERS (USER A & USER B)
# -----------------------------------------------------------------
u_suffix = uuid.uuid4().hex[:8]
email_a = f"live_test_user_a_{u_suffix}@shepherd.internal"
email_b = f"live_test_user_b_{u_suffix}@shepherd.internal"
pwd = f"S#eph3rd_Test!{u_suffix}"

r_a = httpx.post(
    f"{url}/auth/v1/admin/users",
    headers=admin_headers,
    json={"email": email_a, "password": pwd, "email_confirm": True}
)
user_a_id = r_a.json().get("id")

r_b = httpx.post(
    f"{url}/auth/v1/admin/users",
    headers=admin_headers,
    json={"email": email_b, "password": pwd, "email_confirm": True}
)
user_b_id = r_b.json().get("id")

record(
    "auth_create_user_a",
    "User A created with UUID",
    f"Status: {r_a.status_code}, User ID present: {bool(user_a_id)}",
    r_a.status_code == 200 and bool(user_a_id)
)

record(
    "auth_create_user_b",
    "User B created with UUID",
    f"Status: {r_b.status_code}, User ID present: {bool(user_b_id)}",
    r_b.status_code == 200 and bool(user_b_id)
)

# Authenticate both users
token_a_resp = httpx.post(
    f"{url}/auth/v1/token?grant_type=password",
    headers=anon_headers,
    json={"email": email_a, "password": pwd}
)
token_a = token_a_resp.json().get("access_token")

token_b_resp = httpx.post(
    f"{url}/auth/v1/token?grant_type=password",
    headers=anon_headers,
    json={"email": email_b, "password": pwd}
)
token_b = token_b_resp.json().get("access_token")

user_a_headers = {
    "apikey": anon_key,
    "Authorization": f"Bearer {token_a}",
    "Content-Type": "application/json",
    "Prefer": "return=representation",
}

user_b_headers = {
    "apikey": anon_key,
    "Authorization": f"Bearer {token_b}",
    "Content-Type": "application/json",
    "Prefer": "return=representation",
}

try:
    # -----------------------------------------------------------------
    # 4. LIVE RLS TESTS: INCIDENTS
    # -----------------------------------------------------------------
    now_iso = datetime.now(timezone.utc).isoformat()
    incident_a_id = str(uuid.uuid4())
    inc_a_payload = {
        "id": incident_a_id,
        "user_id": user_a_id,
        "title": "User A Harassment Case",
        "description": "Evidence of repeated unwanted messages.",
        "category": "general_harassment",
        "occurred_at": now_iso,
        "status": "open",
    }

    # User A inserts own incident
    r = httpx.post(f"{url}/rest/v1/incidents", headers=user_a_headers, json=inc_a_payload)
    record(
        "rls_user_a_create_own_incident",
        "HTTP 201 Created",
        f"HTTP {r.status_code}",
        r.status_code in (200, 201),
        "User A can insert own incident"
    )

    # User A reads own incident
    r = httpx.get(f"{url}/rest/v1/incidents?id=eq.{incident_a_id}", headers=user_a_headers)
    rows = r.json() if r.status_code == 200 else []
    record(
        "rls_user_a_read_own_incident",
        "Returns 1 incident row",
        f"HTTP {r.status_code}, Rows: {len(rows)}",
        len(rows) == 1 and rows[0]["id"] == incident_a_id,
        "User A can SELECT own incident"
    )

    # User A updates own incident
    r = httpx.patch(
        f"{url}/rest/v1/incidents?id=eq.{incident_a_id}",
        headers=user_a_headers,
        json={"title": "User A Harassment Case (Updated)"}
    )
    rows = r.json() if r.status_code == 200 else []
    record(
        "rls_user_a_update_own_incident",
        "Updated title returned",
        f"HTTP {r.status_code}, Updated: {rows[0]['title'] if rows else None}",
        len(rows) == 1 and rows[0]["title"] == "User A Harassment Case (Updated)",
        "User A can UPDATE own incident"
    )

    # User B CANNOT read User A's incident
    r = httpx.get(f"{url}/rest/v1/incidents?id=eq.{incident_a_id}", headers=user_b_headers)
    rows = r.json() if r.status_code == 200 else []
    record(
        "rls_user_b_cannot_read_user_a_incident",
        "Returns 0 rows (isolated by RLS)",
        f"HTTP {r.status_code}, Rows: {len(rows)}",
        len(rows) == 0,
        "Cross-user SELECT is completely blocked by RLS"
    )

    # User B CANNOT update User A's incident
    r = httpx.patch(
        f"{url}/rest/v1/incidents?id=eq.{incident_a_id}",
        headers=user_b_headers,
        json={"title": "Hacked by User B"}
    )
    rows = r.json() if r.status_code == 200 else []
    record(
        "rls_user_b_cannot_update_user_a_incident",
        "0 rows affected (RLS prevents modification)",
        f"HTTP {r.status_code}, Rows: {len(rows)}",
        len(rows) == 0,
        "Cross-user UPDATE denied by RLS policy"
    )

    # User B CANNOT delete User A's incident
    r = httpx.delete(f"{url}/rest/v1/incidents?id=eq.{incident_a_id}", headers=user_b_headers)
    rows = r.json() if r.status_code == 200 else []
    record(
        "rls_user_b_cannot_delete_user_a_incident",
        "0 rows deleted (RLS prevents deletion)",
        f"HTTP {r.status_code}, Rows: {len(rows)}",
        len(rows) == 0,
        "Cross-user DELETE denied by RLS policy"
    )

    # User B CANNOT insert an incident claiming user_id = User A
    spoofed_incident_id = str(uuid.uuid4())
    spoofed_payload = {
        "id": spoofed_incident_id,
        "user_id": user_a_id,  # Spoofed user_id
        "title": "Malicious Spoofed Incident",
        "description": "Attempting to create incident in User A's name.",
        "category": "threat",
        "occurred_at": now_iso,
        "status": "open",
    }
    r = httpx.post(f"{url}/rest/v1/incidents", headers=user_b_headers, json=spoofed_payload)
    record(
        "rls_user_b_cannot_insert_user_a_incident",
        "Rejected by RLS WITH CHECK policy (403 or empty representation)",
        f"HTTP {r.status_code} ({r.text[:60] if r.text else 'empty'})",
        r.status_code in (401, 403, 400) or r.text == "[]",
        "Client-supplied user_id cannot spoof identity past RLS"
    )

    # -----------------------------------------------------------------
    # 5. LIVE RLS TESTS: EVIDENCE & RELATIONAL CHECKS
    # -----------------------------------------------------------------
    evidence_a_id = str(uuid.uuid4())
    dummy_png_bytes = b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDRtest_live_evidence"
    sha256_hash = hashlib.sha256(dummy_png_bytes).hexdigest().lower()
    ev_a_payload = {
        "id": evidence_a_id,
        "incident_id": incident_a_id,
        "user_id": user_a_id,
        "file_name": "screenshot.png",
        "mime_type": "image/png",
        "size_bytes": len(dummy_png_bytes),
        "storage_bucket": "shepherd-evidence",
        "storage_path": f"{user_a_id}/{incident_a_id}/{evidence_a_id}/screenshot.png",
        "sha256": sha256_hash,
    }

    # User A inserts evidence under owned incident
    r = httpx.post(f"{url}/rest/v1/evidence", headers=user_a_headers, json=ev_a_payload)
    record(
        "rls_user_a_create_own_evidence",
        "HTTP 201 Created",
        f"HTTP {r.status_code}",
        r.status_code in (200, 201),
        "User A can insert evidence under own incident"
    )

    # User A reads own evidence
    r = httpx.get(f"{url}/rest/v1/evidence?id=eq.{evidence_a_id}", headers=user_a_headers)
    rows = r.json() if r.status_code == 200 else []
    record(
        "rls_user_a_read_own_evidence",
        "Returns 1 evidence row",
        f"HTTP {r.status_code}, Rows: {len(rows)}",
        len(rows) == 1 and rows[0]["id"] == evidence_a_id,
        "User A can SELECT own evidence"
    )

    # User B CANNOT read User A's evidence
    r = httpx.get(f"{url}/rest/v1/evidence?id=eq.{evidence_a_id}", headers=user_b_headers)
    rows = r.json() if r.status_code == 200 else []
    record(
        "rls_user_b_cannot_read_user_a_evidence",
        "Returns 0 rows",
        f"HTTP {r.status_code}, Rows: {len(rows)}",
        len(rows) == 0,
        "Cross-user evidence SELECT blocked by RLS"
    )

    # User B CANNOT create evidence under User A's incident
    spoofed_ev_id = str(uuid.uuid4())
    spoofed_ev_payload = {
        "id": spoofed_ev_id,
        "incident_id": incident_a_id, # User A's incident
        "user_id": user_b_id,        # User B trying to inject into User A's incident
        "file_name": "injected.png",
        "mime_type": "image/png",
        "size_bytes": 100,
        "storage_bucket": "shepherd-evidence",
        "storage_path": f"{user_b_id}/{incident_a_id}/{spoofed_ev_id}/injected.png",
        "sha256": "0" * 64,
    }
    r = httpx.post(f"{url}/rest/v1/evidence", headers=user_b_headers, json=spoofed_ev_payload)
    record(
        "rls_user_b_cannot_create_evidence_under_user_a_incident",
        "Rejected by RLS relational incident ownership check",
        f"HTTP {r.status_code} ({r.text[:60] if r.text else 'empty'})",
        r.status_code in (401, 403, 400) or r.text == "[]",
        "Relational policy EXISTS(SELECT 1 FROM incidents WHERE user_id = auth.uid()) strictly enforced"
    )

    # -----------------------------------------------------------------
    # 6. LIVE STORAGE RLS TESTS
    # -----------------------------------------------------------------
    storage_obj_path_a = f"{user_a_id}/{incident_a_id}/{evidence_a_id}/screenshot.png"
    storage_obj_path_b_spoofed = f"{user_a_id}/{incident_a_id}/spoofed/hack.png"

    # User A uploads into own path
    r = httpx.post(
        f"{url}/storage/v1/object/shepherd-evidence/{storage_obj_path_a}",
        headers={
            "apikey": anon_key,
            "Authorization": f"Bearer {token_a}",
            "Content-Type": "image/png",
        },
        content=dummy_png_bytes,
    )
    record(
        "storage_rls_user_a_upload_own_path",
        "HTTP 200 OK",
        f"HTTP {r.status_code}",
        r.status_code == 200,
        "User A can upload into own storage folder"
    )

    # User A reads own storage object
    r = httpx.get(
        f"{url}/storage/v1/object/shepherd-evidence/{storage_obj_path_a}",
        headers={"apikey": anon_key, "Authorization": f"Bearer {token_a}"}
    )
    record(
        "storage_rls_user_a_read_own_object",
        "HTTP 200 OK with matching bytes",
        f"HTTP {r.status_code}, Bytes match: {r.content == dummy_png_bytes}",
        r.status_code == 200 and r.content == dummy_png_bytes,
        "User A can read own private storage object"
    )

    # User B CANNOT read User A's storage object
    r = httpx.get(
        f"{url}/storage/v1/object/shepherd-evidence/{storage_obj_path_a}",
        headers={"apikey": anon_key, "Authorization": f"Bearer {token_b}"}
    )
    record(
        "storage_rls_user_b_cannot_read_user_a_object",
        "HTTP 400/404/403 (Access denied by Storage RLS)",
        f"HTTP {r.status_code}",
        r.status_code in (400, 403, 404),
        "Storage RLS foldername(name)[1] denies cross-user read"
    )

    # User B CANNOT upload into User A's storage path
    r = httpx.post(
        f"{url}/storage/v1/object/shepherd-evidence/{storage_obj_path_b_spoofed}",
        headers={
            "apikey": anon_key,
            "Authorization": f"Bearer {token_b}",
            "Content-Type": "image/png",
        },
        content=b"malicious_bytes",
    )
    record(
        "storage_rls_user_b_cannot_upload_into_user_a_path",
        "Access denied by Storage RLS policy (400/403/404)",
        f"HTTP {r.status_code}",
        r.status_code in (400, 403, 404),
        "Storage RLS enforces auth.uid() matches root path prefix"
    )

    # User B CANNOT delete User A's storage object
    r = httpx.delete(
        f"{url}/storage/v1/object/shepherd-evidence/{storage_obj_path_a}",
        headers={"apikey": anon_key, "Authorization": f"Bearer {token_b}"}
    )
    record(
        "storage_rls_user_b_cannot_delete_user_a_object",
        "Access denied by Storage RLS (400/403/404)",
        f"HTTP {r.status_code}",
        r.status_code in (400, 403, 404),
        "Cross-user Storage DELETE denied"
    )

    # Anonymous user CANNOT access storage object
    r = httpx.get(
        f"{url}/storage/v1/object/shepherd-evidence/{storage_obj_path_a}",
        headers={"apikey": anon_key}
    )
    record(
        "storage_rls_anonymous_access_denied",
        "HTTP 400/404/403 (Private bucket denies anon access)",
        f"HTTP {r.status_code}",
        r.status_code in (400, 403, 404),
        "Public access blocked on private bucket"
    )

    # -----------------------------------------------------------------
    # 7. CASCADE DELETION TEST ON REMOTE DATABASE
    # -----------------------------------------------------------------
    # Add threat_analysis, incident_link, report referencing incident_a_id
    ta_id = str(uuid.uuid4())
    ta_payload = {
        "id": ta_id,
        "incident_id": incident_a_id,
        "user_id": user_a_id,
        "status": "completed",
        "classification_label": "general_harassment",
        "confidence": 0.85,
        "confidence_type": "model_score_not_calibrated_probability",
        "explanation": "Pattern of persistent harassment verified.",
        "ocr_status": "completed",
    }
    r = httpx.post(f"{url}/rest/v1/threat_analyses", headers=user_a_headers, json=ta_payload)

    rep_id = str(uuid.uuid4())
    rep_payload = {
        "id": rep_id,
        "incident_id": incident_a_id,
        "user_id": user_a_id,
        "storage_bucket": "shepherd-reports",
        "storage_path": f"{user_a_id}/{incident_a_id}/{rep_id}/report.pdf",
        "status": "generated",
    }
    r = httpx.post(f"{url}/rest/v1/reports", headers=user_a_headers, json=rep_payload)

    # Verify rows exist before delete
    r_ev_before = httpx.get(f"{url}/rest/v1/evidence?incident_id=eq.{incident_a_id}", headers=admin_headers).json()
    r_ta_before = httpx.get(f"{url}/rest/v1/threat_analyses?incident_id=eq.{incident_a_id}", headers=admin_headers).json()
    r_rep_before = httpx.get(f"{url}/rest/v1/reports?incident_id=eq.{incident_a_id}", headers=admin_headers).json()

    records_created = len(r_ev_before) == 1 and len(r_ta_before) == 1 and len(r_rep_before) == 1

    # User A deletes the incident
    r_del = httpx.delete(f"{url}/rest/v1/incidents?id=eq.{incident_a_id}", headers=user_a_headers)

    # Verify cascade deletion on remote database
    r_ev_after = httpx.get(f"{url}/rest/v1/evidence?incident_id=eq.{incident_a_id}", headers=admin_headers).json()
    r_ta_after = httpx.get(f"{url}/rest/v1/threat_analyses?incident_id=eq.{incident_a_id}", headers=admin_headers).json()
    r_rep_after = httpx.get(f"{url}/rest/v1/reports?incident_id=eq.{incident_a_id}", headers=admin_headers).json()

    cascade_success = (
        records_created and
        len(r_ev_after) == 0 and
        len(r_ta_after) == 0 and
        len(r_rep_after) == 0
    )

    record(
        "remote_database_cascade_deletion",
        "Deleting incident cascades to evidence, threat_analyses, reports (0 child rows)",
        f"Child rows remaining: ev={len(r_ev_after)}, ta={len(r_ta_after)}, rep={len(r_rep_after)}",
        cascade_success,
        "ON DELETE CASCADE confirmed on live PostgreSQL"
    )

    # Clean up storage object uploaded during test
    httpx.delete(
        f"{url}/storage/v1/object/shepherd-evidence/{storage_obj_path_a}",
        headers=admin_headers
    )

    # -----------------------------------------------------------------
    # 8. TEST BIDIRECTIONAL ISOLATION (USER B -> USER A)
    # -----------------------------------------------------------------
    incident_b_id = str(uuid.uuid4())
    inc_b_payload = {
        "id": incident_b_id,
        "user_id": user_b_id,
        "title": "User B Incident",
        "description": "User B private statement.",
        "category": "threat",
        "occurred_at": now_iso,
        "status": "open",
    }
    r = httpx.post(f"{url}/rest/v1/incidents", headers=user_b_headers, json=inc_b_payload)
    
    # User A cannot read User B's incident
    r = httpx.get(f"{url}/rest/v1/incidents?id=eq.{incident_b_id}", headers=user_a_headers)
    rows = r.json() if r.status_code == 200 else []
    record(
        "rls_bidirectional_user_a_cannot_read_user_b_incident",
        "Returns 0 rows to User A",
        f"HTTP {r.status_code}, Rows: {len(rows)}",
        len(rows) == 0,
        "Bidirectional ownership isolation verified"
    )

    # User B deletes own incident
    r = httpx.delete(f"{url}/rest/v1/incidents?id=eq.{incident_b_id}", headers=user_b_headers)

finally:
    # -----------------------------------------------------------------
    # 9. CLEANUP TEST ACCOUNTS
    # -----------------------------------------------------------------
    httpx.delete(f"{url}/auth/v1/admin/users/{user_a_id}", headers=admin_headers)
    httpx.delete(f"{url}/auth/v1/admin/users/{user_b_id}", headers=admin_headers)
    print("\nTemporary test users cleaned up from Supabase Auth.")

print("\n=================================================================")
print("LIVE VERIFICATION COMPLETE")
passed_count = sum(1 for t in test_results if t["status"] == "PASS")
failed_count = sum(1 for t in test_results if t["status"] == "FAIL")
print(f"Total Live Tests: {len(test_results)}")
print(f"Passed: {passed_count}")
print(f"Failed: {failed_count}")
print("=================================================================")
