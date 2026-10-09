# Admin progress

Updated: 9 October 2026

| Phase | Status | Done | Next |
|---|---|---|---|
| 0. Starting point | Done | Read the project guidance and published `codex/admin-feedback` to GitHub with Sahil as the commit author. | Keep the shared contracts stable while Manasa builds the client side. |
| 1. Secure backend | Code complete; live check pending | Added Amplify auth, Feedback data, storage, and backend wiring. A server resolver now creates reports with a required status enum set to `NEW` and reporter details copied from Cognito. Direct model creation cannot fill the required protected fields. Backend typecheck passes. | When an AWS sandbox is available, verify the schema deploys and test owner/admin permissions through the API, including rejected direct creates and owner status/assignee edits. |
| 2. Shared API | Code complete; live check pending | Replaced demo email codes, local report storage, and IndexedDB media with Cognito, Amplify Data, and Storage. Report creation now calls the server mutation. Kept the page-facing function signatures and added adapter tests. | Generate `amplify_outputs.json` from a sandbox and verify sign-in, uploads, report creation, and permissions with real accounts. |
| 3. Admin integrations | Next | Requirements identified. | Add the Sentry issues function, then configure GA4 and Looker integration. |
| 4. Feedback review | Not started | Existing page is a placeholder. | Build the admin review page after the shared API is ready. |
| 5. Product insights | Not started | Existing page is a placeholder. | Build Errors and Traffic against the integrations. |
| 6. Acceptance and PR | Not started | Existing tests and build pass. | Run coverage, API authorization checks, visual checks, and prepare reviewable PRs to `dev`. |

## Checks so far

- `npm run test:coverage`: 81 passed across 11 test files (up from 68 at the start).
- `npm run build`: passed.
- `npx tsc --noEmit -p amplify/tsconfig.json`: passed.
- Coverage thresholds passed; shared library lines 98.05%, functions 97.56%, branches 90.17%.
- Production dependency audit: 0 vulnerabilities.
- The feature branch is on GitHub; it has not been merged into `dev`.
- No AWS deployment or direct API authorization check has run yet.

## Remaining live check

The code now uses a required status enum and a server-side creation mutation. Local tests cannot prove the deployed AppSync authorization rules. Before accepting the backend, test that one client cannot read another's reports, direct model creation cannot bypass the resolver, and owners cannot change `status` or `assignee`. Also verify upload paths and attachment access with real accounts.

## Test count

Add meaningful tests alongside each new feature. The count will generally rise, although replacing or consolidating tests can make it fluctuate. Passing coverage thresholds and testing the required behavior matter more than the raw count.
