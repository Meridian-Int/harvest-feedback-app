# HARVEST account integration

## Target

Feedback `dev` and `test` use HARVEST **staging** credentials. Their reports and attachments stay in separate Feedback backends. Feedback production will use HARVEST **production** Cognito only after the staging integration passes its security and user tests. A person enters the same email and password in each app; single-click SSO is not part of this change.

HARVEST prestaging and staging frontends currently share one staging backend. The active staging user pool is `us-east-2_9T9vblhIf` in `us-east-2`. Another pool has the same display name; select by ID, never by name. Keep pool IDs and app client IDs in environment configuration rather than hardcoding them in application logic.

## Verified on 11 October 2026

- The active HARVEST staging pool has email/password sign-in, 138 users, one web app client, no Cognito groups, and no custom persona or company attributes. Its web client enables SRP, not Feedback's current `USER_AUTH`/email-OTP flow. HARVEST's API validates access tokens against that web client's ID, so a new Feedback app client would also require an approved HARVEST staging backend change.
- Sahil selected `sahil+admin@withmeridian.ai` for the first Feedback admin test. Charan has been asked to add it to HARVEST staging as an Operator. Until it exists there and its live Operator membership is verified, it must not receive Feedback admin access. The existing `sahil@withmeridian.ai` HARVEST account is tied to Company testing and must not be treated as a Feedback admin.
- HARVEST resolves a signed-in person and live company, partner, or operator memberships from its database. `GET /api/me` returns `{ person, memberships }`, including each organization's ID, kind, name, and role.
- Feedback currently creates its own Cognito pool and identity pool. Its AppSync rules require an `admins` Cognito group, and report creation requires Cognito `custom:persona` and `custom:company`. Pointing the frontend at HARVEST's pool alone would break sign-in and report submission and could misclassify users.
- HARVEST staging API responds normally, but its browser CORS settings do not currently allow the Feedback local origin. A server-side integration or an approved CORS change is needed before Feedback can read `/api/me` in a browser.

## Implementation order

1. For the initial staging integration, use HARVEST's existing staging web app client with password SRP. A separate Feedback app client can be added later if the HARVEST staging API is updated to accept its client ID. Do not edit the production pool.
2. Read HARVEST membership from a trusted backend path. Validate the Cognito token, resolve live memberships, and reject users with no active HARVEST person or membership. Use the same server-side decision for ticket authorization and trusted reporter fields; a frontend-only role check is insufficient.
3. Map company and partner memberships to the client workspace. **Only selected operators are Feedback admins**, per Sahil's decision; an operator membership alone must never grant admin access. Maintain a Feedback-specific server-side admin assignment and check that the user still has an active HARVEST operator membership. Users with several memberships must select the organization for a report; never silently choose one.
4. Connect Feedback `dev` first. Keep its own AppSync, DynamoDB table, S3 bucket, and notification records. Back up existing reports and handle ownership changes from Feedback's old Cognito subjects before switching the pool. Verify a client cannot read another client's report or edit admin fields through the API.
5. Repeat with Feedback `test`, using its separate data and storage but the same HARVEST staging pool. Check company, partner, operator/admin, multi-organization, removed-membership, password-reset, upload, notification, and sign-out cases.
6. Prepare production configuration separately. Do not point any branch at HARVEST production Cognito or deploy to Feedback `main` until approved.

## Open coordination

- Record selected Feedback admins by stable HARVEST user ID and agree who maintains that assignment. The first requested account is `sahil+admin@withmeridian.ai`, pending Charan's HARVEST staging account setup. A removed HARVEST operator membership must revoke Feedback admin access.
- The `harvestViewer` resolver forwards the caller's Cognito access token from the GraphQL Authorization header to HARVEST's `/api/me`; the token is not sent as a GraphQL argument. The report mutation uses the same live membership check and derives reporter fields on the server. Admin model operations still rely on Cognito group membership. Review AppSync request logging so bearer tokens are never recorded.
- Confirm the Feedback dev/test URLs, app client callback settings if needed, and which team owns the staging Cognito app client. These are configuration changes only in staging.

The current Feedback sandbox and its users remain usable while the integration is built. `HARVEST_STAGING_USER_POOL_ID`, `HARVEST_STAGING_APP_CLIENT_ID`, and `HARVEST_API_BASE_URL` are backend build settings for dev/test only. The browser additionally needs `VITE_HARVEST_AUTH_MODE=staging`, `VITE_COGNITO_USER_POOL_ID`, and `VITE_COGNITO_USER_POOL_CLIENT_ID`. Enable them together after the backend deploys; a partial configuration fails closed. The frontend then keeps Feedback's own Data and Storage endpoints while signing in through HARVEST staging.

The staging report mutation now verifies the access token and selected organization through HARVEST's live `/api/me` response. Admin model authorization still uses the dedicated `feedback-admins` Cognito group. Charan must agree how an Operator losing HARVEST membership is promptly removed from that group; otherwise an already issued group token could retain direct AppSync admin access until it expires. The existing Feedback report owners also need a reviewed mapping to HARVEST subjects before those users can see their historical reports. Do not approve production until that revocation path, migration, and direct API authorization tests are complete.
