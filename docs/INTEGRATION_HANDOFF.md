# Integration handoff

The app code and environment variable names are in place. Complete this checklist when account access is available. Do not put tokens, passwords, or `.env.local` in Git.

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
2. Configure the backend values and Sentry secret in the intended Amplify environment, then deploy the backend. Keep generated `amplify_outputs.json` out of Git.
3. Create test client and admin users through the approved AWS process, with the required persona/company attributes and `admins` group membership.
4. Run the live acceptance checks in `AGENTS.md` §12, including an API check that a client cannot read another client's report or change admin-only fields.
5. Run the test suite, typecheck, and production build before opening the PR to `dev`.

Account setup, deployment, and real-user checks remain pending until access is granted. The local unit tests and visual review do not replace those checks.
