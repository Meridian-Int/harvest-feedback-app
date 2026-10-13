# Prestaging integration inspection and proposed backend boundary

Inspected on 12 October 2026. The user approved the implementation. The dedicated backend and shared-session adapters are implemented locally; deployment and live validation remain pending.

## Current result

- Both requested starting HEADs were verified. HARVEST's feature branch was then merged with current `origin/main`, following the user's clarified flow.
- The HARVEST flow is now documented in `docs/CICD.md` and `deploy/gitlab/SETUP.md`: GitHub PR into main, GitLab tests and deploys the prestaging frontend. Never run the retired laptop deploy script or press promotion buttons for this work.
- The backend synthesizes with zero Cognito resources, four dedicated Feedback tables, a private versioned S3 bucket and twelve Lambda-guarded operations. It has not been deployed.
- Shared mode now uses access tokens for every API operation, server-derived admin decisions and mediated attachment operations. It no longer requires a Feedback identity pool or browser S3 credentials.
- Feedback UI build, 365 unit tests and the coverage gate passed before adding handler-level tests. HARVEST typecheck, prestaging build and 7,230 focused configuration/API/design checks passed.
- Existing Feedback and HARVEST APIs reject unauthenticated calls with HTTP 401. This proves only that specific denial, not live reporter isolation or revocation.
- Ignored local settings were recreated. No credentials, tokens or local environment files are staged.
- The user selected `harvest@withmeridian.ai`, then `sahil+admin@withmeridian.ai`. Both exact email lookups returned no staging Cognito user. No admin grant was made.
- Browser automation returned `Computer Use permissions are not granted`. Real login, new-tab routing, attachment and sign-out checks remain blocked.
- Hosting/proxy connection, selected-account provisioning, email worker/recipient integration and real delivery tests remain pending. No staging promotion or production change was made.

## Verified starting point

| Item | Evidence |
| --- | --- |
| Feedback feature HEAD | `0f7b6906bf71ae8986dd5149bf9831e374b51e84`, clean fresh checkout |
| HARVEST feature HEAD | `a1bcc1ba7bcc867fc884fbf787700ab252a04f80`, clean fresh checkout |
| AWS identity | `manasa` profile, account `938463256739`, assumed `AWSReservedSSO_Engineer_9bb0a2dbec7d9eeb` role |
| Region | All AWS inspections explicitly used `us-east-2` |
| HARVEST staging pool | Stack outputs confirm `us-east-2_9T9vblhIf` |
| HARVEST staging web client | `1kgpn379o3obvefdfrms9pp6ho` |
| HARVEST staging API | `https://hjyuhqzj1i.execute-api.us-east-2.amazonaws.com` |
| Existing Feedback API | `6ixwuvgg2ffonbbz6ew7bluoey`; only legacy pool `us-east-2_lN0CI04T8` plus IAM; no request log configuration |
| Existing Feedback GraphQL URL | `https://da555cuzubeuzngu43p7lqvwvq.appsync-api.us-east-2.amazonaws.com/graphql` |
| Existing Feedback storage | `amplify-harvestfeedbackap-feedbackmediabucket7788c-npdc910cvfa6` |
| Amplify Hosting | `list-apps` returned no apps in this account/region |
| Admin test account | Staging lookup for `sahil+admin@withmeridian.ai` returned no user; pool has no groups |
| SES | Sending enabled, production access false; `withmeridian.ai` identity verified |
| HARVEST instructions | No tracked `AGENTS.md` found in the supplied HARVEST branch |

The legacy Feedback sandbox is existing shared work. Do not update or delete it to bootstrap this integration. Existing owner subjects and data migration need separate review.

## Authorization gaps in the supplied code

