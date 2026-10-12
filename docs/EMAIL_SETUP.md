# Standalone feedback email setup

The email worker and an earlier screenshot-based template were deployed to the existing shared sandbox on 12 October 2026. A labelled test report exercised the stream-to-SES pipeline. The latest compact layout, category-specific wording and organization-only admin messages have been verified locally and sent as previews, but are not yet deployed. Preview delivery does not prove the latest event rules are active.

## Sender configuration

Client-facing mail (including signup verification): `sahil+feedback@withmeridian.ai`.
Admin-facing mail: `manasa+feedback@withmeridian.ai`.
Each sender is also its Reply-To address. Confirm that both aliases accept replies in the underlying Sahil/Manasa mailboxes.

In account `938463256739`, region `us-east-2`, verify the `withmeridian.ai` domain in SES (or both individual sender identities). Publish the exact Easy DKIM CNAME records returned by SES. Configure an aligned custom MAIL FROM subdomain with SES's MX and SPF TXT records, and an appropriate DMARC TXT record. Do not overwrite an existing corporate SPF or DMARC policy without the domain owner's review. Verify SES identity status and DKIM success before enabling delivery. SES production access is required to send to unverified recipients; in SES sandbox verify test recipients. Preserve the company's existing inbound MX records so replies continue to arrive.

These settings improve deliverability but do not guarantee inbox placement. Inspect delivered headers for SPF/DKIM/DMARC passes and test Gmail and the company mail provider. Monitor SES bounces, complaints and account suppression. Configure APP_BASE_URL when a usable HTTPS app URL exists: localhost links cannot be used by recipients on other computers. During local testing leave it empty; emails omit the View report button and explain how to open the application.

## Backend environment values (not VITE variables)

```
CLIENT_NOTIFICATION_FROM_EMAIL=sahil+feedback@withmeridian.ai
ADMIN_NOTIFICATION_FROM_EMAIL=manasa+feedback@withmeridian.ai
APP_BASE_URL=<HTTPS feedback URL, or leave empty for local testing>
COGNITO_EMAIL_SOURCE_ARN=<verified SES identity ARN in us-east-2>
FEEDBACK_EMAIL_ENABLED=true
```

`FEEDBACK_EMAIL_ENABLED` defaults to false. Enable only after the shared backend owner reviews this change and SES is ready. Cognito's HTML message trigger and SES sender configuration are installed only when `COGNITO_EMAIL_SOURCE_ARN` is supplied. No AWS credentials belong in browser code, Git or this file.

## Behavior

- Public registration is disabled in Cognito (`allowAdminCreateUserOnly: true`). Administrators provision accounts and assign their profile attributes. The shared URL opens the sign-in page; possession of the URL does not grant access.
- The sign-in page starts with the work email. Cognito selects password sign-in for accounts with an existing password, and users may choose email-code sign-in instead. Passwordless provisioned accounts verify their email code and may create a password or continue with email-code sign-in. No public Create account action is shown. Users who forgot a password can select Set or reset password; Cognito verifies an emailed recovery code before saving a new password. This recovery path does not create new accounts.
- A committed report INSERT sends a client receipt and an admin new-report notice. MODIFY events send admin update-request notices and client admin-change/status/closure notices. A change to CLOSED sends one closure email, not two notices. CLOSED remains the current combined Completed/Closed state; no separate completion state or written comments are added.
- Recipients are derived from immutable server report identity and enabled Cognito admins, not from browser arguments. Ownership/field-level and storage rules are retained. Cross-user API tests still require live authenticated accounts.
- The existing inline notification remains; client submissions also refetch authorized records because the custom submit mutation does not emit the generated model onCreate subscription.
- The legacy new-report admin mail pipeline remains active while `FEEDBACK_EMAIL_ENABLED` is false. It becomes a no-op when the stream worker is enabled, avoiding duplicate admin emails. Review sender configuration before enabling delivery.
- Routine stream retries skip delivered receipts. A short lease prevents concurrent processing. SES and DynamoDB cannot commit atomically: an SES success followed by a receipt failure, or an ambiguous network timeout, can still duplicate mail. Delivery is not claimed to be exactly once.
- The stream starts at LATEST: existing demonstration records are not intentionally emailed. Failed records retry and then go to the failed-event queue for investigation. Monitor queue depth and Lambda errors; replay within the seven-day receipt retention period.

