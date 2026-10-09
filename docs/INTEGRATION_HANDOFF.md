# Integration handoff

The app code and environment variable names are in place. Complete this checklist when account access is available. Do not put tokens, passwords, or `.env.local` in Git. Partner invitations have been removed. HARVEST users and existing login credentials are the intended auth source; that integration has not been implemented yet.

## Shared development baseline

`dev` contains the current admin and client implementations. Manasa pulls `dev` and may push her completed work directly to it. Sahil continues auth integration on a feature branch based on `dev` and brings that work back to `dev` after checking for Manasa's updates. Do not push directly to `test` or `main`. A normal push to `dev` starts the Amplify deploy workflow when `AMPLIFY_APP_ID` is configured; coordinate before pushing if deployment is paused.

| Service | Obtain from account owner | Configure | Verify |
|---|---|---|---|
| AWS Amplify | Access to the AWS account and the intended `us-east-2` environment | Deploy the backend for the agreed branch; generate local `amplify_outputs.json` for development | Email-code sign-in, admin/client roles, report access rules, and file uploads work with real users |
| Sentry | Frontend DSN, organization slug, project slugs, and an API token allowed to read issues | `VITE_SENTRY_DSN` in the frontend environment; `SENTRY_ORG` and `SENTRY_PROJECTS` in the Amplify backend environment; `SENTRY_AUTH_TOKEN` as an Amplify secret | A real unresolved issue appears in Product insights, and Make a report links it to feedback |
| Google Analytics 4 | HARVEST web data stream Measurement ID | `VITE_GA_MEASUREMENT_ID` in the frontend environment | Page views appear for route changes without email addresses or feedback text |
| Looker Studio | Embed URL for a GA4-backed report and permission to view it | `VITE_LOOKER_EMBED_URL` in the frontend environment | Traffic tab loads the report for an admin |
| Admin report email | Existing SES verified sender (or verify one) and enabled admin users in the Cognito `admins` group | Set `ADMIN_NOTIFICATION_FROM_EMAIL` before backend deployment; set `APP_BASE_URL` to the deployed app URL for direct report links | A partner's report reaches every admin inbox; in SES sandbox, verify recipient addresses too |

## Before requesting credentials

- Confirm which AWS account and Amplify app/branch will host `dev`, `test`, and `main`.
- Confirm the Sentry organization and actual project slugs. The current defaults are `harvest-ui`, `harvest-api`, and `feedback-app`.
- Confirm who owns the GA4 property and Looker Studio report, and that the report uses owner credentials for the embed.
- Confirm the real admin users and assignee names before replacing the prototype assignee list.

## When access arrives

1. Copy `.env.example` to ignored `.env.local` for local frontend values. Enter only the values needed for the environment being tested.
2. Configure the backend values and Sentry secret in the intended Amplify environment, then deploy the backend. Keep generated `amplify_outputs.json` out of Git. For the complete app, use the generated outputs; the optional Cognito-only environment variables connect sign-in alone and do not configure Data or Storage.
3. Until HARVEST login is integrated, create temporary test client and admin users through the approved AWS process, with the required persona/company attributes and `admins` group membership.
4. Run the live acceptance checks in `AGENTS.md` §12, including API checks that a client cannot read another client's report or change admin-only fields. Also verify that a client cannot submit a report pointing to another client's uploaded attachment. The server now resolves the caller's Cognito identity and checks the object's owner path and metadata, but this still needs a live cross-user check.
5. Run a fresh `npm ci`, the test suite, typecheck, and production build before publishing further changes to `dev`.

Account provisioning, deployment, and real-user checks remain pending until access is granted. The local unit tests and visual review do not replace those checks.

## Testing the shared sandbox locally

Pull `dev`, copy the sandbox owner's generated `amplify_outputs.json` into the repository root through a private channel, then run `npm ci` and `npm run dev`. The outputs file is ignored and contains the frontend service configuration; do not share AWS access keys, passwords, `.env.local`, or CLI login caches. AWS IAM credentials are needed to deploy or change the sandbox, not to sign in and test the running app.

For the current Cognito sandbox, an admin must be in the `admins` group. On first sign-in, verify the inbox using the eight-digit email code. Users may create a password for later sign-ins or continue using email codes. The app sends admins to admin review and other users to client feedback based on their Cognito group. The account creator assigns Company or Partner in `custom:persona` for new client accounts; users do not select a role or persona in the app. Existing Operator accounts remain supported for sign-in. The HARVEST login integration must replace this separate credential flow before release.

Account-type selection and new `custom:clientPersona` provisioning were removed after the sandbox schema failure. Existing `custom:clientPersona` values, if any, remain readable; otherwise the app uses the required `custom:persona` attribute. The legacy `/account/setup` URL redirects to the appropriate workspace.

Server-side attachment verification now resolves the caller's Cognito identity from their ID token, checks the exact storage-owner prefix, and checks the uploaded object's size and content type before creating feedback. Unit tests cover forged ownership and metadata. Real cross-user upload, status/assignee and report-read checks still need authenticated client/admin sessions before release.

The sandbox is for testing, not production hosting. Do not describe the app as live until hosting and all acceptance checks pass. The confirmed product choices are ten product areas including all payout cases, Georgia headings with sans-serif body text, and optional password sign-in after email verification. The sample Insights panels are for presentations when live analytics are unconfigured.

### Current verification limits

Email OTP and password creation have been observed for the first sandbox client. Admin first-password setup and password sign-in, client upload/recording submissions, admin changes and cross-user API authorization still require live verification. Further AWS deployments were stopped at the owner's request to avoid additional charges. Existing sandbox resources can still incur usage charges until removed.

After invitation removal, 220 tests and the coverage thresholds passed. The frontend build (including TypeScript) and Amplify TypeScript check also passed. No production deployment or release approval is implied.

### Admin notification demo

A new report arriving while an admin is signed in shows an in-app toast. The report submit pipeline also tries to send a short SES email to every enabled Cognito `admins` group member. It does not include the description or reporter email. Mail failures are logged; the saved report still succeeds, so a mail outage cannot cause duplicate submissions from a retry. Check Lambda logs and inboxes during the live test.

Before testing, Manasa should pull the latest `dev` and set `ADMIN_NOTIFICATION_FROM_EMAIL` to a verified SES sender before deploying this backend in the agreed sandbox. Set `APP_BASE_URL` to the sandbox app URL for direct links in email. If SES is still in its sandbox, recipient admin addresses also need verification. These are backend build environment values, not `VITE_` browser values. Keep any outputs file ignored.

Run this sequence with approved test accounts: client signs in → submits a report → admin sees the live toast → admin receives SES email → admin opens the report and changes status/owner → client sees the update. Test upload, screen recording, and cross-user API authorization separately. SES delivery has not been verified against the live sandbox yet. No AWS deployment was run from this checkout.

### Account type assignment

Company/Partner selection and its Cognito provisioning were removed. Cognito attributes and the `admins` group now determine the user's persona and workspace. Password setup and subsequent password sign-in remain available. No AWS deployment was run for this removal.
