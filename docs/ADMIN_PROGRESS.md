# Admin progress

Updated: 9 October 2026

| Phase | Status | Done | Next |
|---|---|---|---|
| 0. Starting point | Done | Read the project guidance and published `codex/admin-feedback` to GitHub with Sahil as the commit author. | Keep the shared contracts stable while Manasa builds the client side. |
| 1. Secure backend | Code complete; live check pending | Added Amplify auth, Feedback data, storage, and backend wiring. A server resolver now creates reports with a required status enum set to `NEW` and reporter details copied from Cognito. Direct model creation cannot fill the required protected fields. Backend typecheck passes. | When an AWS sandbox is available, verify the schema deploys and test owner/admin permissions through the API, including rejected direct creates and owner status/assignee edits. |
| 2. Shared API | Code complete; live check pending | Replaced demo email codes, local report storage, and IndexedDB media with Cognito, Amplify Data, and Storage. Report creation now calls the server mutation. Kept the page-facing function signatures and added adapter tests. | Generate `amplify_outputs.json` from a sandbox and verify sign-in, uploads, report creation, and permissions with real accounts. |
| 3. Admin integrations | In progress | Added the admin-only `sentryIssues` query and Sentry function, with setup state when unconfigured and tests for the issue mapping. | Configure `SENTRY_ORG`, `SENTRY_PROJECTS`, and the `SENTRY_AUTH_TOKEN` secret per branch; verify with live Sentry. GA4 and Looker wiring can follow when frontend work resumes. |
| 4. Feedback review | Code complete; live and visual checks pending | Built the review queue with live updates, all requested filters, metrics, list/grid, paging, attachment preview, and status/owner editing. Added admin and shared API tests. | Verify live subscriptions, attachment download, and the layout against the prototype in an AWS sandbox. |
| 5. Product insights | Not started | Existing page is a placeholder. | Build Errors and Traffic against the integrations. |
| 6. Acceptance and PR | Not started | Existing tests and build pass. | Run coverage, API authorization checks, visual checks, and prepare reviewable PRs to `dev`. |

## Checks so far

- `npm run test:coverage`: 101 passed across 14 test files (up from 68 at the start); coverage thresholds passed.
- `npm run build`: passed.
- `npm run typecheck`: passed.
- `npx tsc --noEmit -p amplify/tsconfig.json`: passed.
- Overall coverage: lines 95.98%, functions 91.57%, branches 86.25%.
- Production dependency audit: 0 vulnerabilities.
- The feature branch is on GitHub; it has not been merged into `dev`.
- No AWS deployment or direct API authorization check has run yet.

## Remaining live check

The code now uses a required status enum and a server-side creation mutation. Local tests cannot prove the deployed AppSync authorization rules. Before accepting the backend, test that one client cannot read another's reports, direct model creation cannot bypass the resolver, and owners cannot change `status` or `assignee`. Also verify upload paths and attachment access with real accounts.

The review page listens for model changes and a custom event from secure report creation. Verify both paths with two signed-in accounts in the sandbox; local tests only prove our UI and adapter behavior.

The Sentry function can deploy without Sentry settings and return its setup state. To enable it, set `SENTRY_ORG` and `SENTRY_PROJECTS` for the branch build and create the `SENTRY_AUTH_TOKEN` secret before deployment. The Sentry project issues endpoint is the one specified in `AGENTS.md`; Sentry now marks it deprecated, so revisit that route before a production release.

## Test count

Add meaningful tests alongside each new feature. The count will generally rise, although replacing or consolidating tests can make it fluctuate. Passing coverage thresholds and testing the required behavior matter more than the raw count.
