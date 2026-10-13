# Dedicated HARVEST Feedback backend

This is the new non-production backend boundary. It imports HARVEST staging Cognito and creates no user pool, app client or identity pool. The existing Amplify sandbox remains unchanged.

Run from the Feedback repository root:

```
npm run integration:typecheck
NODE_OPTIONS=--no-experimental-webstorage npm run test:coverage
node integration-backend/synth.mjs
```

The synthesis command reads the ignored `.env.integration.local`, writes `cdk.out`, and asserts the resource boundary. It never deploys. Use a reviewed CDK deployment of that assembly with AWS profile `manasa` in `us-east-2` after inspecting the template and resolver tests. Only dev/test targets are permitted.

Each resolver independently calls HARVEST's staging `/api/me` with the access token. Admin access requires an enabled assignment keyed by the verified Cognito subject plus current Operator membership. The resolver has read-only access to that assignment table. Assignment is an owner action after verifying the real account and membership; an email address alone never grants access.

Reporter reads additionally require current membership in the stored organization. Client writes support submission and update requests; server timestamps and optimistic revisions protect changes. There is no generated model CRUD or token-group admin bypass.

Attachment upload/download capabilities expire in 60 seconds. New operations recheck live membership. An already issued URL remains usable for its finite lifetime; do not claim instant revocation of that URL. Atomic claims prevent reuse across reports, and downloads pin the immutable S3 version captured at submission. Versioned storage is retained on stack deletion. Cleanup of orphaned objects is still pending.

The existing Admin selector is retained as a queue identifier (`admin@example.com`); it is not a recipient address. The selector also lists active selected Operators by stable subject, with server validation on every assignment.

Email preserves the latest renderer and existing five-event policy. Recipients are selected assignments intersected with current HARVEST Operator memberships and enabled, confirmed Cognito identities. A Feedback-owned IAM-only directory uses a dedicated column-scoped database credential, read-only transactions and verified RDS TLS. It never reads the HARVEST master database secret. Run the reviewed `node integration-backend/provision-directory.mjs .integration-outputs.json --apply` after the dev stack exists to provision that narrowly scoped login through the existing staging runner. No HARVEST API code deployment or security-group modification is needed.

Email starts disabled. Its receipts, retry lease and failure queue are ready; enable only after the directory and SES identities are checked. The documented explicit-response-only client email policy is still unresolved; this integration preserves the copied feature's existing event behavior.

The private static bucket and CloudFront origin serve only `/feedback` and its assets. `prepare-release.mjs` builds from verified stack outputs and prepares the upload package. Its public settings file supplies HARVEST prestaging's endpoint and reverse-proxy origin. Netlify's HARVEST headers do not apply to proxied responses, so the static origin supplies its own CSP, including blob media previews.

**Remaining release gates:** live API/storage/email checks, real browser session/sign-out validation and publication of HARVEST through its approved flow. Staging and production remain gated.
