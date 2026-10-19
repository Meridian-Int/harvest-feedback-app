# Environments, branches and deploys

The Feedback repository keeps two remote branches: `dev` for ordinary work and `main` for production. The former `test` branch has been retired. Integrated Feedback uses separate `harvest-feedback-integration-dev` and `harvest-feedback-integration-production` stacks, private static origins, report tables, media buckets and HARVEST identity pools. HARVEST's existing GitLab CI/CD publishes the HARVEST frontend; it does not update the separate Feedback backend or UI. The standalone Amplify flow below is legacy and does not publish HARVEST `/feedback`.

| HARVEST site | Feedback target | HARVEST identity and API | Feedback site route |
| --- | --- | --- | --- |
| Prestaging | `dev` | HARVEST staging | Same-domain `/feedback`, proxied to the Feedback `dev` static origin |
| Staging | `dev` by default; `test` when separately released | HARVEST staging | Same-domain `/feedback`, proxied to the matching nonproduction Feedback static origin |
| Production | `production` | HARVEST production | Same-domain `/feedback`, proxied to the Feedback production static origin |

An active HARVEST Operator membership grants Feedback admin access, including an Operator `user` role. Active Company or Partner memberships grant client access. An email address, Cognito group or old Feedback assignment does not grant admin. The Feedback API checks current HARVEST membership on every operation, so revoked access is denied. A person with both Operator and Company/Partner memberships has admin access; the selected organization still identifies the company for a client report.

The Feedback release is prepared from one completed stack's public outputs with `FEEDBACK_TARGET=dev|test|production node integration-backend/write-stack-outputs.mjs`, then `FEEDBACK_TARGET=... node integration-backend/prepare-release.mjs`. The settings file contains `FEEDBACK_RELEASE_MANIFEST` and `VITE_FEEDBACK_GRAPHQL_URL` for the matching HARVEST Netlify site. The checked `dev` manifest can be used on both prestaging and staging; both sites use HARVEST's staging identity and API, while the Feedback `dev` media bucket allows both browser origins. A separately released `test` stack remains optional for staging. HARVEST's build rejects a manifest whose target, pool, client or API differs from the site settings. Release the `dev` stack and UI, validate prestaging, then staging, before requesting a separate production deployment review. Do not deploy production as part of the prestaging approval.

## Legacy standalone branches

| Environment | Branch | Site | Who uses it | Goes live when |
|---|---|---|---|---|
| **dev** | `dev` | `https://dev.<appId>.amplifyapp.com` (legacy standalone URL) | Transitional test users | The standalone deploy runs only when configured; the integrated backend and UI release separately |
| **production** | `main` | `https://main.<appId>.amplifyapp.com` (legacy standalone URL) | Transitional only | A reviewed `dev` → `main` PR is merged and Vaish approves the legacy deployment |

- Feedback `dev` has its own report database and storage, separate from production. The integrated dev release uses HARVEST staging identities. A production stack must use production VPC, private subnets, read-only directory grant, HARVEST production identity and API. See [HARVEST account integration](HARVEST_AUTH_INTEGRATION.md).
- Each developer also has a private **sandbox** (`npx ampx sandbox`), a personal backend for working on a laptop.
- **Legacy standalone deploys go through GitHub Actions** (`.github/workflows/deploy.yml`) only when `AMPLIFY_APP_ID` is configured. A push to a configured branch tells Amplify to build it and records the result in GitHub. This workflow does not release the integrated Feedback backend or HARVEST `/feedback` UI.
- **Production approval:** when the GitHub production environment has a required reviewer, the legacy deploy job pauses for Vaish's approval.
- **Every pull request runs Checks** (`.github/workflows/checks.yml`): typecheck, unit tests with coverage, and build. A direct push to `dev` does not get this PR check, so run the same checks locally first.

## Flow of a change

```
Sahil and Manasa ─▶ dev ─▶ PR ─▶ main ─▶ (Vaish approves) ─▶ production
```

1. Sahil and Manasa both pull and work directly on `dev`. Coordinate before editing shared files.
2. Work against your sandbox, pull the latest `dev`, and run the local checks before pushing. A normal `dev` push starts only the legacy standalone Amplify deploy when configured. Release the integrated backend and private UI separately after review.
3. Validate the integrated flow on HARVEST prestaging, then staging, before proposing a production release.
4. When approved, open a PR `dev → main`. Vaish reviews the production deployment.

Never push straight to `main`.

---

# Legacy standalone Amplify setup checklist

This checklist describes the standalone Amplify deployment. It does not configure the integrated Feedback backend or the HARVEST `/feedback` route. Complete only the parts still relevant to an approved standalone deployment.

`[you]` means Sahil. `[AWS admin]` means whoever has admin access to Meridian's AWS account; ask Vaish who that is.

## A. Before anything: access

- [ ] **[you]** Ask Vaish for:
  1. AWS console access for Sahil and Manasa, able to use Amplify, in the region you'll use (default `us-east-2`).
  2. Which GitHub org the repo goes in.
  3. Who the AWS admin is, for step D.
  4. Sentry org access, the GA4 property and the Looker report. These can come later.

## B. GitHub repository