1. `amplify/backend.ts` unconditionally includes `defineAuth`; adding HARVEST as another provider still creates a Feedback user pool on a fresh deployment.
2. Generated report reads and updates authorize from owner/group token claims, without a fresh HARVEST membership lookup. Revoked membership can retain access until credentials expire.
3. Storage issues direct temporary AWS credentials. A frontend membership check does not revoke already issued S3 permissions. Selected-Operator checks cannot be implemented with a blanket Operator grant.
4. Admin email recipients are drawn from Cognito groups. Staging currently has no groups and the first requested admin account does not exist.
5. Existing shared-session submission passes the ID token as Authorization and the access token in another header, while the report actor reads Authorization for `/api/me`. HARVEST expects an access token.
6. Email links use root-level transitional admin paths; integrated links need `/feedback/admin/reviews` and `/feedback/mine`.
7. SES sandbox allows only verified recipients. Domain verification permits the company domain; external test accounts need verification or separately approved SES production access.

## Proposed implementation for review

Create an independently deployable non-production Feedback backend using CDK. Import the existing HARVEST staging user pool for AppSync authentication. Create dedicated dev report, notification-read, admin-assignment and email-receipt tables, a private media bucket, resolver Lambda, and email worker with failure queue. Do not create a user pool, app client, identity pool, or modify HARVEST's pool/roles.

Every exposed resolver must call the trusted HARVEST staging `/api/me` using the caller's access token before touching data. Bind caller subject to the AppSync identity. Admin access additionally requires a server-owned enabled assignment keyed by stable subject and a live Operator membership. Recheck this for each read, admin write and attachment operation; no authorization-result caching.

Client report reads require both exact reporter subject and a live membership in the report's selected organization. New reports derive immutable reporter identity and organization from HARVEST. Multiple memberships require an explicit selection. Client writes expose only submission and request-update behavior; admin writes expose only valid status/assignee changes and server timestamps. Do not expose unrestricted model CRUD.

Replace shared-session direct S3 credentials with server-authorized attachment operations. Uploads must be validated for type, size, ownership and one-time attachment claiming. Downloads require access to the linked report. Any presigned URL has a documented finite capability lifetime; it cannot be described as immediately revocable once issued. Use short expiry and test denial of new operations after revocation. If immediate revocation of in-flight downloads is required, use an authenticated streaming proxy instead.

Keep the latest email renderer and branding. Route recipients through selected server admin assignments rather than every Operator or the legacy pool. Preserve the documented outstanding client-email policy decision; do not silently invent an explicit-response event. Leave delivery disabled until the approved recipients and event policy are resolved.

### Planned files

- New `integration-backend/` package with CDK entry, stack, GraphQL schema, resolver, authorization/storage helpers, email worker wiring and mocked security/stack tests.
- Feedback `src/lib/amplify.ts`, `shared-feedback-api.ts`, `shared-storage.ts`, `harvest-viewer.ts`, `harvest-shared-session.ts`, `harvest-account.ts`, and related tests: same-session access-token calls, server-derived admin decision and attachment operations.
- Feedback `docs/HARVEST_AUTH_INTEGRATION.md`, `docs/EMAIL_SETUP.md`, and this inspection record: deployment commands, environment boundary, revocation semantics and live results.
- HARVEST `ui/.env.example`, `ui/vite.config.ts`, `ui/netlify.toml` and focused proxy tests only if inspection proves changes needed. Keep sidebar placement and typography intact.
- Ignored local environment files for both fresh checkouts; no AWS credentials or tokens.

No workflow edits or push to environment branches are included without establishing the approved review flow.

## Release gates

1. Resolve selected admin subject/account, implementation approval and Netlify deployment access. Read any additional owner instructions supplied.
2. Run baseline tests, typechecks and builds; implement mocked direct-operation and revocation tests. Synthesize and inspect the stack: zero Cognito resources and no production identifiers/permissions.
3. Deploy the dedicated dev backend, inspect physical resources and outputs, test direct API denial with no/invalid tokens, two reporters, a selected Operator, an unselected Operator and revoked memberships. Verify attachment validation and isolation.
4. Configure only HARVEST prestaging endpoint and same-domain proxy. Verify a real browser login, new-tab session, role landing, report creation/list, attachment upload/download, update request, admin status/owner save, sign-out and email delivery.
5. Record evidence before promoting through the approved prestaging flow. Staging remains gated until prestaging passes and a separate Feedback test backend exists. Production is excluded.

Local tests and UI rendering are not evidence of live backend authorization, uploads or email delivery.
