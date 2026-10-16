# AGENTS.md: HARVEST Feedback

Read this whole file before writing code. It is the contract between Sahil (admin side) and Manasa (client side). Each also has a task file: `docs/ADMIN_TASK.md`, `docs/CLIENT_TASK.md`.

## 1. What we are building

An internal Meridian Intelligence app to capture bugs and improvements in HARVEST.
- Clients (company, partner and operator users) submit feedback.
- Admins review it, filter it, see Sentry errors and Google Analytics traffic.

| | |
|---|---|
| Brief | "Feedback Capture App: Intern Build Task", Vaish, 8 Oct 2026 |
| Bar | A full app that looks good. Backend on AWS. |
| Later | PostHog |

**The design is final:** Manasa's prototype in `docs/design/handoff/`.
- `source/Harvest Feedback.html` is the complete working prototype. Open it in a browser and sign in with `company@example.com` (client) or `admin@example.com` (admin), code `123456`.
- `DESIGN_SPEC.md` is the code-derived spec. Its appendices hold the exact CSS (B) and every piece of copy (C).
- **Match the prototype's look and behaviour exactly**, except where §9 says the brief needs something more. Don't reproduce its legacy CSS architecture; rebuild cleanly in React.
- If this file and the spec disagree on visuals, the spec wins. On data, auth or integrations, this file wins.
- Approved HARVEST integration typography override: Feedback uses HARVEST's Inter body font, IBM Plex Sans headings and IBM Plex Mono figures. Preserve the current font packages and CSS when merging other work.
- HARVEST integration supersedes the prototype's invitation and standalone sign-in flow. In the integrated experience, a signed-in HARVEST user opens Feedback without another login. There is no invitation flow.
- Notification addition: the workspace rail has a bell and unread count. Admins are notified about new client reports and update requests; clients see admin changes to their reports. Opening the panel marks its current entries read. New events show a five-second toast with a progress bar.

## 2. Who owns what

| Area | Owner | Folder |
|---|---|---|
| Phase 0, the shared foundation: scaffold, Amplify backend, tokens, shell, shared components, auth, routes | Sahil, before the split | `amplify/`, `src/app/`, `src/components/`, `src/styles/`, `src/lib/` |
| Client side: New feedback, My reports, the client detail dialog, screen recording | Manasa | `src/features/client/` |
| Admin side: Feedback review, admin detail dialog, Product insights (Errors, Traffic) | Sahil | `src/features/admin/` |
| Sentry inside HARVEST | Sahil, separate repo | `docs/HARVEST_SENTRY_TASK.md` |

- Work only in your own `features/` folder.
- Shared folders (`amplify/`, `src/components/`, `src/styles/`, `src/lib/`) change only by agreement, small and merged first.
- Branches, environments and merging: `docs/ENVIRONMENTS.md`.

## 3. Stack

| Concern | Choice |
|---|---|
| Front end | React 18, Vite, TypeScript (strict), Tailwind CSS v4, React Router |
| Backend | AWS Amplify Gen 2, code-first, in `amplify/` |
| Auth | Current standalone app: its own Cognito email code and optional password flow. Target integration: reuse HARVEST's existing Cognito pool **and active HARVEST session**, with no separate Feedback login or user pool (§5). |
| Data | Amplify Data (AppSync + DynamoDB) |
| Files | Amplify Storage (S3) |
| Hosting | Integrated Feedback opens on HARVEST's existing domain at `/feedback`, in a new tab; no separate public Feedback URL is needed. Feedback backend resources may remain separately deployed. Follow the environment boundaries in §10 and `docs/ENVIRONMENTS.md`. |
| Errors | Sentry `@sentry/react`; an Amplify function reads Sentry issues for the admin side |
| Analytics | GA4 tag; integrated admin Traffic can read HARVEST GA4 through the guarded Feedback backend. The Looker Studio iframe remains optional. |
| Tests | Vitest, React Testing Library, user-event, jest-dom, v8 coverage. See `docs/TESTING.md` |
| Icons | Copy the SVG symbols embedded in the prototype into React components. Don't swap in an icon library. |

Region: `us-east-2` unless Vaish says otherwise.

## 4. Routes (the prototype has none; these are ours)

The approved entry point is Feedback in each HARVEST role sidebar (admin, company and partner). It opens `/feedback` in a new tab on the same HARVEST domain. Keep integrated Feedback routes under `/feedback` so they do not conflict with HARVEST routes. The existing standalone paths below describe the transitional app.

