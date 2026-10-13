# Laptop demo — HARVEST Feedback

Use `http://localhost:5173` on this laptop. The two repositories stay on Sahil's existing feature branches. No push or frontend publication was made during this demo pass.

## Windows and accounts

- Native Chrome: Company client `manasa+clienta@withmeridian.ai`.
- Codex in-app browser: selected Operator admin `sahil+admin@withmeridian.ai`.
- Partner client: `manasa+clientb@withmeridian.ai`, available through HARVEST's account menu in the Codex browser; switch back to Sahil to restore the admin demo.

Different windows of the same Chrome profile share a session. The separate Chrome and Codex browsers keep the demo client and admin sessions independent. Always enter through HARVEST and use its Feedback sidebar link; it opens another tab on the same localhost origin. No token appears in a URL and there is no separate Feedback login.

Passwords are generated test credentials held in private ignored local files, never in this document or Git. Both new client identities have `user` membership in dedicated `feedback-demo-company` / `feedback-demo-partner` organizations and no Feedback admin assignment. Those demo organizations use scoped agreement bypass; only the demo Company has seeded progress and a `mode=mock` payout fixture. No agreement signature, vendor interaction or real payout occurred.

## Demonstration

1. Company HARVEST → Feedback sidebar → New feedback. Select category/priority, write a description and optionally upload a screenshot or choose Record screen now. Screen recording captures only the selected demo tab, without microphone. Review and attach it before submission.
2. Submit. My reports shows the record and its progress. Other reporters' records are excluded. Request update changes to Update requested while pending.
3. Admin HARVEST → Feedback sidebar → Review queue. A new report produces an in-app toast and unread bell. Open the bell to mark its current entries read. The timed toast appears on the right, below the bell, retaining the five-second green bar.
4. Open the report, preview/download its image or recording, choose status/owner and save. A pending request uses the explicit Send update button. This records the server-owned response event and clears the pending request. The reporter sees the updated status and bell notification.
5. Client email is limited to submission receipt, response to a pending update request, and closure. Routine status/owner changes produce in-app updates without client email. Admins receive new-report and update-request mail. SES remains in sandbox; the verified company domain covers these approved demo recipients. Earlier test mail used the previous policy; new dev events use the current policy.
6. Dev emails now link to this laptop at `http://localhost:5173/feedback/...`. A recipient on another computer cannot use this localhost link. Before publication, restore the approved HTTPS prestaging base URL and test links there.

## Verified scope

Real staging Cognito logins and live `/api/me` memberships; Company, Partner and selected-admin browser landing; report creation/listing; screenshot and screen-recording upload; admin video playback and download; server-owned status/owner edits; update request/response and cleared pending state; bell/read receipts; SES sends and user-confirmed demo inbox receipt; reporter isolation and admin/membership/Cognito revocation. Temporary revocation test changes were restored.

The separate dev backend imports HARVEST's existing staging pool and owns five Feedback tables plus its private media/static buckets. The legacy Feedback sandbox and production were not changed. Reporting and upload tests use the dedicated deployed dev API, not a mock viewer.

Sentry/GA4/Looker insight panels remain labelled samples where unconfigured. Live connector ingestion, corporate sender reply routing and inbox authentication headers are not claimed as verified.

## Start or restart

From `harvest-feedback-integration`: `npm run dev -- --host 127.0.0.1 --port 5174 --strictPort`.

From `harvest-refresh/ui`: `npm run dev -- --mode prestaging --host 127.0.0.1`.

Ignored local settings label this as development while using real staging Cognito and the staging API proxy. `/feedback` is proxied to the Feedback server, preserving one localhost origin. No `.env.*.local`, credentials, tokens or test media belong in Git.

Final validation: 403 tests passed with coverage thresholds met. The live email policy test produced exactly three client receipts and two admin receipts for its labelled report, excluding both routine status changes. Admin recording playback advanced with no media error, and download completed.

## After the laptop demo

Resolve HARVEST feature-branch write access, restore HTTPS email links, refresh the Feedback static package, configure prestaging endpoint/proxy, and publish through the approved PR/CI flow. Retest prestaging before staging. Never use the old laptop deployment script, promotion buttons or production resources for this demo.
