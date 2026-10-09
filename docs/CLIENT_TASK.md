# Client task (owner: Manasa)

Read `AGENTS.md`, then `docs/design/handoff/DESIGN_SPEC.md`. Your prototype is the target: `docs/design/handoff/source/Harvest Feedback.html`, signed in as `company@example.com` / `123456`.

**Start after Sahil merges Phase 0 into `dev`.**
1. Pull `dev`.
2. Run `npm install` and `npx ampx sandbox` (your own backend; needs your AWS login), then `npm run dev`.
3. Branch `client/<thing>` off `dev`.

Work only in `src/features/client/`. Use the shared components in `src/components/ui/`, `src/lib/options.ts` and `src/lib/feedback.ts`. If one of them needs a change, ask Sahil first.

Put validation, the file check, the duplicate finder, the draft and the recorder rules in `src/features/client/logic/` as plain functions, and test them. Write page tests with the mocked API. See `docs/TESTING.md`, Client.

## Screen 1: New feedback (`/feedback/new`, spec "Client New feedback")

1. **Product area** `Select` (6 options from `PRODUCT_AREAS`). Picking "Other — add an area" reveals **Name the area** (required, max 80).
2. **Priority** and **Severity** `Select`s side by side.
3. **Duplicate notice:** the prototype's rules (spec §4) against the reporter's **own** reports. Up to 3 suggestions, each opening that report's dialog. Its helper text must not mention comments.
4. **Description:** max 3000, with a counter. The first line becomes the title (first 110 characters).
5. **Drop zone:** one file; PNG, JPG, WebP, MP4, WebM or MOV; max 50 MiB. Supports drag-and-drop, browse and paste. Thumbnail 64×48, plus filename, size and remove.
6. **Record screen now** opens the screen recording dialog (spec "Screen recording modal"):
   - `getDisplayMedia`, screen only, no microphone.
   - 15 fps, about 1.8 Mbps.
   - Auto-stop at 180 s or 48 MiB; the result must be ≤ 50 MiB.
   - Stop, Attach recording, Discard. The recording becomes the attachment only on Attach.
7. **Footer:** Submit feedback.
   - Validate first, using the spec's combined "Please …" message, and focus the first missing field.
   - Upload the file with `uploadAttachment`, then `createFeedback`.
   - Disable the button while saving. On success: clear the form, file and draft, then show the toast.
   - Remove the "Email updates included · demo only" line.
8. **Draft autosave** to `localStorage` (not the file), with the header status text as in the prototype.

All copy comes from spec Appendix C.

## Screen 2: My reports (`/feedback/mine`, spec "Client My reports")

- Heading with a "New feedback" action. Panel header: "Your reports", the List/Grid toggle and the Status filter.
- The "Newest reports first" legend. **Really sort by `createdAt` descending**, with closed reports after open ones.
- Rows and cards per spec: title and meta, the compact progress track, priority and severity pills in the 116/81 slots, and the chevron.
- **Request update:**
  - Calls `requestUpdate`.
  - Shows as pending, borderless, while `updateRequestedAt` is later than `adminActivityAt`.
  - Hidden for closed reports. Toasts on click.
- 6 per page with pagination. Filter changes go back to page 1. List/grid switching keeps the page. The layout choice is saved in `localStorage`.
- **Client detail dialog** (`?report=<id>`): ID and time, title, pills, full progress track, description, Done.
- The empty state copy from the spec. Live status changes via `observeQuery`.

## Done means

- [ ] Submit with a file, with a recording, and with neither; wrong type and >50 MiB are refused with the spec's message
- [ ] "Other" requires a name; the duplicate notice appears for a similar report
- [ ] The draft survives a reload and clears after submit
- [ ] My reports shows only my reports, newest first; pagination and list/grid both work
- [ ] Request update goes pending, and clears after an admin change
- [ ] Both themes match the prototype at 1440, 1024, 768 and 390 px; keyboard and dialogs work
- [ ] The tests listed under "Client" in `docs/TESTING.md` pass, with coverage thresholds met
- [ ] `tsc --noEmit` and `npm run build` pass

## First prompt for Codex

> Read AGENTS.md, docs/CLIENT_TASK.md and docs/design/handoff/DESIGN_SPEC.md (§1–§8; appendices for exact CSS and copy). Read docs/TESTING.md too. Plan Screen 1 (New feedback): the components, logic files and tests you'll create in src/features/client/, and which shared components you'll use. Wait for my OK before coding.
