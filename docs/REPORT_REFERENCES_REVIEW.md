# Report references: feedback-side review draft

No resource, API handler, model schema, existing status resolver or display path imports this draft. It is not deployed. Existing real reports still use their UUID and FB display ID. This document and `amplify/functions/report-references/draft.ts` are the concrete local proposal for review.

## Proposed display

`ACME · #042`: immutable organization handle, separator, three-digit reusable number. Links, API operations, attachments, notification receipts and email deduplication continue to use the permanent UUID. Company and Partner organizations both need handles. Company name/location never identify an organization.

Handles are chosen by an authorized organization member, normalized to uppercase, and contain 2–12 letters/digits/single hyphens, starting with a letter. Two permanent conditional records (`ORG#organizationId` and `HANDLE#handle`) are registered in one DynamoDB transaction. This enforces one immutable handle per stable organization and one organization per handle. Records have no TTL and are not deleted when an organization becomes inactive. Repeated exact registration should return the existing registration; a conflicting choice must be rejected, not overwritten.

The present trusted HARVEST actor exposes company name/persona but not organization ID in its result. Wiring must add the selected, membership-verified organization's stable ID. Feedback-pool legacy accounts require an explicit organization mapping; never manufacture it from name, location or email domain. The HARVEST onboarding change is owned by that team and is outside this local feedback-only preparation. No other repository was accessed for this work.

## Atomic lifecycle

Use a separate global slot table for 001–999 (a proposed capacity for approval). A slot is `NUMBER#042`, independent of organization. Do not use a counter or TTL to release numbers.

Creation transacts three operations: condition-check the registered organization handle; reserve the absent global slot with report UUID/org ID; create the report with immutable referenceHandle/referenceNumber/organizationId and its permanent UUID. Existing server profile, priority, category, description and attachment validation must run before this service. Blocker derives Critical internally; do not trust a client-supplied severity. The draft builder is not an authorization handler.

A handler should choose candidates in a shuffled bounded range. Only a slot collision may advance to the next candidate. Organization conflicts, report conflicts, access errors and transport errors must not be treated as pool exhaustion. Retry unknown outcomes with the same operation ID and number; use a DynamoDB ClientRequestToken per attempted transaction and a durable request-to-UUID mapping scoped to the authenticated user. On ambiguous creation, strongly read the same report and verify request ownership/payload before returning it. Never generate a fresh report UUID on a retry after an unknown outcome.

Closing transacts a conditional report status update and deletion of its lease. Both match the expected organization, handle and number; lease deletion additionally requires that its report UUID matches. This prevents a delayed closure from releasing a recycled number that belongs to a newer report. The closed record retains its original handle/number and permanent UUID. Idempotent close retries should read the same report and return its already-closed result, never delete a number belonging to another UUID.

Direct AppSync model status writes must be disabled when this service is enabled; otherwise an admin could bypass atomic release. Use an admin-authorized, live-membership-verified close/status mutation. Non-closure status updates do not release a number. Add read-only optional organizationId/referenceHandle/referenceNumber fields for the migration; clients/admins must not write these fields through model APIs.

If all slots are claimed, fail clearly without creating a report. Reopening needs a new slot and an atomic CLOSED → NEW transition that appends the previous reference to a permanent history list. A distinct reopen handler/transaction and concurrency tests are required before enabling reopening; the local draft does not implement reopening yet.

## History and migration

Reuse intentionally permits duplicate displayed references in historical records. Searches must return distinguishable dated results. A report link must always contain the UUID, never only the handle/number. Admin screens should expose the permanent ID in report details for disambiguation.

Map legacy reports to real organization IDs and agreed handles. Allocate slots to existing active reports atomically during a coordinated migration; closed historical rows need an agreed display policy. Never use a live number without claiming its slot, and never silently rewrite old UUIDs/attachment keys. Back up the shared table and run two-client API/storage isolation checks before migration. No live data or schema was changed for this draft.

## Related email decisions awaiting implementation

Client mail should be limited to submission confirmation, an explicit response to an outstanding update request, and closure. Progress/owner edits alone must not email the client. Add a server response record or respondedToRequestAt plus response text and respond through an admin-authorized mutation; adminActivityAt alone does not prove a response. A combined response/closure sends one closure message. Admin submission/request mail continues.

Submission alerts should include Company/Partner and user-facing priority copy: Blocker — urgent review required; Bug — review required; Improvement — suggested enhancement. Blocker remains Critical internally. Organization/type metadata and optional reference rendering are implemented in the email renderer. Live reference allocation and the restricted recipient/event rules remain pending wiring; the transaction draft does not enable them.

## Verification before enabling

Unit tests cover normalization, reserved-range validation, UUID separation, same-number collision across organizations, and the stale-release guard on generated transactions. They do not simulate or replace live DynamoDB transaction tests. Test simultaneous same-handle registrations; simultaneous submissions for the same number; ambiguous retry/idempotency; close-versus-reuse races; reopening and reference history; pool exhaustion; legacy migration; direct API attempts to overwrite references/status; and original UUID-based attachment/history access.

All work is local. No GitHub access, AWS resources, deployment or email sends are authorized by this draft. Coordinate the shared schema/resolver changes with Sahil before wiring and obtain the user's approval before external actions.
