# SHEPHERD — Member 1 Frontend Audit

**Audit date:** 13 November 2026  
**Auditor:** OpenCode (independent review of the Member 1 handoff)  
**Scope:** `apps/web/**`, compared against the locked documents in `docs/`  
**Outcome:** The frontend is materially complete for demo/mock mode. Five clear UI defects were fixed. Lint, typecheck, tests and the production build all pass. Live Core API and Supabase integration remain unverified because neither service is configured in this environment. No locked contract was changed.

---

## 1. Verdict

| Area | Result | Notes |
|---|---|---|
| Git state | PASS | Branch `feat/frontend`, `HEAD` `78ee946…`, clean tree at audit start |
| Required documents read | PASS | PRD, Architecture, API Contracts, Database, AI Disclosure, Member 1 Report |
| API path/method compatibility | PASS | All 18 UI-required Core API operations map correctly; `GET /health` is unused |
| Request/response field compatibility | PASS with documented gaps | No contract-breaking mismatch found |
| Auth header and error envelope | PASS | Bearer token, typed errors, 204 handling |
| Security/privacy | PASS with one follow-up | No service-role or public evidence URL usage; no strict CSP |
| Service-worker caching policy | PASS | API, auth, Supabase and `/_next/data/` excluded |
| Mock/live switching | PASS | Documented and implemented |
| UI correctness | 5 defects fixed | Misleading states corrected |
| Responsive/keyboard review | PARTIAL | Code review only; no post-fix device pass |
| `npm run lint` | PASS | ESLint exit 0 |
| `npm run typecheck` | PASS | `tsc --noEmit` exit 0 |
| `npm run test` | PASS | 4 files, 45 tests |
| `npm run build` | PASS | Next.js 16.4.6, 17 routes |

---

## 2. Verified Git state

Commands were run from the repository root.

```bash
git branch --show-current
# feat/frontend

git log -1 --format='%H%n%ci%n%s'
# 78ee946966f62e99d09f2c0032a68a0a136fee3b
# 2026-11-13 11:20:15 +0530
# feat(frontend): implement SHEPHERD frontend

git remote -v
# origin  https://github.com/ritikj17/shepherd-development.git (fetch)
# origin  https://github.com/ritikj17/shepherd-development.git (push)

git status --porcelain=v1
# (empty at audit start)
```

The handoff report’s branch and commit claims are accurate. The working tree was clean before this audit. After the audit fixes it contains exactly these five modified files, all inside `apps/web/**`:

```text
 M apps/web/components/analysis/threatlens-view.tsx
 M apps/web/components/evidence/evidence-view.tsx
 M apps/web/components/incidents/incident-detail-view.tsx
 M apps/web/components/reports/justicebridge-view.tsx
 M apps/web/components/safety/safecircle-view.tsx
```

No commit, amend, push or force operation was performed. `services/**` and `supabase/**` were not touched.

The checkpoint note that `components/patterns/pattern-graph-view.tsx` contained an uncommitted ReactFlow `onError` edit was stale: `HEAD` already has no `onError`, and the file is unmodified.

---

## 3. Commands run and exact results

All commands were run in `apps/web`.

### 3.1 Lint

```bash
npm run lint
```

Output:

```text
> @shepherd/web@0.1.0 lint
> eslint .
```

Exit code 0. No errors and no warnings were printed.

### 3.2 Typecheck

```bash
npm run typecheck
```

Output:

```text
> @shepherd/web@0.1.0 typecheck
> tsc --noEmit
```

Exit code 0. No diagnostics.

### 3.3 Tests

```bash
npm run test
```

Output:

```text
> @shepherd/web@0.1.0 test
> vitest run

(!) Your Vite config uses features that are unsupported by `configLoader: 'native'`, which is planned to become the default in a future major version of Vite:
  - ESM syntax in a file loaded as CommonJS (vitest.config.ts:1:1). Use a `.mjs` extension or set `"type": "module"` in the closest package.json
Set `VITE_CONFIG_NATIVE_IGNORE_WARNING=true` to suppress this warning.

 RUN  v5.1.0 /Users/ritikj17/Projects/shepherd-development/apps/web

 Test Files  4 passed (4)
      Tests  45 passed (45)
   Start at  12:08:32
   Duration  614ms (import 92%, tests 4%, transform 3%, worker 2%)
```

