# Feedback to Linear: local integration

## Admin flow

1. A client submits a Feedback report. This never creates a Linear issue by itself.
2. A verified Feedback admin reviews the report, chooses a Linear team, and saves it as **Assigned** or **In progress**. When Linear is configured, the API requires a team for either status.
3. The guarded Feedback API validates the team against Linear's current team list and records a pending issue request. A separate Reports stream worker creates the issue and stores its Linear ID, identifier, and URL on the report.
4. The admin dialog shows pending, failed, or linked state. A failed request can be retried by saving the report again. The worker also retries transient failures through its stream source and dead-letter queue.

For now, every verified Meridian developer or operations teammate with an active HARVEST Operator membership has the same Feedback admin view. Assignment does not narrow Feedback visibility. The intended later policy can give Feedback admin access only to support: the assigned developer can work from the self-contained Linear issue and its copied files without opening Feedback. The Feedback report link in the issue is labelled as a support reference. The existing Feedback notification event tells the client that the report was updated and shows its **Assigned** status after the admin saves; Linear does not send client notifications. Before the current release, verify that every intended admin actually has the Operator membership and an active HARVEST account.

If the admin selects a team while the report remains **New**, the team is saved and issue creation waits for assignment. Once routing has started, the team is locked locally; moving a linked issue to another team is outside this version. Other Feedback status changes do not edit the Linear issue.

## Linear issue format

The agreed integration uses a fixed template only. It makes no LLM or other AI model calls, does not rewrite the client's description, and does not generate inferred reproduction steps. An admin reads the original report and chooses the destination team and owner.

The issue title is `FB-XXXX · <report title>`. The Markdown description has Source, a support-only link to the Feedback admin report, Context (product area and priority), the reported behavior as a quoted block, and an Attachments section when files exist. It does not invent steps or completion criteria, and it does not include reporter email. Priority maps Blocker → Urgent, Bug → High, Improvement → Medium. No Linear workflow state is forced, so the chosen team's Backlog or Triage default applies.

The worker reads the immutable S3 version claimed when the report was submitted, then uploads each file to Linear's private storage before issue creation. The issue contains the resulting Linear file links, not expiring Feedback or S3 signed URLs. This covers the report's uploads and screen recordings (up to five, at most 50 MiB each). The worker checks the attachment's report ownership, size and media type again. It has only `dynamodb:GetItem` on the attachment table and `s3:GetObjectVersion` on the Feedback media prefix. A failed file transfer prevents issue creation and leaves the report in the retryable failed state. A retry after an ambiguous issue-create result first looks up the deterministic issue ID. Uploads completed before an earlier failure may leave private orphan files in Linear; they are not shown on an issue.

Copies in Linear follow Linear workspace access and retention, independently of later Feedback access changes. Verify the workspace's file permissions and the supported file sizes and formats in a separately authorized non-production test before enabling this for client reports.

The Feedback Owner selector is the existing HARVEST administrator selector. When the selected owner has a verified HARVEST email that exactly matches an active, assignable Linear user, the issue receives that Linear assignee. The Admin queue, Unassigned, or an unmatched or ineligible owner leaves the Linear issue without a person assignee. The selected Linear team is always explicit.

The issue ID is a deterministic UUID derived from the Feedback report ID. Before creating, the worker looks up that UUID, and it looks it up again after an ambiguous create failure. This prevents duplicate issues during ordinary stream retries. The local tests use mocked Linear responses; the actual workspace API behavior still needs a permitted non-production live check before release.

## Configuration and security

The integration is disabled unless synthesis receives `FEEDBACK_LINEAR_TOKEN_SECRET_NAME=harvest-feedback/integration/<target>/linear-token`, where `<target>` is `dev` or `test`. The secret must already exist in AWS Secrets Manager. Its value is a Linear API token with access only to the intended workspace. The token is read by the backend resolver and worker, never placed in the browser, repository, or CloudFormation template. No secret or Linear issue is created by local synthesis.

`linearTeams` is an admin-only query. The backend rechecks the active HARVEST session and membership on every call. Clients cannot set the team or read the linked Linear fields through the API. The worker alone writes issue IDs and URLs. Its dead-letter queue is named `FailedLinearIssue` in the CDK stack and is present only when the integration is configured.