| Route | Screen (prototype ID) | Who |
|---|---|---|
| `/sign-in` | `#auth-screen`: email, then code | Signed out |
| `/account/setup` | Legacy link redirects to the signed-in user's workspace | Signed-in users |
| `/feedback/new` | `#view-client`, New feedback | Clients |
| `/feedback/mine` | `#view-mine`, My reports (list/grid) | Clients |
| `/admin/reviews` | `#view-admin`, Feedback review (list/grid) | Admins |
| `/admin/insights?tab=errors\|traffic` | `#view-admin-insights`, Product insights | Admins |

- The report detail is a dialog (`#detail`), opened over the list. Its open state lives in the URL, e.g. `?report=<id>`.
- In the integrated flow, use HARVEST's restored session and authoritative membership/role data to send admins to review and clients to new feedback. The user never chooses an admin or client role. A HARVEST user without feedback access must be denied by the backend as well as the UI.

## 5. Auth

**Target integrated flow:** HARVEST users sign in to HARVEST as usual. Its Feedback button opens `/feedback` on the same domain in a new tab. The new page restores the existing HARVEST session; it must not ask the user to sign in again, provision a second Feedback Cognito pool, or pass tokens in the URL. Reusing the same pool alone does not prove that the active session works on a new page; test the complete browser flow.

- Keep the HARVEST and Feedback repositories separate, while making the Feedback UI available at HARVEST's protected `/feedback` route. Choose and document the module/build boundary during implementation.
- The Feedback API and attachment access must accept the HARVEST identity and enforce access server-side. Derive admin, Company, Partner and existing Operator access from HARVEST's authoritative membership data; do not assume the current Feedback `admins` group or custom persona/company attributes exist in HARVEST's pool.
- Derive reporter identity, company and persona from trusted HARVEST data, never editable form fields. Define behavior for multiple memberships and revoked access before enabling report writes.
- Preserve isolation between reporters, admin-only status/owner changes, and attachment ownership. Test these rules through the API, including direct route access and a revoked user.
- The current standalone email-code/password implementation is transitional. Its old provisioning instructions, `custom:persona` fields and sign-in copy are not requirements for the integrated flow. Do not change HARVEST Cognito users or pool configuration without an explicit task and approval.
- The prototype's simulated code `123456` and its "Local prototype" notes are **not** shipped.

## 6. Data model

`amplify/data/resource.ts`, model `Feedback`:

| Field | Type | Notes |
|---|---|---|
| `title` | string, required | First line of the description, first 110 characters. Set on create. |
| `description` | string, required | Trimmed, max 3000 characters |
| `productArea` | string, required | One of `PRODUCT_AREAS` (§7) |
| `customArea` | string, optional | Required when `productArea` is "Other"; max 80 characters |
| `priority` | enum `BLOCKER`, `BUG`, `IMPROVEMENT`, required | |
| `severity` | enum `CRITICAL`, `MEDIUM`, `LOW`, required | Client submission derives it from priority: Blocker → Critical, Bug → Medium, Improvement → Low. Existing records retain their stored severity. |
| `reporterName`, `reporterEmail`, `persona`, `company` | string, required | Derived from trusted HARVEST identity and membership data on create, never typed |
| `attachmentKey` | string, optional | The first file (upload or screen recording); mirrors `attachments[0]` so older clients keep working |
| `attachmentName`, `attachmentType`, `attachmentSize` | optional | For the preview, download and "unavailable" states |
| `attachments` | list, optional | Every file on the report (`attachmentKey`, `attachmentName`, `attachmentType`, `attachmentSize`), up to `MAX_ATTACHMENTS` (5). JSON text in the standalone Amplify model; a typed list in the integrated API. Reports created before this field show their single legacy file. |
| `status` | enum `NEW`, `ASSIGNED`, `IN_PROGRESS`, `CLOSED`, default `NEW` | Admin-write only |
| `assignee` | string, optional | Admin-write only. New reports default to Admin; an admin may later choose Unassigned or another owner. Don't name it `owner`; Amplify uses `owner`. |
| `updateRequestedAt` | datetime, optional | Set by the reporter's "Request update" |
| `adminActivityAt` | datetime, optional | Set by any admin change; clears the pending request |
| `sentryIssueId` | string, optional | Set when an admin makes a report from a Sentry issue |
| `owner`, `createdAt`, `updatedAt` | managed by Amplify | |

`NotificationRead` stores an owner-authorized receipt for each event a signed-in user has opened in the bell panel. Notification entries are derived from the authorized `Feedback` fields, so a reporter never receives another reporter's events.

Authorization:
- The current rules below describe the standalone Cognito setup. Rework them for HARVEST identities and membership-derived roles before enabling integrated writes; frontend checks alone are insufficient.
- Model level:
  - `allow.owner().to(['create', 'read', 'update'])`
  - `allow.group('admins').to(['create', 'read', 'update'])`
