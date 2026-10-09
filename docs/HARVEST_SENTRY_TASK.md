# Task: integrate Sentry into HARVEST (harvest-refresh)

Give this to Codex at the start of a session in the `harvest-refresh` repo. Don't commit this file or any AGENTS.md into that repo without the lead's OK. Keep it outside the harvest-refresh repo; paste it into that Codex session.

## Goal

Send HARVEST front-end and API errors to Sentry, so they also appear on the Feedback app's Errors tab. Deliver a branch ready for review. **Do not push, deploy, or set secrets.**

## HARVEST rules that apply here (from the engineering handbook)

- Work on a branch off `prestaging`.
- Never run `git stash`, `reset --hard`, `checkout -- .` or `clean`; the shared tree holds other people's work.
- Commit only your own changes.
- Commit messages are plain-English sentences about the outcome, with no `feat:` prefix.
- Config:
  - Backend reads configuration only through `backend/src/config/env.ts` (`loadConfig`) or the integrations secret (`backend/src/integrations/settings.ts`). No ad-hoc `process.env`.
  - UI reads `import.meta.env` only in `ui/src/config/env.ts`.
- No new hard-coded URLs in UI modules. A test fails on `http(s)://` literals outside `ui/src/config/urls.ts`. The Sentry DSN comes from config, so that is fine.
- `ui/netlify.toml` sets a strict CSP. Add the Sentry ingest host to `connect-src`, or every event is blocked.
- Never send secrets, bank details, agreement contents or request bodies to Sentry. Money and bank-account flows pass through this API.
- Don't edit test files to make a gate pass. The suites are parked with known failures.
- Before handover:
  - backend: `npx tsc --noEmit`
  - UI: `npm run typecheck && npm run design`
- Prestaging's UI calls the staging API. Backend changes only take effect after the lead deploys staging.

## Plan

### UI (`ui/`)
1. Add `@sentry/react`.
2. In `ui/src/config/env.ts`, add an optional `VITE_SENTRY_DSN` (empty means Sentry is off) and expose it with the app environment and version.
3. In `ui/src/main.tsx`:
   - Init Sentry only when the DSN is set.
   - Pass `environment` = `VITE_APP_ENV` and `release` = the app version.
   - Turn on the browser tracing integration with a low sample rate.
   - Use `sendDefaultPii: false`.
4. Wrap the router in a Sentry error boundary, or report from the existing `RouteErrorBoundary`.
5. After `GET /api/me` resolves, set the Sentry user to the person id only (no email).
6. Add the Sentry ingest origin to `connect-src` in `ui/netlify.toml` for the prestaging context.
7. Note the overlap: HARVEST already reports browser crashes to `POST /api/client-failures` (`backend/src/failures/`). Keep both, and flag it to the lead.

### API (`backend/`)
1. Add the Sentry SDK suited to NestJS on AWS Lambda (`@sentry/aws-serverless` or `@sentry/nestjs`).
2. Read `SENTRY_DSN` through validated config, either `loadConfig` or the integrations secret. Missing means off. Never throw when it is absent.
3. Init once per container in `src/lambda.ts` / `bootstrap.ts`, with `environment` = `APP_ENV` and `release` = `APP_VERSION`.
4. In `common/all-exceptions.filter.ts`, capture only unrecognised errors (`internal`, HTTP 500). Do not capture expected 4xx (401/403/404/409/422).
5. Use a `beforeSend` that strips request bodies, headers (`authorization`, cookies, `idempotency-key`) and query strings.
6. The jobs and digest Lambdas can follow later. Note this in the PR.

## Done means

- [ ] With no DSN set, behaviour is unchanged
- [ ] With a DSN in local `.env.local`, a forced UI error and a forced API 500 both reach a test Sentry project, with no request body or auth header
- [ ] Typecheck passes in both packages, and the design gate passes
- [ ] A branch exists with a clear description:
  - what changed
  - the new config names (`VITE_SENTRY_DSN`, `SENTRY_DSN`)
  - that the lead needs to set them on Netlify and in the integrations secret
  - the overlap with the `failures/` module
