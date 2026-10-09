# Integration handoff

The app code and environment variable names are in place. Complete this checklist when account access is available. Do not put tokens, passwords, or `.env.local` in Git.

## One working branch

`codex/harvest-integration` contains the admin and client implementations. Sahil and Manasa should pull this branch before making further changes, coordinate pushes to it, and use it as the source of the pull request into `dev`. Do not push directly to `dev`, `test`, or `main`. The former admin and client branches are historical references, not parallel development targets.

| Service | Obtain from account owner | Configure | Verify |
|---|---|---|---|
| AWS Amplify | Access to the AWS account and the intended `us-east-2` environment | Deploy the backend for the agreed branch; generate local `amplify_outputs.json` for development | Email-code sign-in, admin/client roles, report access rules, and file uploads work with real users |
| Sentry | Frontend DSN, organization slug, project slugs, and an API token allowed to read issues | `VITE_SENTRY_DSN` in the frontend environment; `SENTRY_ORG` and `SENTRY_PROJECTS` in the Amplify backend environment; `SENTRY_AUTH_TOKEN` as an Amplify secret | A real unresolved issue appears in Product insights, and Make a report links it to feedback |
| Google Analytics 4 | HARVEST web data stream Measurement ID | `VITE_GA_MEASUREMENT_ID` in the frontend environment | Page views appear for route changes without email addresses or feedback text |
| Looker Studio | Embed URL for a GA4-backed report and permission to view it | `VITE_LOOKER_EMBED_URL` in the frontend environment | Traffic tab loads the report for an admin |

## Before requesting credentials

- Confirm which AWS account and Amplify app/branch will host `dev`, `test`, and `main`.
- Confirm the Sentry organization and actual project slugs. The current defaults are `harvest-ui`, `harvest-api`, and `feedback-app`.
- Confirm who owns the GA4 property and Looker Studio report, and that the report uses owner credentials for the embed.
- Confirm the real admin users and assignee names before replacing the prototype assignee list.

## When access arrives

1. Copy `.env.example` to ignored `.env.local` for local frontend values. Enter only the values needed for the environment being tested.
2. Configure the backend values and Sentry secret in the intended Amplify environment, then deploy the backend. Keep generated `amplify_outputs.json` out of Git. For the complete app, use the generated outputs; the optional Cognito-only environment variables connect sign-in alone and do not configure Data or Storage.
3. Create test client and admin users through the approved AWS process, with the required persona/company attributes and `admins` group membership.
4. Run the live acceptance checks in `AGENTS.md` §12, including API checks that a client cannot read another client's report or change admin-only fields. Also verify that a client cannot submit a report pointing to another client's uploaded attachment. The current AppSync resolver checks the `feedback-media/` prefix but cannot prove Storage ownership from its user-pool identity; resolve this before release.
5. Run a fresh `npm ci`, the test suite, typecheck, and production build before opening the PR from `codex/harvest-integration` to `dev`.

Account setup, deployment, and real-user checks remain pending until access is granted. The local unit tests and visual review do not replace those checks.
