# GitHub Actions — Production Deploy

`deploy-production.yml` deploys to Hostinger production
(`app.shikshapilot.com`). It is **manual-only** — no push/PR trigger — run it
from the Actions tab ("Run workflow") or:

```bash
gh workflow run deploy-production.yml -f confirm=deploy
```

You must type `deploy` in the confirmation input or the run aborts
immediately, before touching anything.

## One-time setup: GitHub Secrets

Unlike `deploy.sh` (which hardcodes credentials in the script), this workflow
builds every `.env` file entirely from GitHub encrypted secrets — nothing
sensitive lives in the repo or the workflow file. Add these under
**Settings → Secrets and variables → Actions** (repo-level, or scoped to a
`production` environment for extra protection — see below):

| Secret | Example / notes |
|---|---|
| `PROD_SSH_HOST` | `92.249.46.170` (same server as QA, per deploy.sh) |
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
| `PROD_JWT_SECRET` | a strong, unique secret — **do not reuse the QA value** (`super_secret_erp_key_2026` in deploy.sh) |
| `PROD_SMTP_HOST` | e.g. `smtp.gmail.com` |
| `PROD_SMTP_PORT` | e.g. `587` |
| `PROD_SMTP_USER` | SMTP account |
| `PROD_SMTP_PASS` | SMTP app password |
| `PROD_SMTP_FROM_NAME` | display name on outgoing mail |

`APP_ENV`/`APP_DEBUG` are hardcoded in the workflow to `production`/`false` —
not secrets, since they should never vary per environment.

### Recommended: gate behind a GitHub Environment

The workflow already targets `environment: production`. Create that
environment under **Settings → Environments → New environment** named
`production`, then optionally add **required reviewers** so someone has to
approve the run before it touches the live site, and/or restrict which
branches can trigger it. If you skip this, the environment falls back to repo
defaults with no extra gate — the workflow still works, just without the
approval step.

## What it does (mirrors `deploy.sh`)

1. Builds the frontend with Vite in `production` mode, using an
   `.env.production` file assembled from the `PROD_VITE_*` secrets.
2. Packages the frontend build + backend `src`/`public`/composer files into
   one tarball, with a backend `.env` assembled from the `PROD_DB_*`/
   `PROD_JWT_SECRET`/`PROD_SMTP_*` secrets and the root/`api/` `.htaccess`
   files `deploy.sh` also generates.
3. `scp`s the tarball to `PROD_REMOTE_PATH` and, over SSH, extracts it,
   removes the previous `assets`/`api`/`index.html`, runs
   `composer install --no-dev --optimize-autoloader`, then runs
   `php api/src/Database/migrate.php`.

## Known gap carried over from deploy.sh

Migrations run unconditionally and there's no rollback step if a migration
or `composer install` fails partway — same behavior as the existing QA
script. If you want a safer production rollout (e.g. a pre-deploy DB backup,
or a dry-run migration check), that would need to be added on top of this;
flag it if you'd like that as a follow-up.
