# SHEPHERD web application

Next.js 16 App Router frontend for **SHEPHERD**, a privacy-first safety
intelligence workspace. The app documents incidents, organizes private evidence
metadata, presents explainable AI-assisted analysis, visualizes incident
relationships, coordinates trusted-contact check-ins and assembles structured
reports.

> SHEPHERD is an informational documentation tool. It is not an emergency
> service, a legal authority, or a guarantee of safety. If you are in immediate
> danger, contact local emergency services.

## Stack

- Next.js 16 (App Router, `proxy.ts` server auth gating)
- TypeScript, Tailwind CSS v4, shadcn/ui-style primitives, Lucide icons
- React Hook Form + Zod validation
- Supabase SSR authentication (optional)
- `@xyflow/react` for PatternGraph, Recharts for dashboard summaries
- Hand-written versioned service worker + web app manifest (PWA)
- Vitest for unit tests

## Getting started

```bash
cd apps/web
npm install
cp .env.example .env.local
npm run dev
```

Open <http://localhost:3000>. With no environment variables the app runs in a
clearly labelled **demo mode**: a local demo session plus synthetic records from
the isolated mock adapter.

### Demo mode

- A banner identifies synthetic data and the local demo session.
- Demo records live in `localStorage` under `shepherd.demo.db.v1`.
- The demo session lives under `shepherd.demo.session.v1`.
- Reset the synthetic database from **Settings → Demo data**.
- The mock adapter never stores file bytes. Evidence uploads save metadata and a
  locally computed SHA-256 only.

### Using the real Core API

Set `NEXT_PUBLIC_API_BASE_URL` to the Core API base URL and either leave
`NEXT_PUBLIC_USE_MOCK_API` unset or set it to `false`. To force mock mode even
when a base URL exists, set `NEXT_PUBLIC_USE_MOCK_API=true`.

Components call the typed service layer in `lib/api/*`; the mock switch happens
only inside that layer, so switching to the real API does not require rewriting
screens.

### Supabase authentication

Set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` (the public
anon key only — **never** a service-role key). Without them, the login screen
offers the labelled demo workspace. With them, email/password sign-in, sign-up
and password reset use Supabase, and `proxy.ts` gates application routes.

## Scripts

```bash
npm run dev        # development server
npm run build      # production build
npm run start      # serve the production build
npm run lint       # ESLint
npm run typecheck  # TypeScript, no emit
npm run test       # Vitest unit tests
```

## Project structure

```text
app/
  (auth)/          sign-in, sign-up and auth layout
  (app)/           authenticated workspace: dashboard, incidents, evidence,
                   threatlens, patterns, safecircle, justicebridge, settings
  offline/         public offline fallback used by the service worker
  manifest.ts      web app manifest
components/
  ui/              shared primitives
  layout/          sidebar, topbar and protected app shell
  incidents/ evidence/ analysis/ patterns/ safety/ reports/ settings/
  shared/          states, badges, disclosures, dialogs, skeletons
lib/
  api/             typed service layer; mock adapters isolated in api/mock/
  auth/            Supabase + demo session provider and route guard
  hooks/           data loading, countdown, online status
  validation/      Zod schemas
  utils/           formatting, risk bands, hashing, category metadata
proxy.ts           Next.js 16 server-side auth refresh/gating
public/sw.js       versioned service worker
tests/             Vitest unit tests
```

## Privacy and security notes

- Only public `NEXT_PUBLIC_*` configuration is available to the browser.
- API requests send the Supabase access token as a Bearer token and use
  `cache: "no-store"`; private/auth responses are never cached.
- Evidence is private. The UI displays metadata and hashes, never a public
  evidence URL.
- The service worker caches only the public offline page, icons and immutable
  build assets. It never caches API responses, authenticated HTML, Supabase
  traffic or evidence.
- AI output is labelled informational and always accompanied by its limitations.
  Model scores are explicitly **not** calibrated probabilities.
- Offline incident drafts are local-only and never sync automatically.

## Known prototype limitations

- SafeCircle notifications are simulated; no SMS or email is sent.
- There is no cancel-safety-session control because the locked API contract does
  not define a cancel endpoint.
- Evidence deletion is not implemented because the contract has no delete
  endpoint.
- The mock report adapter cannot generate a PDF; it offers a clearly labelled
  plain-text summary instead of pretending a PDF exists.
- Dashboard evidence and analysis counts are limited to the most recent incidents
  because the contract exposes those resources per incident.
- A strict Content-Security-Policy is intentionally omitted in this prototype to
  avoid breaking Supabase auth and inline styles; baseline security headers are
  configured in `next.config.ts`.