The Vite config-loader message is a non-fatal warning and did not affect the result.

### 3.4 Production build

```bash
npm run build
```

Output (abridged to the route table and timings):

```text
> @shepherd/web@0.1.0 build
> next build

▲ Next.js 16.4.6 (Turbopack)
✓ Running next.config.ts took 45ms

  Creating an optimized production build ...
✓ Compiled successfully in 784ms
  Running TypeScript ...
  Finished TypeScript in 1211ms ...
  Collecting page data using 9 workers ...
  Generating static pages using 9 workers (16/16) in 161ms
  Finalizing page optimization ...

Route (app)
┌ ○ /
├ ○ /_not-found
├ ○ /dashboard
├ ○ /evidence
├ ○ /incidents
├ ƒ /incidents/[id]
├ ƒ /incidents/[id]/edit
├ ○ /incidents/new
├ ○ /justicebridge
├ ○ /login
├ ○ /manifest.webmanifest
├ ○ /offline
├ ○ /patterns
├ ○ /safecircle
├ ○ /settings
├ ○ /signup
└ ○ /threatlens

ƒ Proxy (Middleware)
```

The build generated the expected 17 routes. `/incidents/[id]` and `/incidents/[id]/edit` remain dynamic; the Next.js 16 proxy is detected.

### 3.5 Checks not repeated after the fixes

The production server and Chromium smoke pass from the handoff were not rerun after these edits. Earlier in the audit, PatternGraph was verified in the browser against the seeded incident `1d9a0000-0000-4000-8000-000000000001` (3 nodes, 2 edges, relationship panel). The post-fix pages were verified by static review, typecheck and production compilation only. This limitation is recorded in §8.

---

## 4. API contract compatibility

### 4.1 Endpoint and method matrix

Frontend calls are relative to `NEXT_PUBLIC_API_BASE_URL`; the configured base path is `/api/v1`.

| Contract operation | Method and path | Frontend service | Match |
|---|---|---|---|
| Health | `GET /health` | Not called by the UI | N/A — not required |
| Create incident | `POST /api/v1/incidents` | `createIncident` | PASS |
| List incidents | `GET /api/v1/incidents` | `listIncidents` | PASS |
| Get incident | `GET /api/v1/incidents/{id}` | `getIncident` | PASS |
| Update incident | `PATCH /api/v1/incidents/{id}` | `updateIncident` | PASS |
| Delete incident | `DELETE /api/v1/incidents/{id}` | `deleteIncident` | PASS |
| Upload evidence | `POST /api/v1/evidence` | `uploadEvidence` (XHR multipart) | PASS |
| List incident evidence | `GET /api/v1/incidents/{id}/evidence` | `listIncidentEvidence` | PASS |
| Verify evidence hash | `POST /api/v1/evidence/verify` | `verifyEvidenceHash` | PASS |
| Request analysis | `POST /api/v1/incidents/{id}/analysis` | `requestIncidentAnalysis` | PASS |
| Get incident analyses | `GET /api/v1/incidents/{id}/analysis` | `listIncidentAnalyses` | PASS |
| Get incident graph | `GET /api/v1/graph/{id}` | `getIncidentGraph` | PASS |
| Create safety session | `POST /api/v1/safety-sessions` | `createSafetySession` | PASS |
| Check in | `POST /api/v1/safety-sessions/{id}/checkin` | `checkInToSession` | PASS |
| List safety sessions | `GET /api/v1/safety-sessions` | `listSafetySessions` | PASS |
| Generate report | `POST /api/v1/reports/{id}` | `generateIncidentReport` | PASS |
| Create trusted contact | `POST /api/v1/trusted-contacts` | `createTrustedContact` | PASS |
| List trusted contacts | `GET /api/v1/trusted-contacts` | `listTrustedContacts` | PASS |
| Delete trusted contact | `DELETE /api/v1/trusted-contacts/{id}` | `deleteTrustedContact` | PASS |

