# HARVEST Feedback

Phase 0 frontend foundation for Meridian Intelligence. React 18, Vite, strict TypeScript,
React Router and Tailwind CSS v4. Design reference: `docs/design/handoff/DESIGN_SPEC.md`.

## Run locally

Use Node.js 22.12 or later (CI uses Node 22).

```sh
npm install
npm run dev
```

Open the URL printed by Vite. No AWS credentials, Amplify sandbox or environment variables
are required. Optional integration variable names are in `.env.example`; they are reserved
for later phases. Phase 0 does not initialize Sentry or GA4.

## Development sign-in

**Development only: authentication is simulated. No email is sent.** Enter any valid email,
then code `123456`. Only `admin@example.com` is an administrator; all other emails are clients,
including `operator@example.com`. `company@example.com` is the standard client example.
The mock session is stored in sessionStorage and survives reloads in the current tab.
Replace `src/lib/auth.ts` with Cognito before production use.

After sign-in, clients land at `/feedback/new` and admins at `/admin/reviews`. The shell,
sign-in and shared components are complete. Client form/list and admin review/insights
pages are explicitly marked placeholders for the feature phases.

## Mock API contract

Import API operations from `src/lib/feedback.ts`; components never import a backend SDK.
All functions are asynchronous and use the backend-independent types in `src/lib/types.ts`.

| Function | Return type |
|---|---|
| `createFeedback(input: CreateFeedbackInput)` | `Promise<Feedback>` |
| `listMyFeedback()` | `Promise<Feedback[]>` |
| `listAllFeedback()` | `Promise<Feedback[]>` |
| `getFeedback(id: string)` | `Promise<Feedback \| null>` |
| `requestUpdate(id: string)` | `Promise<Feedback>` |
| `adminUpdate(id: string, input: AdminUpdateInput)` | `Promise<Feedback>` |
| `uploadAttachment(file: File)` | `Promise<Attachment>` |
| `getAttachmentUrl(key: string)` | `Promise<string>` |

Upload first and spread the returned attachment metadata into the create input. Title,
reporter identity, NEW status, ownership and timestamps come from the adapter. Admin saves
set `adminActivityAt` automatically. The caller must revoke the object URL returned by
`getAttachmentUrl` when its preview/download is finished. Missing sample media rejects
with `Attachment unavailable.` so feature pages can render the unavailable state.

Reports persist under `harvest-feedback-mock-v1` in localStorage. File blobs live in IndexedDB
database `harvest-feedback-mock-media`, store `files`. This is browser-local development data,
not secure authorization: clients can edit browser storage themselves. Adapter checks model
the intended owner/admin behavior; real AWS authorization still needs API verification later.

The seven original sample reports are seeded once. Five personalized prototype examples
are seeded once per client identity on the first API call. Legacy `Agreements` and `Payments`
areas use Other/customArea, legacy statuses/severities use the current enums, and sample
assignment values use the single mock administrator. Descriptions retain the original title
as their first line. Seed filenames have no fabricated attachment blobs. To reset, remove
the localStorage key and the IndexedDB database in browser developer tools.

For a browser-console smoke check while signed in:

```js
const api = await import('/src/lib/feedback.ts');
const report = await api.createFeedback({
  description: 'QuickBooks connection stops at authorization\nThe window stays blank.',
  productArea: 'Data room', priority: 'BUG', severity: 'MEDIUM',
});
await api.listMyFeedback();
```

Replacing the API implementation with Amplify should preserve these signatures and types.
No `aws-amplify` dependency or `amplify/` backend is included in this phase.

## Styles and shared UI

`src/styles/global.css` imports Tailwind and the supplied `tokens.css`. `@theme inline`
exposes semantic colors as utilities such as `bg-surface`, `text-muted`, and `border-line`;
Tailwind's default palette is disabled. Exact geometry is in scoped component, shell and auth
CSS. Original SVG symbol paths are in `src/components/icons/symbols.tsx`.

Dark is the default. `harvest-theme` persists the choice; `index.html` restores it before
first paint. Both themes use the supplied glass, font, haze and focus tokens, with reduced
motion support.

Design reconciliation: the actual prototype and Appendix B render desktop email inputs
at 42px (the prose in §1 says 36px), email labels at 13px, and light panels/auth cards with
the final warm gradient and 6px/22px shadow (different from §5 and the convenience token).
The rebuild follows the exact Appendix B cascade. The supplied token file is preserved
with these final values appended as explicit tokens; dialogs retain the generic shadow.

## Verify

```sh
npm test
npm run test:coverage
npm run typecheck
npm run build
```

Vitest uses jsdom, React Testing Library and v8 coverage. Tests are colocated with code;
provider rendering, factories, browser stubs, a small IndexedDB harness and typed API mocks
are in `src/test/`. The coverage thresholds follow `docs/TESTING.md`.

The deploy workflow skips its deploy job while the repository variable `AMPLIFY_APP_ID`
is empty. Phase 0 does not deploy or create AWS resources.
