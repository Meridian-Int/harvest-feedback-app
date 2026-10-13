# Prestaging integration inspection and proposed backend boundary

Inspected on 12 October 2026. The user approved the implementation. The dedicated dev backend is deployed and local browser integration is under final demo validation; publication remains pending.

## Current result (local demo, 12 October 2026)

- Initial requested HEADs were verified. Work remains only on `codex/feedback-prestaging-integration` and `codex/feedback-prestaging`. HARVEST main was merged into its feature branch earlier; no environment branch was pushed.
- Dedicated `harvest-feedback-integration-dev` is deployed in account `938463256739`, `us-east-2`. It imports HARVEST pool `us-east-2_9T9vblhIf`, creates zero Cognito resources, five dedicated Feedback tables, separate private media/static buckets and thirteen guarded operations. The legacy sandbox is untouched.
- Selected staging Operator `sahil+admin@withmeridian.ai` is provisioned and assigned Feedback admin access. User-approved Company `manasa+clienta@withmeridian.ai` and Partner `manasa+clientb@withmeridian.ai` are provisioned with separate named demo organizations and `user` memberships, with no admin assignments.
- Those dedicated demo organizations use per-organization agreement bypass. The Company has seeded onboarding progress and a `mode=mock` payout fixture following HARVEST's demo setup. No signature, real payout or vendor action occurred.
- The readonly directory login is provisioned with column-scoped grants and verified RDS TLS. Selected-admin lookup succeeds live.
- Live API checks passed for report writes, reporter lists, upload/download exact bytes, one-time attachment claiming, linked-delete denial, reporter isolation, denied admin changes, server-owned update requests, notification read receipts, selected-admin revocation, membership revocation and Cognito session revocation. Temporary admin/membership test changes were restored.
- Real local browser HARVEST logins for Company, Partner and selected admin open Feedback in a new tab on `localhost:5173` with the same HARVEST session and correct landing pages. Company and Partner UI submissions and My reports passed. Native Chrome screenshot upload and screen recording submissions passed. These use the deployed dev backend, not a mock viewer.
- Real admin browser report changes, attachment preview and notification toast/bell/read behavior passed. Background revalidation no longer temporarily clears the current actor. Admins entering client routes now redirect to review; progress numerals have consistent line-height.
- Dev email worker is enabled. SES domain/DKIM are verified; stream receipts show successful sends and the user confirmed receiving demo mail. The dev demo worker now uses explicit localhost report links; restore HTTPS prestaging links before publication. SES remains in sandbox.
- Latest completed local Feedback coverage suite: 403 tests passed; typecheck/build passed. Native playback/download and final client response-notification evidence are recorded in the demo handoff as verified.
- No push during this demo pass. Earlier Feedback feature commits were pushed; HARVEST feature commits remain local because GitHub rejected `Manasavijr` with HTTP 403. No frontend publication or staging promotion occurred; production is untouched.

## Remaining publication gates

The laptop demo does not establish a deployed HARVEST prestaging experience. Resolve HARVEST feature-branch write permission, restore HTTPS email links, refresh the Feedback static package, configure prestaging endpoint/proxy, publish through the approved PR/CI flow, and rerun the same browser/security/storage/email checks on prestaging. Only then consider staging. Analytics connectors remain labelled samples where unconfigured; inbox authentication/reply behavior and orphan attachment cleanup remain separate follow-up checks.

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
| Admin test account | Initial lookup returned no user; the approved staging test account was subsequently provisioned (see current result) |
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

Keep the latest email renderer and branding. Route recipients through selected server admin assignments rather than every Operator or the legacy pool. The user subsequently approved the three-event client policy; the integration records a protected requested-response event and excludes routine client status mail. Dev delivery was enabled only after directory and SES checks.

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