No frontend code calls the Intelligence service directly. All AI work is routed through the Core API, as required by the contract.

### 4.2 Request and response fields

Verified against `docs/API_CONTRACTS.md`:

- **Incident create/update:** `title`, `description`, `category`, `occurred_at`, `location_description`, and optional `status` on update. Categories match the locked eight-value taxonomy.
- **Incident list:** `limit`, `offset`, `category`, `status`; response `items`, `total`, `limit`, `offset`.
- **Evidence upload:** multipart fields `incident_id` and `file`; response includes `id`, `incident_id`, `file_name`, `mime_type`, `size_bytes`, `sha256`, `uploaded_at`, `storage_status`. No public URL is requested or rendered.
- **Evidence verification:** request `evidence_id`; response includes `stored_sha256`, `current_sha256`, `matches`, `verified_at`, `message`.
- **Analysis request:** `evidence_ids` and `include_description`; response includes `analysis_id`, `incident_id`, `status`, `classification`, `indicators`, `risk`, `ocr`, `limitations`, `created_at`. `confidence_type` is typed as `model_score_not_calibrated_probability`.
- **Graph:** `incident_id`, `nodes`, `edges`; relationship values match the approved taxonomy.
- **Safety sessions:** create body includes `trusted_contact_id`, nullable `incident_id`, `checkin_deadline`, `consent_confirmed: true`; check-in body is optional `message`.
- **Reports:** `include_evidence_index`, `include_analysis`; response includes `report_id`, `incident_id`, `status`, `file_name`, `download_url`, `generated_at`, `expires_at`.
- **Trusted contacts:** create body includes `name`, `contact_method`, `contact_value`, `consent_confirmed: true`; methods are `email` and `phone`.
- **Error envelope:** `lib/api/client.ts` parses `{ error: { code, message, details } }` and falls back to status-specific messages. `204 No Content` is handled explicitly.

### 4.3 Documented contract/type gaps (not changed by this audit)

These are compatibility notes, not defects introduced by the frontend. They should be resolved with the contract owners before or during live integration.

1. **`TrustedContact.contact_value` / `consent_confirmed` are optional in the frontend type but absent from the locked create/list response.** The live SafeCircle list therefore cannot display a real contact value and falls back to “Not displayed” via `maskContactValue`. Mock mode does store and mask the value.
2. **`RiskAssessment.level` is non-null in the frontend type while `threat_analyses.risk_level` is nullable in `docs/DATABASE.md`.** The runtime helper `riskBand(level)` handles `null`/`undefined` by returning `insufficient_data`, so the UI does not crash, but the type could be widened to match the database.
3. **`CheckInResponse.status` is typed as all session statuses, while the contract example returns `checked_in`.** This is a permissive widening and is safe.
4. **`SafetySession` includes optional `checked_in_at` and `cancelled_at` that are not in the create response.** Optional fields are harmless; the list endpoint schema is not expanded in the contract.
5. **`GraphEdge.confidence` is typed nullable while the contract example shows a number.** The UI tolerates a missing confidence.

No endpoint path, HTTP method, request body key or response envelope needs to change for the frontend to match the locked contract.

---

## 5. Security and privacy review

### 5.1 Verified controls

