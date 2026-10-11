# Standalone feedback email setup

This implementation is prepared locally. It has not been deployed or tested against SES. The frontend preview is not evidence of live email delivery.

## Sender configuration

Client-facing mail (including signup verification): `sahil+feedback@withmeridian.ai`.
Admin-facing mail: `manasa+feedback@withmeridian.ai`.
Each sender is also its Reply-To address. Confirm that both aliases accept replies in the underlying Sahil/Manasa mailboxes.

In account `938463256739`, region `us-east-2`, verify the `withmeridian.ai` domain in SES (or both individual sender identities). Publish the exact Easy DKIM CNAME records returned by SES. Configure an aligned custom MAIL FROM subdomain with SES's MX and SPF TXT records, and an appropriate DMARC TXT record. Do not overwrite an existing corporate SPF or DMARC policy without the domain owner's review. Verify SES identity status and DKIM success before enabling delivery. SES production access is required to send to unverified recipients; in SES sandbox verify test recipients. Preserve the company's existing inbound MX records so replies continue to arrive.

These settings improve deliverability but do not guarantee inbox placement. Inspect delivered headers for SPF/DKIM/DMARC passes and test Gmail and the company mail provider. Monitor SES bounces, complaints and account suppression. Use a production HTTPS app URL: localhost links cannot be used by recipients on other computers.

## Backend environment values (not VITE variables)

```
CLIENT_NOTIFICATION_FROM_EMAIL=sahil+feedback@withmeridian.ai
ADMIN_NOTIFICATION_FROM_EMAIL=manasa+feedback@withmeridian.ai
APP_BASE_URL=<HTTPS standalone application URL>
COGNITO_EMAIL_SOURCE_ARN=<verified SES identity ARN in us-east-2>
FEEDBACK_EMAIL_ENABLED=true
```

`FEEDBACK_EMAIL_ENABLED` defaults to false. Enable only after the shared backend owner reviews this change and SES is ready. Cognito's HTML message trigger and SES sender configuration are installed only when `COGNITO_EMAIL_SOURCE_ARN` is supplied. No AWS credentials belong in browser code, Git or this file.

## Behavior

- Public registration is disabled in Cognito (`allowAdminCreateUserOnly: true`). Administrators provision accounts and assign their profile attributes. The shared URL opens the sign-in page; possession of the URL does not grant access.
- The sign-in page starts with the work email. Cognito selects password sign-in for accounts with an existing password; passwordless provisioned accounts verify their email code and must create a password before opening protected routes. No public Create account or Set up existing account actions are shown. Returning users sign in with a password. Users who never chose their provisioned password can select Set or reset password; Cognito verifies an emailed recovery code before saving their chosen password. This recovery path does not create new accounts.
- A committed report INSERT sends a client receipt and an admin new-report notice. MODIFY events send admin update-request notices and client admin-change/status/closure notices. A change to CLOSED sends one closure email, not two notices. CLOSED remains the current combined Completed/Closed state; no separate completion state or written comments are added.
- Recipients are derived from immutable server report identity and enabled Cognito admins, not from browser arguments. Ownership/field-level and storage rules are retained. Cross-user API tests still require live authenticated accounts.
- The existing inline notification remains; client submissions also refetch authorized records because the custom submit mutation does not emit the generated model onCreate subscription.
- The legacy new-report mail pipeline becomes a no-op to avoid duplicate emails after the stream worker is enabled. Deploy the migration and enable delivery together after reviewing configuration.
- Routine stream retries skip delivered receipts. A short lease prevents concurrent processing. SES and DynamoDB cannot commit atomically: an SES success followed by a receipt failure, or an ambiguous network timeout, can still duplicate mail. Delivery is not claimed to be exactly once.
- The stream starts at LATEST: existing demonstration records are not intentionally emailed. Failed records retry and then go to the failed-event queue for investigation. Monitor queue depth and Lambda errors; replay within the seven-day receipt retention period.

## Resources and release checks

When enabled, the worker uses a delivery-receipt DynamoDB table and failed-event SQS queue alongside Lambda/SES. These AWS services can incur usage charges; nothing has been provisioned by this local implementation. Coordinate the shared sandbox deployment and cost decision before enabling.

Before release: verify one signup email and mandatory password setup, repeated password-only login without email delivery, upload and recording submissions, both submission emails, admin request email, Assigned/In Progress/Closed client emails, matching in-app notifications, retry behavior, two-client report/storage isolation, real replies, and sender authentication headers. Production inbox placement and SES delivery remain unverified until these checks are performed.