- [ ] **[you]** Confirm the existing repository is private and the intended collaborators have access.
- [ ] **[you]** Keep the existing `dev` and `main` branches. Do not recreate the retired `test` branch.
- [ ] **[you]** Settings → General → **Default branch = `dev`**.
- [ ] **[you]** Settings → **Environments** → create `dev` and `production`.
  - `production`: tick **Required reviewers**, add **Vaish**. Under *Deployment branches*, choose **Selected branches** and allow only `main`.
  - `dev`: deployment branches → only `dev`.
- [ ] **[you]** Settings → **Branches** (or Rules → Rulesets) → protect `main`:
  - Require a pull request before merging.
  - Require the status check **"Typecheck, test and build"**. It appears in the list after the first PR has run Checks; add it then.
  - Block force pushes and deletions.
- [ ] **[you]** Configure `dev` to allow the agreed direct pushes from Sahil and Manasa while blocking force pushes and deletion.

## C. Phase 0 code (your Codex, `docs/ADMIN_TASK.md`)

- [ ] **[you]** If Phase 0 needs further work, coordinate and push it to `dev` after local checks.
- [ ] **[you]** Confirm a fresh clone runs: `npm install`, `npx ampx sandbox`, `npm run dev`.

## D. Amplify app and deploy role (once Phase 0 is on `dev`)

- [ ] **[you]** AWS Console → **Amplify** → *Create new app* → GitHub → this repo → branch **`dev`** → deploy. Let the first build finish.
- [ ] **[you]** Same app → *Add branch* → **`main`**.
- [ ] **[you]** For **each** of `dev` and `main`: Branch settings → **turn OFF "Auto build"**. GitHub Actions starts builds now; leaving it on would build twice.
- [ ] **[you]** Note the **App ID** (looks like `d1a2b3c4d5e6f7`) from the app's General settings.
- [ ] **[AWS admin]** IAM → Identity providers → *Add provider* → OpenID Connect:
  - URL `https://token.actions.githubusercontent.com`
  - Audience `sts.amazonaws.com`
  - Skip this if the account already has it.
- [ ] **[AWS admin]** IAM → Roles → *Create role* → *Web identity*, then:
  - Paste `docs/aws/github-oidc-trust-policy.json` as the trust policy, with `<AWS_ACCOUNT_ID>`, `<GITHUB_OWNER>` and `<REPO_NAME>` filled in.
  - Attach an inline policy from `docs/aws/github-deploy-permissions.json`, with the region, account and **App ID** filled in.
  - Name it `harvest-feedback-github-deploy` and copy its **Role ARN**.
- [ ] **[you]** GitHub → Settings → Secrets and variables → Actions → **Variables** tab → add:
  - `AMPLIFY_APP_ID` = the App ID
  - `AWS_REGION` = e.g. `us-east-2`
  - `AWS_DEPLOY_ROLE_ARN` = the role ARN

  These are not secrets. No AWS keys are stored in GitHub; the job signs in through OIDC.

## E. App settings per environment (Amplify console)

- [ ] **[you]** For **each** branch (`dev`, `main`), set environment variables: `VITE_SENTRY_DSN`, `VITE_GA_MEASUREMENT_ID`, `VITE_LOOKER_EMBED_URL`, `SENTRY_ORG`, `SENTRY_PROJECTS`. Empty is fine until you have them; the app shows setup messages.
- [ ] **[you]** For **each** branch: secret `SENTRY_AUTH_TOKEN`, once you have one.
- [ ] **[you]** Optional: Access control → password-protect `dev`.

## F. Prove it works

- [ ] **[you]** After the legacy standalone Amplify deploy is configured, push a checked change to `dev`. Then check:
  - Actions shows **Deploy dev** running.
  - Amplify shows a build that GitHub started.
  - The repo page shows **Deployments → dev** with a green tick and a link.
- [ ] **[you]** With production release approval, PR `dev → main` and merge. If Vaish is configured as a required reviewer, the production job waits for her approval before **Deployments → production** appears.

## G. Users

- [ ] **[you]** In each environment's Cognito user pool (Amplify console → the branch → Authentication), create users with their email, `name`, `custom:persona` and `custom:company`. Put admins in the `admins` group.
  - dev: fake test users only.
  - production: real people, created when Vaish says.

## H. Tell Manasa to start

- [ ] Send her the repo link and `docs/CLIENT_TASK.md`. She clones, runs `npm install`, `npx ampx sandbox` (her AWS login) and `npm run dev`, then coordinates changes on `dev`.

---

## If something goes wrong

| Symptom | Likely cause |
|---|---|
| Deploy job fails at "Sign in to AWS" | Role ARN variable wrong, or the trust policy's repo or environment names don't match exactly |
| "Not authorized to perform amplify:StartJob" | Region, account or App ID wrong in the permissions policy |
| Two builds per merge | "Auto build" still on for that branch in Amplify |
| Production job sits on "Waiting" | Working as designed: Vaish must approve under *Review deployments* |
| Checks never show up as a required option | Open one PR first so GitHub has seen the check name |
| Amplify build fails | Open the job in the Amplify console for logs; the GitHub job only reports pass or fail |
