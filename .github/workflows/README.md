# GitHub Actions — Deploy Workflows

Three manual-only workflows deploy to Hostinger — no push/PR trigger for
any of them. `deploy-qa.yml` and `deploy-production.yml` replace the old
`deploy.sh` / `deploy.ps1` / `deploy_qa.py` scripts, which have been removed
from the repo.

- `deploy-qa.yml` → `qa.shikshapilot.com` (the React/PHP app)
- `deploy-production.yml` → `app.shikshapilot.com` (the React/PHP app),
  gated behind a typed `confirm=deploy` input
- `deploy-website.yml` → `shikshapilot.com` (the plain-PHP marketing site in
  `website/`), also gated behind `confirm=deploy`

All three are also gated to a specific branch (`deploy-qa.yml` → `qa`,
the other two → `master`) — see each workflow's "Verify triggered from
branch" step.

Run any of them from the Actions tab ("Run workflow") or:

```bash
gh workflow run deploy-qa.yml
gh workflow run deploy-production.yml -f confirm=deploy
gh workflow run deploy-website.yml -f confirm=deploy
```

## One-time setup: GitHub Secrets

Every `.env` file is assembled entirely from GitHub encrypted secrets at
build time — nothing sensitive lives in the repo or the workflow files. Add
these under **Settings → Secrets and variables → Actions** (repo-level, or
scoped to a `qa`/`production` environment for extra protection — see below).

### QA secrets (`deploy-qa.yml`)

| Secret | Example / notes |
|---|---|
| `QA_SSH_HOST` | `92.249.46.170` |
| `QA_SSH_PORT` | `65002` |
| `QA_SSH_USER` | `u554613359` |
| `QA_SSH_PASSWORD` | QA SSH password |
| `QA_REMOTE_PATH` | `/home/u554613359/domains/qa.shikshapilot.com/public_html` |
| `QA_VITE_API_URL` | QA API URL the frontend calls |
| `QA_VITE_APP_NAME` | e.g. `Shiksha Pilot` |
| `QA_VITE_APP_VERSION` | e.g. `1.0.0` |
| `QA_APP_NAME` | backend `APP_NAME` |
| `QA_APP_DEBUG` | `true` or `false` |
| `QA_DB_HOST` | QA DB host |
| `QA_DB_PORT` | usually `3306` |
| `QA_DB_NAME` | QA DB name |
| `QA_DB_USER` | QA DB user |
| `QA_DB_PASS` | QA DB password |
| `QA_JWT_SECRET` | JWT secret for QA |
| `QA_SMTP_HOST` | e.g. `smtp.gmail.com` |
| `QA_SMTP_PORT` | e.g. `587` |
| `QA_SMTP_USER` | SMTP account |
| `QA_SMTP_PASS` | SMTP app password |
| `QA_SMTP_FROM_NAME` | display name on outgoing mail |

### Production secrets (`deploy-production.yml`)

| Secret | Example / notes |
|---|---|
| `PROD_SSH_HOST` | `92.249.46.170` (same server as QA) |
| `PROD_SSH_PORT` | `65002` |
| `PROD_SSH_USER` | `u554613359` |
| `PROD_SSH_PASSWORD` | production SSH password |
| `PROD_REMOTE_PATH` | `/home/u554613359/domains/app.shikshapilot.com/public_html` |
| `PROD_VITE_API_URL` | production API URL the frontend calls |
| `PROD_VITE_APP_NAME` | e.g. `Shiksha Pilot` |
| `PROD_VITE_APP_VERSION` | e.g. `1.0.0` |
| `PROD_APP_NAME` | backend `APP_NAME` |
| `PROD_DB_HOST` | production DB host |
| `PROD_DB_PORT` | usually `3306` |
| `PROD_DB_NAME` | production DB name |
| `PROD_DB_USER` | production DB user |
| `PROD_DB_PASS` | production DB password |
| `PROD_JWT_SECRET` | a strong, unique secret — **do not reuse the QA value** |
| `PROD_SMTP_HOST` | e.g. `smtp.gmail.com` |
| `PROD_SMTP_PORT` | e.g. `587` |
| `PROD_SMTP_USER` | SMTP account |
| `PROD_SMTP_PASS` | SMTP app password |
| `PROD_SMTP_FROM_NAME` | display name on outgoing mail |

`APP_ENV`/`APP_DEBUG` are hardcoded in `deploy-production.yml` to
`production`/`false` — not secrets, since they should never vary. QA keeps
`APP_DEBUG` as a secret since the old `.qa.env` treated it as configurable.

### Website secrets (`deploy-website.yml`)

The marketing site has no database, no build step, and no secrets of its
own — `website/includes/config.php` hardcodes `SITE_DOMAIN`. It targets the
same `production` GitHub Environment as `deploy-production.yml` (same
server, same `PROD_SSH_*` secrets — **not** a separate `website`
environment, since environment secrets are strictly scoped per environment
name and won't be visible to a job declaring a different one) and needs
exactly one additional secret, added under that same `production`
environment:

| Secret | Example / notes |
|---|---|
| `WEBSITE_REMOTE_PATH` | `/home/u554613359/domains/shikshapilot.com/public_html` |

### Recommended: gate behind GitHub Environments

All three workflows target an `environment:` (`qa` / `production` — the
website deploy shares `production`). Create these under **Settings →
Environments → New environment**, then optionally add **required
reviewers** so someone has to approve the run before it touches that
environment, and/or restrict which branches can trigger it. If you skip
this, the environment falls back to
repo defaults with no extra gate — the workflows still work, just without
the approval step.

## What they do

**`deploy-qa.yml` / `deploy-production.yml`** (mirrors the old `deploy.sh`):

1. Build the frontend with Vite in `qa`/`production` mode, using an
   `.env.qa`/`.env.production` file assembled from the `*_VITE_*` secrets.
2. Package the frontend build + backend `src`/`public`/composer files into
   one tarball, with a backend `.env` assembled from the `*_DB_*`/
   `*_JWT_SECRET`/`*_SMTP_*` secrets and the root/`api/` `.htaccess` files
   the old script also generated.
3. `scp` the tarball to the remote path and, over SSH, extract it, remove
   the previous `assets`/`api`/`index.html`, run
   `composer install --no-dev --optimize-autoloader`, then run
   `php api/src/Database/migrate.php`.

**`deploy-website.yml`** — much simpler, since `website/` is plain PHP with
no build step and no dependencies:

1. Tar up `website/` as-is (excluding `Dockerfile`, which only exists for
   local Docker Compose dev — Hostinger's Apache is already configured).
2. `scp` the tarball to `WEBSITE_REMOTE_PATH` and extract it over SSH. No
   composer, no migrations — there's nothing to run.

## Known gaps carried over from the old scripts

- `deploy-qa.yml`/`deploy-production.yml`: migrations run unconditionally
  and there's no rollback step if a migration or `composer install` fails
  partway. If you want a safer rollout (e.g. a pre-deploy DB backup, or a
  dry-run migration check), that would need to be added on top of this;
  flag it if you'd like that as a follow-up.
- `deploy-website.yml`: extracting the tarball doesn't remove old files
  first (unlike the app deploys, which `rm -rf assets api index.html`
  before extracting) — a file removed from `website/` won't be removed on
  the server by a redeploy. Fine for now since the site is small and
  hand-reviewed; worth revisiting if the page count grows.
