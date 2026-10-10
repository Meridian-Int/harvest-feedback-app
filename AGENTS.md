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
- Auth exception: the prototype's invitation guidance is superseded by the HARVEST account integration decision. The sign-in card says to use a work email; the app has no invitation flow.
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
| Auth | Current: Cognito email one-time code first, optional password afterward (see §5), `admins` group. Next: use HARVEST users and their existing login credentials; integration design is pending. |
| Data | Amplify Data (AppSync + DynamoDB) |
| Files | Amplify Storage (S3) |
| Hosting | Amplify Hosting, one environment per branch: `dev`, `test`, `main` (production). Builds are started by GitHub Actions (`.github/workflows/deploy.yml`); production needs Vaish's approval. |
| Errors | Sentry `@sentry/react`; an Amplify function reads Sentry issues for the admin side |
| Analytics | GA4 tag; Looker Studio report iframe on the admin side |
| Tests | Vitest, React Testing Library, user-event, jest-dom, v8 coverage. See `docs/TESTING.md` |
| Icons | Copy the SVG symbols embedded in the prototype into React components. Don't swap in an icon library. |

Region: `us-east-2` unless Vaish says otherwise.

## 4. Routes (the prototype has none; these are ours)

| Route | Screen (prototype ID) | Who |
|---|---|---|
| `/sign-in` | `#auth-screen`: email, then code | Signed out |
| `/account/setup` | Legacy link redirects to the signed-in user's workspace | Signed-in users |
| `/feedback/new` | `#view-client`, New feedback | Clients |
| `/feedback/mine` | `#view-mine`, My reports (list/grid) | Clients |
| `/admin/reviews` | `#view-admin`, Feedback review (list/grid) | Admins |
| `/admin/insights?tab=errors\|traffic` | `#view-admin-insights`, Product insights | Admins |

- The report detail is a dialog (`#detail`), opened over the list. Its open state lives in the URL, e.g. `?report=<id>`.
- After sign-in: members of the Cognito `admins` group go to `/admin/reviews`; other signed-in users go to `/feedback/new`. The user never chooses an admin or client role.

## 5. Auth

First sign-in uses a work email and the 8-digit code Cognito sends. After verification, users may create a password for later sign-ins; email-code sign-in remains available.

- In `amplify/auth/resource.ts`, use Amplify Gen 2 email OTP (`loginWith: { email: { otpLogin: true } }`) with Cognito Essentials and support password sign-in after a verified user creates one.
- Self sign-up remains off in the current Cognito setup. Test users are provisioned outside this app; add admins to the `admins` group. HARVEST user and credential integration is the next auth task.
- Custom user attributes, set when the admin creates the user:
  - `custom:persona`: `Company` or `Partner` for new client accounts. Existing `Operator` accounts remain readable so established admins can sign in.
  - `custom:company`: the company name
  - `name`
- The admin assigns `custom:persona` when creating each user. Company, Partner and Operator users do not choose their persona or role in the app. Existing `custom:clientPersona` values, if present, can still be read; no new account-choice attribute is provisioned.
- The prototype's simulated code `123456` and its "Local prototype" notes are **not** shipped.

Error copy from the prototype:
- Invalid email: "Enter a valid work email."
- A wrong code needs a real message, e.g. "That code is not right. Check the latest email and try again."

## 6. Data model

`amplify/data/resource.ts`, model `Feedback`:

| Field | Type | Notes |
|---|---|---|
| `title` | string, required | First line of the description, first 110 characters. Set on create. |
| `description` | string, required | Trimmed, max 3000 characters |
| `productArea` | string, required | One of `PRODUCT_AREAS` (§7) |
| `customArea` | string, optional | Required when `productArea` is "Other"; max 80 characters |
| `priority` | enum `BLOCKER`, `BUG`, `IMPROVEMENT`, required | |
| `severity` | enum `CRITICAL`, `MEDIUM`, `LOW`, required | Separate from priority |
| `reporterName`, `reporterEmail`, `persona`, `company` | string, required | Copied from the signed-in user's attributes on create, never typed |
| `attachmentKey` | string, optional | One file (upload or screen recording) |
| `attachmentName`, `attachmentType`, `attachmentSize` | optional | For the preview, download and "unavailable" states |
| `status` | enum `NEW`, `ASSIGNED`, `IN_PROGRESS`, `CLOSED`, default `NEW` | Admin-write only |
| `assignee` | string, optional | Admin-write only. Don't name it `owner`; Amplify uses `owner`. |
| `updateRequestedAt` | datetime, optional | Set by the reporter's "Request update" |
| `adminActivityAt` | datetime, optional | Set by any admin change; clears the pending request |
| `sentryIssueId` | string, optional | Set when an admin makes a report from a Sentry issue |
| `owner`, `createdAt`, `updatedAt` | managed by Amplify | |

`NotificationRead` stores an owner-authorized receipt for each event a signed-in user has opened in the bell panel. Notification entries are derived from the authorized `Feedback` fields, so a reporter never receives another reporter's events.

Authorization:
- Model level:
  - `allow.owner().to(['create', 'read', 'update'])`
  - `allow.group('admins').to(['create', 'read', 'update'])`
- Field level on `status`, `assignee` and `adminActivityAt`: owner `read`, admins `read` and `update`. A reporter can only touch `updateRequestedAt` after creating a report.
- Check that the field-level rules really block a reporter. Test it through the API.

Display ID: `FB-` plus the last 4 characters of `id`, uppercased. "Request update" is pending while `updateRequestedAt` is later than `adminActivityAt`. It is hidden when the report is `CLOSED`.

