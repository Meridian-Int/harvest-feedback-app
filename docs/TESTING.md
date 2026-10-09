# Testing

Unit and component tests run on every pull request (`.github/workflows/checks.yml`). A PR can't merge if a test fails or coverage drops below the thresholds.

## Tools

| Tool | Job |
|---|---|
| **Vitest** | Test runner; same config as Vite, fast, watch mode |
| **@testing-library/react** + **@testing-library/user-event** | Render components and act like a user: click, type, select |
| **@testing-library/jest-dom** | Readable assertions: `toBeInTheDocument`, `toBeDisabled`, … |
| **jsdom** | Browser-like environment for component tests |
| **@vitest/coverage-v8** | Coverage report and thresholds |

No other test libraries without agreement. Not in v1: end-to-end tests (Playwright) and tests against a live AWS backend.

## Scripts (`package.json`)

```json
"test": "vitest run",
"test:watch": "vitest",
"test:coverage": "vitest run --coverage"
```

## Config (Phase 0, Sahil)

`vitest.config.ts`:

```ts
import { defineConfig, mergeConfig } from 'vitest/config';
import viteConfig from './vite.config';

export default mergeConfig(viteConfig, defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    css: false,
    restoreMocks: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/**/*.test.{ts,tsx}', 'src/test/**', 'src/main.tsx', 'src/**/*.d.ts', 'amplify/**'],
      thresholds: {
        'src/lib/**': { lines: 80, functions: 80, branches: 70 },
        'src/features/**/logic/**': { lines: 80, functions: 80, branches: 70 },
      },
    },
  },
}));
```

Add `"types": ["vitest/globals", "@testing-library/jest-dom"]` to the app's tsconfig.

`src/test/setup.ts`:
- Import `@testing-library/jest-dom/vitest`.
- Clear `localStorage` and `sessionStorage` after each test.
- Stub what jsdom lacks:
  - `window.matchMedia`
  - `HTMLDialogElement.prototype.showModal` and `close`
  - `URL.createObjectURL`
  - `navigator.mediaDevices.getDisplayMedia` (rejects by default; a test overrides it when needed)
  - `MediaRecorder` (a minimal fake)

`src/test/` also holds:
- **`render.tsx`:** `renderWithProviders(ui, { route, theme, user })`. It wraps the router (`MemoryRouter`), theme and auth context, and returns `user` from `userEvent.setup()`.
- **`factories.ts`:** `makeFeedback(overrides)`, `makeClientUser()`, `makeAdminUser()`, `makeSentryIssue()`. Realistic defaults taken from the prototype's sample data.
- **`mockFeedbackApi.ts`:** typed `vi.fn()` versions of every function in `src/lib/feedback.ts`.

## The one rule that keeps tests easy

**Logic lives in plain functions, not inside components.** Put it in `src/lib/` (shared) or `src/features/<side>/logic/` (one side). Components call those functions and stay thin. Then most tests are simple input → output checks with no rendering.

**Never call AWS from a test.** Mock `src/lib/feedback.ts` (and auth helpers) with `vi.mock`. Components never import `aws-amplify` directly; only `src/lib/` does.

Test files sit next to the code: `format.ts` → `format.test.ts`, `NewFeedbackPage.tsx` → `NewFeedbackPage.test.tsx`.

## What to test

### Shared (Sahil, Phase 0)
- **`lib/format`:**
  - display ID `FB-XXXX`
  - title = first line, max 110 characters, trimmed
  - date formatting
- **`lib/options`:**
  - the lists match the spec exactly (snapshot the arrays)
  - Blocker is not a severity
- **`lib/status`:**
  - the progress step for each status
  - `isUpdatePending(report)`: requested after admin activity → true; admin acted later → false; closed → false
- **`lib/list`:**
  - sort newest first, with closed after open
  - pages of 6
  - an out-of-range page clamps
  - zero results give "0 reports" and page 1 of 1
- **Theme:**
  - dark by default
  - the saved choice wins
  - the toggle flips `data-theme` and saves it
- **Components:**
  - `Pill` shows the right dot per value; Critical uses red text
  - `ProgressTrack` marks done, current and future, with `aria-current="step"`
  - `Pagination` disables Previous and Next at the edges
  - `Dialog` closes on Done and on Escape
  - `SegmentedControl` sets `aria-pressed`
- **Guards:**
  - signed out → `/sign-in`
  - a client on `/admin/*` → redirected
  - an admin lands on `/admin/reviews`
- **Sign-in:**
  - an invalid email shows "Enter a valid work email."
  - the code must be 6 digits
  - a wrong code shows the error inside the card

### Client (Manasa), in `src/features/client/logic/` plus pages
- **Validation:**
  - each missing field produces the spec's combined "Please …" message, and focus goes to the first missing field
  - "Other" requires a name of ≤ 80 characters
  - the description limit is 3000
- **File check:** PNG, JPG, WebP, MP4, WebM and MOV are accepted; anything else is refused; anything over 50 MiB is refused, with the spec's messages.
- **Duplicate finder:**
  - fewer than 3 significant words → none
  - fewer than 3 shared words or a score under 0.4 → none
  - a different area → none
  - at most 3 results
- **Draft:** it saves as you type, restores on reload, clears on submit, and never saves the file.
- **Recorder logic:**
  - stops at 180 s or 48 MiB
  - refuses a result over 50 MiB
  - attaches only on "Attach recording"
- **New feedback page** (mocked API):
  - fill everything, attach a file, then submit
  - `uploadAttachment` runs, then `createFeedback`, with the right fields
  - the button is disabled while saving
  - the form clears and the toast appears
  - an API error keeps the user's input
- **My reports page:**
  - shows only what the API returns, newest first, closed last
  - list/grid keeps the page
  - the status filter goes back to page 1
  - Request update calls `requestUpdate` and shows the pending state
  - closed reports have no button
  - the empty state appears

### Admin (Sahil), in `src/features/admin/logic/` plus pages
- **Filter and search:**
  - search matches title, description, reporter, company and ID, ignoring case
  - each dropdown filters: status, severity, product area, persona, owner
  - "Unassigned" means no assignee
  - Reset clears everything
  - a filter change goes back to page 1
- **Metric counts:** count all open reports regardless of the current search; clicking one filters by priority.
- **Review page** (mocked API):
  - renders the rows, opens the dialog
  - the attachment preview has image, video, none and unavailable states
  - Save calls `adminUpdate` with the status, assignee and `adminActivityAt`, then toasts
- **Insights:**
  - Errors shows the issues from the mocked `sentry-issues` response
  - the project filter changes the metrics
  - `{ configured: false }` shows the setup message
  - "Make a report" calls `createFeedback` with `sentryIssueId`
  - Traffic shows the iframe with the URL, or the setup message without it

## Not covered by unit tests (check by hand before each test → main release)

- **Authorization in AWS:** signed in as a client, try to read another client's report and to change `status`. Both must fail. Do it in the dev environment.
- Real email-code sign-in, real uploads, the real screen-recording picker, the live Sentry and Looker embeds.
- How it looks in both themes at 1440, 1024, 768 and 390 px.

## Writing tests with Codex

Ask for tests in the same prompt as the feature, e.g. "build X with tests per docs/TESTING.md". A feature PR without tests for its logic and its page is not done.