| Control | Result | Evidence |
|---|---|---|
| No service-role/backend secret in the web app | PASS | Search for `SERVICE_ROLE`, `service_role`, `SUPABASE_SERVICE`, `getPublicUrl` returned no matches |
| Bearer auth | PASS | `apiRequest` reads the Supabase session token and sets `Authorization: Bearer <token>` |
| Tokens not persisted by the app | PASS | Tokens are read from Supabase; only the demo display session, preferences, mock DB and offline draft use `localStorage` |
| No cookie credentials on API calls | PASS | `credentials: "omit"` |
| No API response caching | PASS | `cache: "no-store"` and `Cache-Control: no-store` for `/api/*` |
| Error disclosure | PASS | Typed error envelope; 401/403/404/413/415/429 messages are user-safe |
| Private evidence | PASS | UI renders metadata and SHA-256 only; no public evidence URL |
| Service-worker exclusions | PASS | `/api/`, `/auth/`, `/_next/data/`, Supabase, cross-origin requests and non-GET requests are skipped |
| Authenticated HTML caching | PASS | Navigation requests always prefer the network; only the public `/offline` page is cached |
| Security headers | PASS | `nosniff`, `DENY` framing, strict-origin referrer, restrictive permissions policy, same-origin COOP |
| Server auth gating | PASS (when configured) | `proxy.ts` refreshes Supabase cookies and redirects unauthenticated users; demo mode is explicitly not authentication |
| Client guard honesty | PASS | `RequireAuth` is labelled a UX guard; API/RLS remains the authorization boundary |
| AI disclosures | PASS | Analysis, risk, OCR, graph and report disclosures are present; mock data is labelled |
| Emergency-service claims | PASS | SafeCircle states notifications are simulated and not an emergency service |

### 5.2 Follow-up

- **No strict Content-Security-Policy.** Baseline headers are present, but a tested CSP was intentionally not added because it could break Supabase auth and Next.js inline styles. This is a documented production follow-up, not a hidden gap.
- **Demo mode is not authentication.** When Supabase variables are absent, the app uses a clearly labelled local demo session. This is acceptable for the prototype and must not be presented as real auth in deployment.

---

## 6. UI, responsive and keyboard accessibility findings

### 6.1 Verified strengths

- Mobile-first layouts across auth, dashboard, incidents, evidence, analysis, graph, safety, reports and settings.
- Responsive two-column/one-column grids, wrapping action groups and horizontally scrollable tables.
- Mobile navigation uses a Radix sheet with the same grouped navigation.
- A visible-on-focus “Skip to main content” link targets `#main-content`.
- Semantic headings, labelled form controls, `aria-label` on icon-only controls, and `sr-only` dialog/sheet titles.
- Radix primitives provide keyboard handling for dialogs, selects, menus, tabs, checkboxes, switches and tooltips.
- Focus-visible rings are defined globally and on buttons.
- Loading, empty and error states are present on the major screens.
- The PatternGraph relationship panel and legend distinguish user-reported from suggested edges.

### 6.2 Defects found and fixed

Five misleading-state defects were found. They are listed in §7. After the fixes, the affected views no longer claim a status that the data does not support.

### 6.3 Residual UI limitations

- The audit did not perform a physical-device or browser-emulation pass after the fixes. Breakpoint behavior was reviewed in code and the production build compiles, but a final small-screen visual pass remains recommended.
- The incident detail loader and dashboard aggregator still swallow per-section request errors (see §8.3). A failed evidence or analysis sub-request can therefore appear as an empty section rather than an explicit error. This was documented rather than expanded in scope.
- Live SafeCircle contact masking will show “Not displayed” because the locked response does not include `contact_value` (see §4.3).

---

## 7. Bugs fixed during this audit

All changes are confined to `apps/web/**`.

| # | File | Defect | Fix |
|---|---|---|---|
| 1 | `apps/web/components/evidence/evidence-view.tsx` | The Evidence files card header always rendered `<EvidenceStatusBadge status="stored" />`, even when the list was empty or contained failed/pending files. | Added an aggregate status derived from the loaded evidence: `null` when empty, otherwise `failed` if any failed, `pending` if any pending, else `stored`. The badge renders only when evidence exists. |
| 2 | `apps/web/components/safety/safecircle-view.tsx` | `activeSession` matched raw `status === "active"` and ignored an expired `checkin_deadline`, so the “An active check-in session is running” alert could be shown for an expired session. | Uses `displaySessionStatus(session) === "active"`, which applies the deadline check already used by the status badges. |
| 3 | `apps/web/components/incidents/incident-detail-view.tsx` | `<AiDisclosure variant="analysis" sample />` was unconditional, labelling live analyses as sample data. | `sample={isMockApiEnabled}` so the sample label appears only in mock mode. |
| 4 | `apps/web/components/analysis/threatlens-view.tsx` | Evidence and analysis query errors were swallowed, so a failed load appeared as “No evidence” or “No analysis”. | Added explicit `ErrorState` branches with retry for evidence, analysis history and the main analysis result panel. |
| 5 | `apps/web/components/reports/justicebridge-view.tsx` | Evidence and analysis query errors were swallowed, so the preview and inclusion summary showed zero inputs as if none existed. | Added a combined `ErrorState` with retry, and changed the inclusion/preview counts to “could not be loaded”/“Unavailable” when the corresponding query fails. |

