# CarServiceApp frontend

Use the repository containing this file and its sibling `Backend` directory.
The normal development servers and the isolated browser regression launcher are separate.

## Prerequisites

- Node.js 22.12+ (Node.js 24 used for Stage 2.7 verification)
- .NET 9 SDK
- Chromium installed through Playwright for browser tests

## Normal local development

From the repository root, start the backend in one terminal:

```powershell
dotnet run --project Backend/CarServiceShop/CarServiceShop --launch-profile http
```

In another terminal:

```powershell
cd Frontend
npm ci
npm run dev
```

Open http://localhost:5173. The tracked backend HTTP profile listens on
http://localhost:5232, matching the frontend API client at /api.
No Playwright environment variables or ignored frontend env file are required.
The backend uses its existing appsettings.json SQLite configuration and startup
initialization. An empty development database receives the existing seeded
`admin@test.com` / `admin123` account. Existing databases retain their data and
roles; this work does not migrate legacy role values.

Use this checkout's backend, not a separate Visual Studio checkout. A backend
without wwwroot is expected when Vite serves the frontend separately. The
production SPA fallback is exercised separately against copied build output
during regression tests.

## Reproducible regression suite

Stop normal development servers on ports 5173 and 5232 first. From Frontend:

```powershell
npm ci
npx playwright install chromium
npm run typecheck
npm run test:backend
npm run test:e2e
```

`test:e2e` builds the frontend and runs all Chromium specs using the configuration
in this directory. The launcher builds the sibling backend project and starts it
from a new `.playwright-data/run-*` directory with a fresh SQLite validation
database, separate uploads, and a copy of the current SPA build. It then starts
Vite on port 5173. Existing servers are never reused, so browser tests cannot
silently target a normal development database. Both localhost and 127.0.0.1 are
used by the preserved regression tests.

The launcher uses the existing schema and startup initialization; it adds no
database migrations. Tests use one worker because business fixtures share a
server/database. Retries are disabled so failures remain visible.

After a build, run a focused spec with:

```powershell
npx playwright test tests/stage27.spec.ts --project=chromium
```

All specs live in tests/. No parent directory test loaders, parent
playwright.config.ts, absolute screenshot paths, or external checkout are needed.
Stage 1–2.6 assertions are preserved. Stage 2.7 updates the expected initial
resource counts because the operational dashboard now consumes worksheets and
inventory; the one-fetch and targeted-invalidation assertions remain.

## Outputs

- `playwright-report/index.html`: browser report
- `test-results/`: traces and screenshots on failure
- `review-artifacts/stage23/` through `review-artifacts/stage27/`: visual review captures
- `.playwright-data/run-*/`: disposable validation data, never normal workshop data

These directories are ignored by Git. Keep useful screenshots outside production
assets. The Stage 2.7 report at the repository root records the final verification
results, bundle output, file changes, and known limitations.

## Frontend structure

React Router owns routes and session guards. AuthProvider and the shared API
client retain the Stage 2.1 session contract. WorkshopDataProvider and typed
resource APIs retain the Stage 2.2 cache/invalidation contract. The Stage 2.3 shell,
tokens and shared UI components underpin feature pages. Major authenticated
routes load through React lazy/Suspense with LoadingState; the calendar and
worksheet/print code are loaded when their routes are opened.
