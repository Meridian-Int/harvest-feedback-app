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

The existing Admin selector is retained as a queue identifier (`admin@example.com`); it is not a recipient address. Individual owner assignments remain pending the approved account setup.

**Remaining gates:** live two-user authorization/storage tests, deployment, static UI hosting and HARVEST same-origin proxy configuration, real browser session/sign-out validation, and email worker integration using trusted selected-admin recipients. Email is not enabled by this stack. Preserve the existing latest renderer; the documented explicit-response email policy is still unresolved. Staging and production remain gated.
