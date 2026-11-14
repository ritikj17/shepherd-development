# SHEPHERD — System Architecture

Version: 1.0
Status: LOCKED

## 1. Architecture Overview

SHEPHERD uses a modular monorepo with:

- One Next.js frontend.
- One Core FastAPI backend.
- One Intelligence FastAPI backend.
- One Supabase PostgreSQL database.
- One private Supabase Storage bucket.

There are exactly TWO backend services.

Member 4's SafeCircle, Notifications and JusticeBridge modules are part
of the Core API. They are NOT separate backend services.

## 2. Technology Stack

### Frontend

- Next.js 16 App Router
- React
- TypeScript
- Tailwind CSS
- shadcn/ui
- Lucide icons
- React Hook Form
- Zod
- Supabase SSR client
- @xyflow/react for PatternGraph
- Recharts where charts are useful
- Serwist or an equivalent supported PWA implementation

### Core Backend

- Python 3.11+
- FastAPI
- Pydantic v2
- Supabase Auth token validation
- Supabase PostgreSQL
- Supabase Storage
- ReportLab for PDF reports
- pytest and httpx

### Intelligence Backend

- Python 3.11+
- FastAPI
- Pydantic v2
- Tesseract OCR
- pytesseract
- Pillow
- NetworkX
- Deterministic/rule-based classification baseline
- pytest and httpx

### Infrastructure

- GitHub monorepo
- Supabase database, authentication and storage
- Vercel for frontend hosting
- Render or an equivalent Python-compatible host for each backend
- HTTPS for deployed services

## 3. High-Level Data Flow

Browser
|
| Supabase authentication
v
Next.js Frontend
|
| HTTPS + Supabase access token
v
Core FastAPI API
|
|-- Supabase PostgreSQL
|
|-- Private Supabase Storage
|
|-- Safety modules
|
|-- Notification modules
|
|-- Report generation modules
|
| Authenticated server-to-server request
v
Intelligence FastAPI API
|
|-- OCR
|-- Classification
|-- Risk-priority scoring
|-- Incident relationship analysis
v
Core FastAPI API
|
| Persists analysis results
v
Supabase PostgreSQL

The browser must not call the Intelligence API directly for protected
operations. The Core API is the authenticated orchestration boundary.

## 4. Monorepo Structure

shepherd-development/
|
|-- apps/
| |-- web/ # Member 1
|
|-- services/
| |-- api/ # Member 2; Member 4 scoped modules
| | |-- app/
| | | |-- api/
| | | |-- auth/
| | | |-- database/
| | | |-- models/
| | | |-- incidents/
| | | |-- evidence/
| | | |-- safety/ # Member 4
| | | |-- notifications/ # Member 4
| | | |-- reports/ # Member 4
| | | |-- core/
| | | |-- main.py
| | |-- tests/
| |
| |-- intelligence/ # Member 3
| |-- app/
| | |-- api/
| | |-- ocr/
| | |-- classifiers/
| | |-- graph/
| | |-- risk/
| | |-- schemas/
| | |-- main.py
| |-- datasets/
| |-- tests/
|
|-- supabase/ # Member 2
| |-- migrations/
| |-- seed.sql
|
|-- docs/
| |-- reviews/
| |-- PRD.md
| |-- ARCHITECTURE.md
| |-- API_CONTRACTS.md
| |-- DATABASE.md
| |-- AI_DISCLOSURE.md
|
|-- .github/
|-- .env.example
|-- .gitignore
|-- README.md

## 5. Ownership and Branches

Member 1 — Frontend Lead
Branch: feat/frontend
Owns: apps/web/\*\*

