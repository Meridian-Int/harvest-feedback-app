# Dedicated HARVEST Feedback backend

This is the new non-production backend boundary. It imports HARVEST staging Cognito and creates no user pool, app client or identity pool. The existing Amplify sandbox remains unchanged.

Run from the Feedback repository root:

```
npm run integration:typecheck
NODE_OPTIONS=--no-experimental-webstorage npm run test:coverage
node integration-backend/synth.mjs
```

The synthesis command reads the ignored `.env.integration.local` or explicit environment settings, writes `cdk.out`, and asserts the resource boundary. It never deploys. Before a separately approved Feedback dev release, `verify-deploy-scope.mjs` compares the proposed template with the deployed stack and allows only the reviewed Insights changes. `write-stack-outputs.mjs` saves public outputs for the UI build; it never deploys. Only dev/test targets are permitted by synthesis.

For integrated Admin Insights, the resolver reads unresolved issues from HARVEST's existing Sentry project `meridian-zt/javascript-react`, filtered to `prestaging` on Feedback `dev` and `staging` on Feedback `test`. Set `FEEDBACK_SENTRY_TOKEN_SECRET_ARN` in the ignored `.env.integration.local` or the synthesis environment to the ARN of the dedicated `harvest-feedback/dev/sentry-issues-read-token` secret in account `938463256739`, region `us-east-2`. That secret was created with Sahil's approval from the existing working HARVEST staging token on 15 October 2026; a private read-only check returned 10 prestaging issues. The token is never placed in the browser build or CloudFormation template. Without the ARN, the Errors panel explicitly remains in sample mode. The resolver requires a current Feedback admin before reading Sentry. HARVEST's separate Sentry ingestion and Cognito configuration are unchanged.

The browser Sentry DSN and GA4 measurement ID are public build settings, not server API credentials. For the prestaging Feedback build, use the approved HARVEST prestaging `VITE_SENTRY_DSN`, `VITE_SENTRY_ENVIRONMENT=prestaging`, and `VITE_GA_MEASUREMENT_ID`. Manasa verified Sentry error delivery and a GA4 HTTP `204` in local shared-session mode, but did not verify authenticated route page views. No Sentry issue-read token or Looker report was configured locally. The approved integrated Traffic path reads HARVEST's existing GA4 property through the guarded resolver; it remains a labelled sample until the read settings below are deployed. Verify a real signed-in prestaging route page view in GA4 DebugView or Realtime after the approved build is published.

For live Traffic without a Looker report, set `FEEDBACK_GA4_SECRET_ARN` to the existing `harvest-refresh/staging/google-analytics` secret's complete ARN and `FEEDBACK_GA4_PROPERTY_ID` to HARVEST's **numeric prestaging property ID** during backend synthesis. The measurement ID beginning `G-` is different. The resolver receives a read grant scoped to that exact existing secret, requests only the Google Analytics read-only OAuth scope, and exposes seven complete days of users, sessions, page views, daily users and top pages only after a fresh Feedback admin check. Without both settings, the Traffic panel keeps labelled samples. This is a proposed local integration; granting the resolver access to the HARVEST secret and deploying it require separate AWS approval. The existing Looker iframe remains available if a report is added later.

Each resolver independently calls HARVEST's staging `/api/me` with the access token. In this local, undeployed change, any live Operator membership grants Feedback admin access, including HARVEST `user`. Company/Partner membership alone never grants admin access, regardless of email domain or Cognito groups. The old AdminAssignments table is retained to preserve deployed data, but this rule no longer reads it. The currently deployed dev backend still uses selected assignments until this change is reviewed and deployed.

Reporter reads additionally require current membership in the stored organization. Client writes support submission and update requests; server timestamps and optimistic revisions protect changes. There is no generated model CRUD or token-group admin bypass.

Attachment upload/download capabilities expire in 60 seconds. New operations recheck live membership. An already issued URL remains usable for its finite lifetime; do not claim instant revocation of that URL. Atomic claims prevent reuse across reports, and downloads pin the immutable S3 version captured at submission. Versioned storage is retained on stack deletion. Cleanup of orphaned objects is still pending.

The existing Admin selector is retained as a queue identifier (`admin@example.com`); it is not a recipient address. The selector also lists active Operator members by stable subject, with server validation on every assignment.

Email preserves the latest renderer and limits client mail to submission, a server-recorded response to a pending update request, and closure. Routine status changes still produce in-app notifications. In this local change, recipients are live Operator members with enabled, confirmed Cognito identities. A Feedback-owned IAM-only directory uses a dedicated column-scoped database credential, read-only transactions and verified RDS TLS. It never reads the HARVEST master database secret. The query does not read `memberships.role`; verify the existing directory credential and column grants before deployment. Applying `node integration-backend/provision-directory.mjs .integration-outputs.json --profile harvest-dev --apply`, if needed, changes database access and requires separate approval. No HARVEST API code deployment or security-group modification is needed.

Email starts disabled. Its receipts, retry lease and failure queue are ready; enable only after the directory and SES identities are checked. The integration records updateRespondedAt only for an authorized admin saving a pending request; the UI labels this action Send update. Clients cannot set that server-owned event.

The private static bucket and CloudFront origin serve only `/feedback` and its assets. `prepare-release.mjs` builds from verified stack outputs and prepares the upload package. Its public settings file supplies HARVEST prestaging's endpoint and reverse-proxy origin. Netlify's HARVEST headers do not apply to proxied responses, so the static origin supplies its own CSP, including blob media previews.

**Remaining release gates:** separately approve and publish the Feedback dev backend/UI changes, then validate the real browser session, live Admin Insights and existing report flows on HARVEST prestaging. HARVEST's CI/CD and staging/production remain unchanged.