- Field level on `status`, `assignee` and `adminActivityAt`: owner `read`, admins `read` and `update`. A reporter can only touch `updateRequestedAt` after creating a report.
- Check that the field-level rules really block a reporter. Test it through the API.

Display ID: `FB-` plus the last 4 characters of `id`, uppercased. "Request update" is pending while `updateRequestedAt` is later than `adminActivityAt`. It is hidden when the report is `CLOSED`.

Storage, `amplify/storage/resource.ts`:
- Feedback uses its own S3 bucket and DynamoDB tables, separate from HARVEST's unrelated files and data. Verify the dedicated bucket's permissions with HARVEST identities.
- Path `feedback-media/{entity_id}/*`.
- The verified reporter can read, write and delete their own file; verified Feedback admins can read it. Recheck this with HARVEST identities rather than assuming the current `admins` group and identity IDs match.
- **Up to 5 files per report** (uploads and screen recordings together). PNG, JPG, WebP, MP4, WebM or MOV, max **50 MiB** each, checked in the browser before upload and again on the server. Every file is claimed in the same transaction as the report.

Not in v1, matching the prototype: comments, activity timeline, persona or reporter selectors on the form, title field, expected/steps fields. The form's "Email updates included · demo only" line is **removed**. The later demo decision adds admin email alerts for new reports; it does not promise client update emails.

## 7. Options (`src/lib/options.ts`; both sides import it, exact text from the prototype)

- **`PRODUCT_AREAS`**, in this order:
  1. Onboarding
  2. Data room
  3. Payment — payout account setup
  4. Partner portfolio
  5. Operations console
  6. Other — add an area
- **`PRIORITIES`:** Blocker, Bug, Improvement. Placeholder "Choose a priority".
- **`SEVERITIES`:** Critical, Medium, Low. Used by admin filters and stored reports; clients no longer select severity separately.
- **`STATUSES`:** New, Assigned, In progress, Done (stored as `CLOSED`).
- **`PERSONAS`:** Company, Partner. Existing Operator accounts and reports remain readable, but Operator is not a new filter choice.
- **`ASSIGNEES`:** the admin list. Prototype values: Unassigned, Manasa, Vaish. New reports default to Admin (`admin@example.com` in the development adapter); replace with the real admins when HARVEST users are connected.
- **`SENTRY_PROJECTS`:** harvest-ui, harvest-api, feedback-app.

## 8. Design system

Tokens go in `src/styles/tokens.css`, copied from `docs/design/tokens.css` (exact values from spec Appendix A).
- Dark is the default. The choice is saved in `localStorage`. `data-theme` sits on `<html>`.
- Use the CSS variables, never Tailwind's default palette.

Key rules from the spec (§3, §5, §6 there):
- **Fonts:**
  - HARVEST typography overrides the prototype: body and controls use self-hosted Inter Variable at 14px/20px and weight 425.
  - Headings use IBM Plex Sans Variable at weight 400; the HARVEST Feedback brand uses Inter Variable.
  - Report titles use Inter Variable at weight 550; figures use IBM Plex Mono with tabular numerals.
  - Keep the existing `@fontsource` packages and font imports. Do not restore the prototype's Georgia/system font stack.
- **HARVEST platform alignment (Oct 2026):** the visual layer uses the values of HARVEST's own design system (`ui/src/styles/globals.css` and `ui/src/components/ui` in the HARVEST repo: Align UI token names with Geist values). That means a warm off-white light theme and a near-black dark theme, a monochrome primary (near-black in light, near-white in dark), Align UI's success/warning/error/information colours, 8px controls, 12px drop zones, 16px cards, flat surfaces with a hairline ring, stroke status badges with a coloured dot, and a monochrome focus ring. HARVEST's terracotta is the brand colour only (favicon), not a UI accent. Where the Glass, Pills and Progress track notes below differ, this alignment wins; fonts are unchanged and already match HARVEST.
- **Glass:** panels, rail, top bar, dialogs and the sign-in card use an 18px backdrop blur, the `--surface` fill, a 1px `--line` border and the per-theme shadows in the spec. The body has two radial haze gradients per theme. Admin panels add `--admin-haze`.
- **Pills:** neutral (`--input` fill, `--line` border, `--text`) with a 7px dot:
  - Bug `#b58a59`, Improvement `#8095ab`
  - Blocker, Medium and Low: `--dim`
  - Critical: `--red` dot and text