Member 2 — Core Backend and Database
Branch: feat/backend
Owns: services/api/** core modules and supabase/**

Member 3 — AI and Intelligence
Branch: feat/intelligence
Owns: services/intelligence/\*\*

Member 4 — Safety Response and Reporting
Branch: feat/response
Owns:

- services/api/app/safety/\*\*
- services/api/app/notifications/\*\*
- services/api/app/reports/\*\*
- Associated tests for those modules

Member 4 must coordinate with Member 2 before changing:

- services/api/app/main.py
- Shared database models
- Shared authentication
- Shared API router registration
- Supabase migrations
- Shared Pydantic schemas

Shared contracts and root configuration require team approval.

## 6. Service Responsibilities

### 6.1 Next.js Frontend

Responsibilities:

- Authentication screens and session-aware routing.
- Dashboard and incident management UI.
- ThreatLens, EvidenceVault and PatternGraph UI.
- SafeCircle and JusticeBridge UI.
- API client and typed frontend contracts.
- Form validation and accessible interactions.
- PWA shell, offline fallback and draft status.

The frontend must not:

- Hold service-role credentials.
- Access another user's evidence.
- Trust client-side authorization checks as security.
- Claim a private file was uploaded when it was only saved locally.

### 6.2 Core FastAPI API

Responsibilities:

- Verify Supabase access tokens.
- Enforce ownership and authorization.
- Create and manage incidents.
- Upload and retrieve private evidence.
- Calculate and verify SHA-256 hashes.
- Persist intelligence results.
- Orchestrate authenticated calls to the Intelligence API.
- Serve safety sessions and trusted-contact workflows.
- Record notification states.
- Generate incident PDF reports.

### 6.3 Intelligence FastAPI API

Responsibilities:

- OCR processing for supported image files.
- Text classification.
- Explainable classification indicators.
- Review-priority score calculation.
- Incident relationship analysis.
- Synthetic dataset evaluation.
- Health and readiness endpoint.

The Intelligence API is not an authentication or user-data ownership
authority. The Core API controls access and supplies only the minimum
necessary data for analysis.

## 7. Cross-Service Communication

- Core API calls Intelligence API over HTTPS in production.
- Use a server-side shared service credential or equivalent authenticated
  service-to-service mechanism.
- Never expose the service credential to the browser.
- Send only the minimum incident and evidence information required.
- Do not persist raw OCR text unless required for the user's requested
  feature and covered by the data policy.
- Apply timeouts and structured error handling.
- The Core API must not claim analysis succeeded unless the Intelligence
  API returned a valid successful response and persistence completed.

## 8. File Upload and Evidence Flow

1. Authenticated user requests evidence upload for an owned incident.
2. Core API validates the incident ownership.
3. Core API validates file type and size.
4. Core API calculates SHA-256 from received bytes.
5. Core API uploads the file to a private storage bucket.
6. Core API stores evidence metadata and hash in PostgreSQL.
7. Analysis requests use authorized server-side retrieval.
8. Verification re-reads the stored original and calculates its hash again.

Never use a public storage bucket for private evidence.

## 9. Authentication and Authorization

- Supabase Auth is the identity provider.
- Browser sends its Supabase access token as a Bearer token.
- Core API verifies token signature, issuer, audience and expiry using
  the configured trusted Supabase verification method.
- Never trust a user_id supplied in a request body as proof of identity.
- Derive the authenticated user ID from the verified token.
- Every user-owned query must include ownership enforcement.
- PostgreSQL Row Level Security is required.
- Service-role credentials are server-side only.

## 10. PWA and Offline Rules

- Cache static application assets only.
- Do not cache authenticated API responses.
- Do not cache private evidence.
- Offline drafts must be clearly marked as local and not uploaded.
- Require explicit user action to retry synchronization.
- Display conflicts and failed uploads honestly.

## 11. Deployment Topology

Frontend:

- Vercel
- Production environment variables configured in hosting settings.

Core API:

- Render or equivalent
- Python application
- Health endpoint: /health

Intelligence API:

- Render or equivalent
- Python application
- Health endpoint: /health

Database and Storage:

- Supabase

Deployments must use separate environment variables and must not commit
production secrets to the repository.

## 12. Architecture Change Control

No member or coding agent may independently:

- Add another backend service.
- Rename agreed API routes.
- Change shared request/response schemas.
- Change database ownership rules.
- Change folder ownership.
- Introduce a different authentication provider.
- Expose private evidence publicly.

Any proposed change must be documented, discussed by the team, approved
by the integration lead and reflected in the relevant shared documents.
