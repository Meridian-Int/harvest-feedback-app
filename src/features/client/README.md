# Client integration

Based on `origin/codex/admin-feedback` at `b68caa030aabb2e1bf1a82fbff0042b171c49c17`.

The foundation routes mount NewFeedbackPage and MyReportsPage. These wrappers use the existing AuthProvider, shared controls, src/lib/options.ts and feedback API. The form and reports views accept injected adapters for unit tests. The shared sign-in page and Cognito adapter remain authoritative; there is no simulated sign-in.

The new shared API helpers are removeAttachment (only unclaimed files owned by the current storage identity) and subscribeMyFeedback (owner-authorized observeQuery, unsubscribe on unmount).

Real sign-in, data, file uploads and authorization checks require a personal Amplify sandbox and its generated, ignored amplify_outputs.json. No AWS resources have been deployed. Report-notification emails are not implemented in this integration; their scope needs reconciling with the original request and Sahil’s later v1 guidance.

Before a live release, verify owner isolation and admin-only fields directly through the API, and resolve the foundation’s documented server-side reporter-identity validation gap in docs/ADMIN_PROGRESS.md. A browser adapter alone cannot enforce that validation.

## Verification (9 October 2026)

- TypeScript --noEmit: passed.
- Full Vitest suite with coverage: 128 tests passed, 22 files. Overall lines 96.09%; client logic lines/functions 100%, branches 98.82%; shared lib lines 98.78%. Required thresholds passed. Tests mock AWS/service boundaries.
- npm run build: passed (existing large-bundle advisory).
- Running integrated app: /feedback/new redirects signed-out visitors to /sign-in; submitting a sample email without outputs shows “Harvest sign-in is not configured yet.”
- Real OTP, three live submission types, emails, CLOSED transition, cross-account API isolation and admin-change clearing: could not verify without AWS access/deployed sandbox.
- Shared changes: src/lib/feedback.ts, its test, src/app/routes.test.tsx, only. No amplify/ files, data model, existing shared components or workflows changed. The user subsequently requested that shared product-area options retain only Payment — payout account setup among payment areas. No new environment variables.
- Installation: npm install succeeds; npm ci fails on bundled Amplify dependency entries (semver and @opentelemetry/core). The upstream lockfile was retained; this needs resolution before CI/release.
- Review branch: codex/client-feedback-integration. AWS deployment and live verification remain pending.

Recording now runs in a workspace-owned host that survives New feedback/My reports navigation. Switching visibility or focus does not stop capture. A route regression test verifies continued capture and attachment recovery; leaving the authenticated client workspace still releases it.

The user cancelled the Supabase switch. Auth remains Cognito email-code sign-in; feedback/storage use Sahil’s existing backend. No new Data/Storage deployment is authorized. Existing amplify_outputs.json takes precedence; optional public VITE_COGNITO_USER_POOL_ID and VITE_COGNITO_USER_POOL_CLIENT_ID can configure sign-in alone when backend outputs are absent. The pool must match the backend’s authorization setup.