- **Progress track:** New → Assigned → In progress → Done, as HARVEST's horizontal stepper: chevrons between steps, completed steps a green fill with a check, the current step the primary colour with its number. Grid cards use HARVEST's dot stepper (four 8px dots) with a status badge; phone-width dialogs stack the steps one per row.
- **Shell:**
  - Rail 224px with the HARVEST / BY MERIDIAN INTELLIGENCE brand and role navigation. A centered compact icon-and-text Sign out button sits below the profile in the rail footer for the standalone app. The 52px top bar holds the breadcrumb, notification bell and theme toggle. In the integrated page, sign-out must follow HARVEST's session behavior. This placement is Sahil's approved change from the prototype.
  - Content max 1400px.
  - On report pages only the list scrolls.
  - Breakpoints 1150 / 1100 / 900 / 800 / 700 px as in the spec.
- **Remove:** the "PROTOTYPE" badge and the "Local prototype" notes.

**Shared components** (`src/components/ui/`, Phase 0):
- `Panel`, `Button` (default / primary / quiet)
- `IconButton`, `TextButton`
- `Input`, `Select`, `Textarea`, `Field`
- `Pill` (priority / severity dot), `Tag`
- `SegmentedControl`, `MetricToggle`
- `ProgressTrack` (full and compact)
- `Pagination` (6 per page), `Dialog` (native `<dialog>`), `Toast`
- `EmptyState`, `ThemeToggle`, `DropZone`

Build each one to the geometry in spec §3.

## 9. Screens

### Shared (Sahil, Phase 0)
- **Auth:** restore the HARVEST session in the integrated page; use the existing sign-in screen only for the transitional standalone app (§5).
- **Shell:** rail, top bar and theme toggle; coordinate sign-out with HARVEST in the integrated flow.

### Client (Manasa)
- **New feedback:** spec "Client New feedback", fields in order:
  1. Product area, plus "Name the area" when Other is picked
  2. Priority; derive Severity for the required backend field (Blocker → Critical, Bug → Medium, Improvement → Low)
  3. Duplicate notice (see below)
  4. Description with a counter
  5. Drop zone with preview
  6. "Record screen now"
  7. Footer with Submit feedback
- Draft autosave to `localStorage`, with the header status text. A toast on success.
- **Screen recording dialog:** spec "Screen recording modal": `getDisplayMedia`, screen only, 15 fps, ~1.8 Mbps, auto-stop at 180 s or 48 MiB, result ≤ 50 MiB. Attached only on "Attach recording".
- **Duplicate notice:** the prototype rules (≥3 significant words, ≥3 shared, score ≥0.4, same area, max 3). In v1 it checks **the reporter's own reports**, since others aren't readable. Its helper must not promise comments.
- **My reports:**
  - Heading, list/grid toggle, Status filter, the "Newest reports first" legend.
  - Rows and cards per spec, with the compact progress track and a Request update button.
  - 6 per page, closed reports last.
  - The client detail dialog: title, pills, full track, description.
  - **Sort by `createdAt` descending for real**; the prototype doesn't.

### Admin (Sahil)
- **Feedback review:**
  - Heading.
  - Four metric toggles: Open, Blockers, Bugs, Improvements. They count all open reports.
  - Toolbar: search (title, description, reporter, company, ID), Status, Severity, Owner, Reset.
  - List/grid toggle, pagination at 6 per page.
  - Admin detail dialog with the attachment preview (image or video, plus download) and the empty or unavailable states.
  - A new report shows an in-app alert to signed-in admins.
- **Required by the brief, missing from the prototype.** Add these in the same style:
  1. **Product area** and **Persona** dropdowns in the toolbar, next to Severity.
  2. A **status and owner control** in the admin detail dialog footer: Status `Select`, Owner `Select`, Save. Saving sets `adminActivityAt` and toasts.
- **Product insights:** title, Errors/Traffic segmented switch, the three metric cards.
  - **Errors:** live Sentry issues from the `sentry-issues` function; the project filter; "Make a report" / "View report", which creates a report with `sentryIssueId`. When Sentry is unconfigured, show labelled presentation samples with report creation disabled.
  - **Traffic:** in the integrated app, read HARVEST's existing GA4 property through the admin-guarded Feedback backend when configured. The optional Looker Studio iframe remains available. Without a live connection, show labelled presentation sample metrics and charts. Samples never write to AWS.

## 10. Integrations

