# Environments, branches and deploys

## The picture

| Environment | Branch | Site | Who uses it | Goes live when |
|---|---|---|---|---|
| **dev** | `dev` | `https://dev.<appId>.amplifyapp.com` | Sahil and Manasa | A pull request is merged into `dev` |
| **test** | `test` | `https://test.<appId>.amplifyapp.com` | Vaish and testers | `dev` is merged into `test` |
| **production** | `main` | `https://main.<appId>.amplifyapp.com` (custom domain later) | Real users | `test` is merged into `main` **and Vaish approves** |

- Each environment is a complete, separate copy: its own website, Cognito users, database and S3 bucket. Nothing is shared.
- Each developer also has a private **sandbox** (`npx ampx sandbox`), a personal backend for working on a laptop.
- **Deploys go through GitHub Actions** (`.github/workflows/deploy.yml`). Merging into a branch tells Amplify to build it, waits for the result, and records it in GitHub. The repo's **Deployments** box then shows `dev`, `test` and `production` with green ticks, like HARVEST's.
- **Production waits for Vaish:** the job pauses until she clicks *Approve* in GitHub.
- **Every pull request runs Checks** (`.github/workflows/checks.yml`): typecheck, unit tests with coverage, and build. It can't merge until they pass.

## Flow of a change

```
admin/<thing> or client/<thing>
   └─ PR ─▶ dev ─▶ PR ─▶ test ─▶ PR ─▶ main ─▶ (Vaish approves) ─▶ production
```

1. Branch off `dev`: `admin/...` for Sahil, `client/...` for Manasa.
2. Work against your sandbox. Push your branch. Open a PR into `dev`. Checks run; the other person looks and merges. Dev deploys.
3. When dev is good, open a PR `dev → test`. Test deploys. Vaish checks the test site.
4. When test is approved, open a PR `test → main`. Vaish approves the deployment. Production deploys.

Never push straight to `test` or `main`. Branch protection blocks it anyway.

---

# One-time setup checklist (do it in this order)

`[you]` means Sahil. `[AWS admin]` means whoever has admin access to Meridian's AWS account; ask Vaish who that is.

## A. Before anything: access

- [ ] **[you]** Ask Vaish for:
  1. AWS console access for Sahil and Manasa, able to use Amplify, in the region you'll use (default `us-east-2`).
  2. Which GitHub org the repo goes in.
  3. Who the AWS admin is, for step D.
  4. Sentry org access, the GA4 property and the Looker report. These can come later.

## B. GitHub repository

- [ ] **[you]** Create the repo: private, in the agreed org. Add Manasa (write) and Vaish (admin or maintain).
- [ ] **[you]** Clone it. Copy this package into the root, including the hidden `.github/` folder. Commit and push to `main`.
- [ ] **[you]** Create the other branches:
  ```
  git checkout -b test && git push -u origin test
  git checkout -b dev  && git push -u origin dev
  ```
- [ ] **[you]** Settings → General → **Default branch = `dev`**.
- [ ] **[you]** Settings → **Environments** → create three: `dev`, `test`, `production`.
  - `production`: tick **Required reviewers**, add **Vaish**. Under *Deployment branches*, choose **Selected branches** and allow only `main`.
  - `test`: deployment branches → only `test`.
  - `dev`: deployment branches → only `dev`.
- [ ] **[you]** Settings → **Branches** (or Rules → Rulesets) → protect `main`, `test` and `dev`:
  - Require a pull request before merging.
  - Require the status check **"Typecheck, test and build"**. It appears in the list after the first PR has run Checks; add it then.
  - Block force pushes and deletions.

## C. Phase 0 code (your Codex, `docs/ADMIN_TASK.md`)

- [ ] **[you]** Branch `setup/foundation` off `dev`. Run Phase 0, open a PR into `dev`, wait for Checks to pass, merge.
- [ ] **[you]** Confirm a fresh clone runs: `npm install`, `npx ampx sandbox`, `npm run dev`.

## D. Amplify app and deploy role (once Phase 0 is on `dev`)

- [ ] **[you]** AWS Console → **Amplify** → *Create new app* → GitHub → this repo → branch **`dev`** → deploy. Let the first build finish.
- [ ] **[you]** Same app → *Add branch* → **`test`**, then **`main`**.
- [ ] **[you]** For **each** of `dev`, `test` and `main`: Branch settings → **turn OFF "Auto build"**. GitHub Actions starts builds now; leaving it on would build twice.
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

- [ ] **[you]** For **each** branch (`dev`, `test`, `main`), set environment variables: `VITE_SENTRY_DSN`, `VITE_GA_MEASUREMENT_ID`, `VITE_LOOKER_EMBED_URL`, `SENTRY_ORG`, `SENTRY_PROJECTS`. Empty is fine until you have them; the app shows setup messages.
- [ ] **[you]** For **each** branch: secret `SENTRY_AUTH_TOKEN`, once you have one.
- [ ] **[you]** Optional: Access control → password-protect `dev` and `test`.

## F. Prove it works

- [ ] **[you]** Make a tiny PR into `dev` (e.g. a README line) and merge it. Then check:
  - Actions shows **Deploy dev** running.
  - Amplify shows a build that GitHub started.
  - The repo page shows **Deployments → dev** with a green tick and a link.
- [ ] **[you]** PR `dev → test`, merge. **Deployments → test** appears.
- [ ] **[you]** PR `test → main`, merge. The production job **waits** until Vaish clicks *Review deployments → Approve*. Then **Deployments → production** appears.

## G. Users

- [ ] **[you]** In each environment's Cognito user pool (Amplify console → the branch → Authentication), create users with their email, `name`, `custom:persona` and `custom:company`. Put admins in the `admins` group.
  - dev and test: fake test users only.
  - production: real people, created when Vaish says.

## H. Tell Manasa to start

- [ ] Send her the repo link and `docs/CLIENT_TASK.md`. She clones, runs `npm install`, `npx ampx sandbox` (her AWS login) and `npm run dev`, then branches `client/new-feedback` off `dev`.

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
