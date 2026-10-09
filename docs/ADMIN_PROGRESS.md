# Admin progress

Updated: 9 October 2026

| Phase | Status | Done | Next |
|---|---|---|---|
| 0. Starting point | Done | Read the project guidance and published `codex/admin-feedback` to GitHub with Sahil as the commit author. | Keep the shared contracts stable while Manasa builds the client side. |
| 1. Secure backend | In progress | Added Amplify auth, Feedback data, storage, and backend wiring. Backend typecheck passes. | Resolve the status enum/default limitation; deploy only when requested, then check permissions through the API. |
| 2. Shared API | Code complete; live check pending | Replaced demo email codes, local report storage, and IndexedDB media with Cognito, Amplify Data, and Storage. Kept the page-facing function signatures. Added adapter tests. | Generate `amplify_outputs.json` from a sandbox and verify sign-in, uploads, and permissions with real accounts. |
| 3. Admin integrations | Not started | Requirements identified. | Add the Sentry issues function, then configure GA4 and Looker integration. |
| 4. Feedback review | Not started | Existing page is a placeholder. | Build the admin review page after the shared API is ready. |
| 5. Product insights | Not started | Existing page is a placeholder. | Build Errors and Traffic against the integrations. |
| 6. Acceptance and PR | Not started | Existing tests and build pass. | Run coverage, API authorization checks, visual checks, and prepare reviewable PRs to `dev`. |

## Checks so far

- `npm test`: 70 passed across 10 test files (up from 68).
- `npm run build`: passed.
- `npx tsc --noEmit -p amplify/tsconfig.json`: passed.
- `npm run test:coverage`: passed; shared library lines 98.05%, functions 97.56%, branches 90.11%.
- Production dependency audit: 0 vulnerabilities.
- The feature branch is on GitHub; it has not been merged into `dev`.
- No AWS deployment or direct API authorization check has run yet.

## Current decision to review

Amplify Gen 2 does not support a default value on enum fields. The current backend schema uses a string status with a server default of `NEW` and admin-only updates. The project requirement calls for a required enum. Resolve this before the backend is accepted.

The browser adapter copies reporter details from Cognito attributes, but the current model create authorization does not itself prevent a caller from sending different reporter details directly to the API. Decide whether report creation needs a server-side mutation before calling the backend secure.

## Test count

Add meaningful tests alongside each new feature. The count will generally rise, although replacing or consolidating tests can make it fluctuate. Passing coverage thresholds and testing the required behavior matter more than the raw count.
