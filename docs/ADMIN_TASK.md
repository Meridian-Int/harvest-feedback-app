# Admin task (owner: Sahil)

Read `AGENTS.md`, then `docs/design/handoff/DESIGN_SPEC.md`. Open `docs/design/handoff/source/Harvest Feedback.html` in a browser and sign in as `admin@example.com` / `123456` to see the target.

## Phase 0: shared foundation (before Manasa starts)

Do this on branch `setup/foundation`, open a pull request into `dev`, merge, then tell Manasa to pull.

1. **Scaffold:** Vite + React 18 + TypeScript (strict) + Tailwind v4 + React Router. Also `.gitignore` (`node_modules`, `.env.local`, `.amplify/`, `amplify_outputs.json`), `.env.example`, and a `README.md` with setup steps.
2. **Amplify backend:**
   - `auth`: passwordless email OTP, `admins` group, custom attributes `persona`, `company`. Self sign-up off.
   - `data`: the `Feedback` model with field-level rules (AGENTS.md §6).
   - `storage`: `feedback-media/{entity_id}/*`.
   - Get `npx ampx sandbox` running.
3. **Styles:** `src/styles/tokens.css` from `docs/design/tokens.css`, plus the theme boot: dark default, `localStorage`, `data-theme` set before first paint.
4. **Testing:** Vitest, React Testing Library, user-event, jest-dom, jsdom and coverage-v8. Add `vitest.config.ts`, `src/test/setup.ts`, `render.tsx`, `factories.ts`, `mockFeedbackApi.ts` and the test scripts, exactly as in `docs/TESTING.md`. Prove it with one passing test.
5. **Lib:**
   - `src/lib/options.ts` (AGENTS.md §7).
   - `src/lib/feedback.ts`: typed calls `createFeedback`, `listMyFeedback`, `listAllFeedback`, `getFeedback`, `requestUpdate`, `adminUpdate`, `uploadAttachment`, `getAttachmentUrl`.
   - `src/lib/format.ts`: display ID, dates, title from the description.
6. **Icons:** extract the prototype's embedded SVG `<symbol>`s into `src/components/icons/`.
7. **Shared components** in `src/components/ui/` (AGENTS.md §8), built to spec §3 geometry, with both themes checked.
8. **Shell and routes:**
   - `AppShell`: rail, top bar, breadcrumb, Sign out, theme toggle.
   - Routes from AGENTS.md §4, with `RequireSignedIn` and `RequireAdmin` guards.
   - Placeholder pages for the client routes, so Manasa just fills them in.
9. **Sign-in:** the two-step email → code screen wired to Cognito (spec "Sign-in and verification").

Ready for Manasa when:
- [ ] A fresh clone runs with `npm install`, `npx ampx sandbox` and `npm run dev`
- [ ] A test client and a test admin can sign in by email code and land on their own side
- [ ] `createFeedback` and `listMyFeedback` work from the browser console or a test page
- [ ] `npm test` passes, covering the Phase 0 tests listed under "Shared" in `docs/TESTING.md`

## Phase 1: Feedback review (`src/features/admin/review/`)

Filter, search, count and paging logic goes in `src/features/admin/logic/`, with tests (`docs/TESTING.md`, Admin).

- Page heading.
- `MetricToggle` × 4: Open, Blockers, Bugs, Improvements. They count all open reports and act as the priority filter.
- Toolbar:
  - Search over title, description, reporter, company and ID.
  - Status, Severity, **Product area**, **Persona** and Owner dropdowns, then Reset.
- List/grid `SegmentedControl` and the report count.
- Rows and cards per spec "Admin Review queue". 6 per page, closed reports last, newest first. Filters reset to page 1. The filter state lives in the URL.
- **Admin detail dialog:**
  - Header: ID and time.
  - Body: title, pills, full progress track, description.
  - **Attachments** section: image or video preview, download, plus the empty and unavailable states.
  - **Footer (our addition):** Status `Select`, Owner `Select`, Save. Saving calls `adminUpdate` (sets `adminActivityAt`), then toasts.
- Live updates via `observeQuery`.

## Phase 2: Product insights (`src/features/admin/insights/`)

With tests for the Errors and Traffic states, using a mocked `sentry-issues` response.

- Page header and the Errors/Traffic segmented switch (`?tab=`).
- **Errors:**
  - The `amplify/functions/sentry-issues/` function (AGENTS.md §10).
  - Metric cards: Issues, Events, Projects.
  - Project filter and issue rows per spec, with severity stripe, sparkline, events/users, and **Make a report** / **View report**.
  - "Make a report" creates a `Feedback` with `sentryIssueId` set.
  - With no Sentry token: the setup message.
- **Traffic:** the Looker Studio iframe in a glass panel (`VITE_LOOKER_EMBED_URL`), or the setup message. No sample charts.
- GA4 tag and Sentry init in `src/main.tsx`.

## Phase 3: environments

Follow `docs/ENVIRONMENTS.md` sections D–G: the Amplify app, the deploy role, GitHub variables, per-branch settings, a test deploy through dev → test → production, and the users.

## Then

Sentry in HARVEST: separate repo, `docs/HARVEST_SENTRY_TASK.md`.

## First prompt for Codex

> Read AGENTS.md, docs/ADMIN_TASK.md and docs/design/handoff/DESIGN_SPEC.md (§1–§8; use the appendices for exact CSS and copy). Do Phase 0 steps 1–5 only (scaffold, backend, styles, testing setup, lib with its tests). Show me the file plan first and wait for my OK.