Storage, `amplify/storage/resource.ts`:
- Path `feedback-media/{entity_id}/*`.
- The owning identity can read, write and delete. The `admins` group can read.
- **One file per report.** PNG, JPG, WebP, MP4, WebM or MOV, max **50 MiB**, checked in the browser before upload (same as the prototype).

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
- **`SEVERITIES`:** Critical, Medium, Low. Placeholder "Choose severity". Blocker is **not** a severity.
- **`STATUSES`:** New, Assigned, In progress, Done (stored as `CLOSED`).
- **`PERSONAS`:** Company, Partner. Existing Operator accounts and reports remain readable, but Operator is not a new filter choice.
- **`ASSIGNEES`:** the admin list. Prototype values: Unassigned, Manasa, Vaish. Replace with the real admins.
- **`SENTRY_PROJECTS`:** harvest-ui, harvest-api, feedback-app.

## 8. Design system

Tokens go in `src/styles/tokens.css`, copied from `docs/design/tokens.css` (exact values from spec Appendix A).
- Dark is the default. The choice is saved in `localStorage`. `data-theme` sits on `<html>`.
- Use the CSS variables, never Tailwind's default palette.

Key rules from the spec (§3, §5, §6 there):
- **Fonts:**
  - Body: system sans, 13px/1.55.
  - Headings and the brand: Georgia serif, weight 400.
  - Report titles: sans 550.
  - Counts: Arial with tabular numerals.
  - No web fonts.
- **Glass:** panels, rail, top bar, dialogs and the sign-in card use an 18px backdrop blur, the `--surface` fill, a 1px `--line` border and the per-theme shadows in the spec. The body has two radial haze gradients per theme. Admin panels add `--admin-haze`.
- **Pills:** neutral (`--input` fill, `--line` border, `--text`) with a 7px dot:
  - Bug `#b58a59`, Improvement `#8095ab`
  - Blocker, Medium and Low: `--dim`
  - Critical: `--red` dot and text
- **Progress track:** New → Assigned → In progress → Done. Completed steps are a green fill with a check; the current step has a neutral ring.
- **Shell:**
  - Rail 224px with the HARVEST / BY MERIDIAN INTELLIGENCE brand and role navigation. A centered compact icon-and-text Sign out button sits below the profile in the rail footer. The 52px top bar holds the breadcrumb, notification bell and theme toggle. This placement is Sahil's approved change from the prototype.
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
- **Sign-in:** spec "Sign-in and verification", wired to real Cognito email OTP and optional password setup/sign-in (§5).
- **Shell:** rail, top bar, theme toggle, sign out.

### Client (Manasa)
- **New feedback:** spec "Client New feedback", fields in order:
  1. Product area, plus "Name the area" when Other is picked
  2. Priority and Severity side by side
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
  - **Traffic:** embed Google Analytics through **Looker Studio** when configured. With no Looker URL, show labelled presentation sample metrics and charts. Samples never write to AWS.

## 10. Integrations

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
- The Looker iframe uses `VITE_LOOKER_EMBED_URL`, which must be the `/embed/` URL. The report owner turns on File → Embed report and uses owner's data credentials.

## 11. Environment variables

`.env.local` is git-ignored. Commit `.env.example` with these names:
- `VITE_SENTRY_DSN`
- `VITE_GA_MEASUREMENT_ID`
- `VITE_LOOKER_EMBED_URL`

Server-side, per branch in the Amplify console:
- Secret `SENTRY_AUTH_TOKEN`
- `SENTRY_ORG`, `SENTRY_PROJECTS`
- `ADMIN_NOTIFICATION_FROM_EMAIL` (verified SES sender), `APP_BASE_URL` (deployed app URL for email links)

## 12. Done means

- [ ] Email-code sign-in works; admins and clients land on their own side; a client can't open `/admin/*`
- [ ] A HARVEST user signs in with the same credentials as HARVEST, submits a report, and admins see an in-app alert and receive email
- [ ] A client submits with an upload and with a screen recording, then sees the report in My reports with the correct track
- [ ] A client can't read others' reports or change `status`/`assignee`, checked through the API
- [ ] Request update shows as pending, and clears after an admin saves a change
- [ ] An admin filters by product area, priority (metric toggles), persona, severity, status and owner; opens a report; views or downloads the attachment; changes status and owner
- [ ] Errors lists real Sentry issues, or clearly labelled presentation samples when unconfigured; Traffic shows the Looker report, or clearly labelled samples when unconfigured
- [ ] Dark and light match the prototype at 1440, 1024, 768 and 390 px; keyboard focus and dialogs work; reduced motion is respected
- [ ] `npm test` passes with coverage thresholds met; `npm run build` and `tsc --noEmit` pass; no secrets in the repo or the bundle

## 13. Rules for agents

- Plan first: list the files you'll create or change and wait for approval before large changes.
- Every feature ships with tests (`docs/TESTING.md`). Keep logic in plain functions in `src/lib/` or `src/features/<side>/logic/`. Never call AWS from a test; mock `src/lib/feedback.ts`. Only `src/lib/` imports `aws-amplify`.
- Stay in the owner's folders. Ask before changing shared code, the data model or `options.ts`.
- Colours only from tokens, copy only from the spec or this file, options only from `options.ts`.
- Never commit secrets or `.env.local`. Never deploy, delete AWS resources or edit Cognito users unless asked.
- Never push to `test` or `main` directly, and never edit `.github/workflows/` without asking; see `docs/ENVIRONMENTS.md`.
- If the spec, the prototype and this file disagree, say so; don't silently pick one.