## Resources and release checks

When enabled, the worker uses a delivery-receipt DynamoDB table and failed-event SQS queue alongside Lambda/SES. These AWS services can incur usage charges. The email Lambda, receipt table and failed-event queue already exist in the shared sandbox. Coordinate any further deployment with the shared backend owner.

Before release: verify upload and recording submissions, both submission emails, admin request email, admin-update and Assigned/In Progress/Closed client emails, matching in-app notifications, retry behavior, two-client report/storage isolation, real replies, and sender authentication headers. Sign-in and verification emails are outside this feedback-notification scope. Production inbox placement and SES delivery remain unverified until these checks are performed.

## Five feedback events (12 October 2026)

1. New report: one receipt to its client and one alert per enabled administrator.
2. Client requests an update: notify enabled administrators.
3. Admin saves an update: notify the client using the server adminActivityAt timestamp. The current report schema has no written admin-comment field; these emails do not invent update text.
4. Timeline changes: notify the client and display previous → current status.
5. Closure: send one closure email, combining the status/admin activity from that write.

Status and admin activity in the same write produce one client email. Bare owner/updatedAt edits do not trigger a separate owner-assignment email. Recipients come from the stored server-derived reporter identity and Cognito admin groups, supporting both the Feedback pool and configured HARVEST staging pool. No changes to sign-in, user signup, or report authorization are included.

The supplied template and replyable senders are retained. Code tests mock SES; they send no mail. Activating delivery requires deploying the agreed shared backend with FEEDBACK_EMAIL_ENABLED=true and verifying SES sender/recipient configuration. This code change alone does not enable the live sandbox. Do not deploy all staging integration changes merely to enable email without coordinating with Sahil.

## Screenshot-based feedback template

The user-provided email screenshots supersede the earlier serif ZIP for feedback notifications. The local feedback-only layout uses a cream background, warm white rounded card, dark-green sans-serif text, orange outline mark beside HARVEST, terracotta action button when a usable report URL exists, and a muted footer outside the card. Mobile padding and heading sizes adapt to narrow screens. The mark was reconstructed as an SVG from those screenshots and rasterized to PNG for inline CID delivery. No downloaded template or brand artwork is used. Gmail search-result highlights are excluded. Authentication email content and the application's UI are unchanged.

The screenshot-based template and explicit client submission Report ID line were deployed to the existing shared sandbox on 12 October with the user’s approval. Authentication and HARVEST integration changes were excluded. The user confirmed receipt and rendering of previews. Subsequent compact templates and copy remain pending deployment. Local preview HTML uses loopback links only for review; production emails require the configured HTTPS app URL.

## Current review changes and remaining work

The compact template preserves the screenshot palette, inline logo, replyable senders, and permanent UUID-based report links. Blocker/Bug receipts acknowledge the report without resolution promises; Improvement thanks the client for feedback. Admin alerts identify the full stored organization name and Company/Partner persona, rather than the individual reporter or short reference handle. Preview recipients/senders used for review do not override production recipient routing.

`referenceHandle`/`referenceNumber` are optional renderer inputs demonstrated as MERIDIAN · #042 in previews. The worker still falls back to FB-XXXX because no live allocator/schema is wired. See REPORT_REFERENCES_REVIEW.md for the isolated transaction draft and integration requirements.

The final requested client email policy is submission, an explicit response to an update request, and closure only. This is not yet implemented: the current worker still emails on timeline/adminActivityAt changes. A trusted server response event is needed before that restriction can be enabled. The authentication flow and analytics connector settings are outside this template change.