No UI redesign, contract change, backend change or dependency change was made.

---

## 8. Remaining issues and blockers

### 8.1 Environment blockers (cannot be verified here)

1. **No live Core API.** Live request/response behavior, CORS, backend error codes and latency were not exercised. All runtime verification was mock/demo mode.
2. **No Supabase project.** Real email sign-in, email confirmation, password reset, cookie refresh and RLS-backed authorization were not exercised.
3. **No real offline/network-loss browser test.** The service-worker policy and assets are present and reviewed, but the offline reload was not manually exercised after the fixes.
4. **No post-fix device/emulator pass.** Responsive behavior is implemented and code-reviewed; a small-screen visual and accessibility pass remains.

### 8.2 Locked-contract gaps (not frontend bugs)

1. **No safety-session cancel endpoint.** SafeCircle correctly explains that cancellation is unavailable rather than inventing a route.
2. **No evidence-delete endpoint.** Evidence deletion is not offered.
3. **No global evidence/analysis endpoint.** Dashboard evidence and analysis counts are limited to the five most recent incidents and labelled accordingly.
4. **Mock reports cannot produce a PDF.** JusticeBridge returns a clearly labelled plain-text summary instead of faking a PDF.
5. **No tested strict CSP.** Baseline security headers are present; CSP remains a deployment follow-up.

### 8.3 Residual code-level issues (documented, not fixed in this audit)

1. **`lib/incidents/detail.ts` swallows per-section errors.** `listIncidentEvidence`, `listIncidentAnalyses` and `listSafetySessions` use `.catch(() => ({ items: [] }))`, so a failed sub-request is indistinguishable from an empty section. A future fix should return per-section error state and render it in the incident detail tabs.
2. **`lib/dashboard/data.ts` swallows per-incident evidence/analysis errors.** The dashboard counts and evidence summary can show zero for a failed sub-request. The existing recent-incident limitation note explains the count scope but not the failure case.
3. **`TrustedContact.contact_value` cannot be displayed in live mode** because the locked create/list response omits it. This is a contract gap, not a masking bug.
4. **The XHR uploader parses `error.code` and `error.message` but not `error.details`.** The fetch client does surface `details`; upload errors are still readable and honest.

None of these prevents the mock/demo application from building or running.

---

## 9. Files changed by this audit

```text
apps/web/components/analysis/threatlens-view.tsx
apps/web/components/evidence/evidence-view.tsx
apps/web/components/incidents/incident-detail-view.tsx
apps/web/components/reports/justicebridge-view.tsx
apps/web/components/safety/safecircle-view.tsx
docs/reviews/MEMBER_1_AUDIT.md
```

`docs/reviews/MEMBER_1_AUDIT.md` is the only documentation file added. The five source edits are uncommitted.

---

## 10. Conclusion

The Member 1 frontend matches the locked API paths, methods, request bodies, response envelopes, Bearer-auth model and error envelope. The security and service-worker boundaries are sound for the documented prototype scope. The five defects fixed here were genuine misleading states, not cosmetic preferences.

The remaining risk is external: no live Core API or Supabase project is available, so live integration, real auth/RLS, CORS, offline behavior and small-screen rendering still need a deployment-environment pass. The known contract gaps (cancel session, evidence deletion, global evidence/analysis, mock PDF, CSP) are documented rather than papered over.

**No commit or push was made.**