## Local verification

From the Feedback repository root, run:

```text
npm run integration:typecheck
npm run typecheck
npm test
npm run build
node integration-backend/synth.mjs
```

Run synthesis once without the Linear setting and once with the approved secret **name** to verify the optional worker and read grants. Synthesis does not deploy. The unit tests mock every Linear call.

Local verification on 19 October 2026: `npm run integration:typecheck`, `npm run typecheck`, `npm run build`, and the full `npm test -- --maxWorkers=2` suite passed (221 files, 1,430 tests). Synthesis passed with Linear and attachment transfer enabled, including the worker and guarded operations. `git diff --check` passed. The standalone browser adapter deliberately reports Linear as unconfigured, so its browser flow cannot verify a real team selection or file transfer; those states are covered by mocked tests. If the Linear team lookup fails, the admin dialog blocks a new assignment that needs a team while allowing unrelated report changes.

The live Feedback dev CloudFormation template was copied read-only from the AWS Console on 19 October 2026 into the ignored `.integration-release/live-template.json`. It has 49 resources. Synthesis with the deployed API URL, email toggle and Sentry secret reference plus the proposed Linear secret **name** has 55 resources. The fresh offline scope gate passed: six new Linear resources, one new output, and updates to the resolver role policy, resolver code/configuration, and GraphQL schema. The HARVEST notification bridge and multi-file schema are already deployed in dev. The gate checks the exact proposed resource shapes and reviewed bundle fingerprints while rejecting other stack changes. No AWS or Linear resource was changed by this comparison.

## Release sequence still required

1. Review this branch and the generated issue format. Keep it uncommitted and unpushed until Sahil approves.
2. Rerun the full local checks before a release. The same read-only scope function passed against the freshly saved live AWS Console template, but the direct AWS SDK command has not run because this machine's `harvest-dev` profile has no credentials. Keep the deployed dev API, email and Sentry settings when synthesizing so the gate rejects unrelated configuration changes. Recheck the live template immediately before an approved deployment in case the stack changes meanwhile.
3. The dedicated dev Linear credential is stored in the AWS Secrets Manager secret `harvest-feedback/integration/dev/linear-token` in `us-east-2`. Configure only that secret **name** for synthesis. Do not paste the token into chat, source files, `.env.integration.local`, or browser settings.
4. Review and approve a non-production Feedback dev backend and private UI release. The legacy standalone Amplify deploy does not publish HARVEST `/feedback`.
5. The one authorized non-production Linear test issue can be used after secure access is available. Use real HARVEST admin sessions from development and operations to confirm both can see the full queue. Select a team, assign a test report with an image and a screen recording, and verify its issue identifier, team, description, priority, owner matching, and both files in Linear. Confirm the assignee can view the report content and files in Linear without relying on Feedback access, the client sees the assigned status notification, and other clients remain isolated. Verify file-size/format behavior, retry/duplicate behavior, and revoked-user API denial. Check the worker failure queue and logs if the report stays pending or fails. Validate prestaging before staging.

Do not call the integration live until the non-production release gates pass. Sahil has authorized one clearly labelled non-production Linear test issue once secure access is available; this does not authorize additional Linear changes, deployment, commit, or push.

The Feedback release helper now emits `VITE_FEEDBACK_GRAPHQL_URL` and a `FEEDBACK_RELEASE_MANIFEST` string from validated dev/test stack outputs. HARVEST's local Netlify route helper uses the manifest as the deployment gate. The older origin-only Vite route hook has been removed locally, so an old `FEEDBACK_SITE_ORIGIN` setting cannot publish `/feedback` without the manifest. This handoff has passed local tests and build checks, but no site has been published from it.

## Future production reminder

Before planning a production release, create a separate production Linear credential and store it in a separate production secret. Do not reuse the `HARVEST Feedback dev` key. Confirm the production workspace/team access and decide whether a dedicated integration identity should own the key instead of a person's account. The current synthesis permits only dev/test targets; production needs its own review and implementation before any production credential is used.