**HARVEST application**
- Keep the HARVEST and Feedback repositories separate. HARVEST provides the button, protected same-domain `/feedback` route and current session. Feedback provides its screens and separately owned report backend.
- HARVEST prestaging is served from its `main` branch and currently shares the staging API/backend. Implement on a feature branch and use the prestaging review/deployment flow first, then verify staging. Do not push directly to HARVEST `main` or `production`, and do not touch production resources.
- A local route preview with a mock `/api/me` response proves layout only. Before calling the integration working, test a real HARVEST sign-in, new-tab session restoration, role mapping, report creation, API authorization and attachment access in non-production.
- Verify which analytics integrations receive live events. Code or environment configuration alone does not prove Sentry, GA4 or Looker is live; keep presentation samples clearly labelled until each integration is checked.

**Sentry (this app)**
- `@sentry/react` in `src/main.tsx`; DSN from `VITE_SENTRY_DSN`, with `environment` set to the branch name. Skip init when there is no DSN.
- Set the Sentry user to `{ id }` only.

**`sentry-issues` function** (`amplify/functions/sentry-issues/`)
- Calls `GET https://sentry.io/api/0/projects/{org}/{project}/issues/?query=is:unresolved` for each project in `SENTRY_PROJECTS`.
- Returns `{ id, title, culprit, project, level, count, userCount, lastSeen, permalink, trend[] }`.
- Exposed as a custom query with `allow.group('admins')`.
- Token from `secret('SENTRY_AUTH_TOKEN')`. Returns `{ configured: false }` when the token isn't set.

**GA4 and Looker**
- GA4 tag via `VITE_GA_MEASUREMENT_ID`, with page views on route change. Never send emails or feedback text.
- The integrated admin Traffic query uses HARVEST's existing non-production GA4 service-account secret and numeric prestaging property ID, with a read grant limited to the Feedback resolver. Clients cannot request the data. The original Looker iframe remains optional; its `VITE_LOOKER_EMBED_URL` must be a `/embed/` URL.

## 11. Environment variables

`.env.local` is git-ignored. Commit `.env.example` with these names:
- `VITE_SENTRY_DSN`
- `VITE_GA_MEASUREMENT_ID`
- `VITE_LOOKER_EMBED_URL`

Server-side, per branch in the Amplify console:
- Secret `SENTRY_AUTH_TOKEN`
- `SENTRY_ORG`, `SENTRY_PROJECTS`
- `ADMIN_NOTIFICATION_FROM_EMAIL` (verified SES sender), `APP_BASE_URL` (the HARVEST `/feedback` URL in the integrated deployment, for email links)

## 12. Done means

- [ ] A signed-in HARVEST user opens Feedback from the HARVEST button in a new tab on the same domain, with the existing session and no second login; admins and clients land on their own side
- [ ] A direct request without a valid HARVEST session is denied; a client cannot access integrated admin routes or admin API operations
- [ ] A HARVEST user submits a report; admins see an in-app alert and receive email
- [ ] A client submits with an upload and with a screen recording, then sees the report in My reports with the correct track
- [ ] A client can't read others' reports or change `status`/`assignee`, checked through the API
- [ ] Request update shows as pending, and clears after an admin saves a change
- [ ] An admin filters by product area, priority (metric toggles), persona, severity, status and owner; opens a report; views or downloads the attachment; changes status and owner
- [ ] Errors lists real Sentry issues, or clearly labelled presentation samples when unconfigured; Traffic shows live HARVEST GA4 data or clearly labelled samples when unconfigured
- [ ] Live Sentry, GA4 and Looker status is verified in non-production; configured-looking values and sample charts are not counted as proof of ingestion
- [ ] The combined HARVEST and Feedback flow passes in prestaging before staging, including real session restoration, permissions and uploads; production remains untouched
- [ ] Dark and light match the prototype at 1440, 1024, 768 and 390 px; keyboard focus and dialogs work; reduced motion is respected
- [ ] `npm test` passes with coverage thresholds met; `npm run build` and `tsc --noEmit` pass; no secrets in the repo or the bundle

## 13. Rules for agents

- Plan first: list the files you'll create or change and wait for approval before large changes.
- Every feature ships with tests (`docs/TESTING.md`). Keep logic in plain functions in `src/lib/` or `src/features/<side>/logic/`. Never call AWS from a test; mock `src/lib/feedback.ts`. Only `src/lib/` imports `aws-amplify`.
- Stay in the owner's folders. Ask before changing shared code, the data model or `options.ts`.
- Colours only from tokens, copy only from the spec or this file, options only from `options.ts`.
- Never commit secrets or `.env.local`. Never deploy, delete AWS resources or edit Cognito users unless asked.
- Never push to `main` directly, and never edit `.github/workflows/` without asking; see `docs/ENVIRONMENTS.md`.
- If the spec, the prototype and this file disagree, say so; don't silently pick one.
