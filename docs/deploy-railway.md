# Backend Deployment on Railway

This guide describes how to deploy the API (`apps/api`) on Railway with managed PostgreSQL and Redis.

---

## Project Reference

| Resource | ID / URL |
|----------|----------|
| **Railway Project** | `3462a872-ff29-4501-915f-be99281dea97` |
| **Environment** | `production` (`7239deb6-bd6e-4213-aedc-d9e54decd658`) |
| **API Service** | `8c1f278d-0054-44f4-a33b-3866c41c36fe` |
| **API URL** | `https://api-production-eb2b7.up.railway.app` |
| **Dashboard** | [railway.com/project/3462a872-ff29-4501-915f-be99281dea97](https://railway.com/project/3462a872-ff29-4501-915f-be99281dea97) |

### Service Connection URLs

**PostgreSQL** (internal — used by API service):
```
postgresql://postgres:<password>@postgres.railway.internal:5432/railway
```

**PostgreSQL** (public — for local migrations/seeds):
```
postgresql://postgres:<password>@maglev.proxy.rlwy.net:<port>/railway
```

**Redis** (internal — used by API service):
```
redis://default:<password>@redis.railway.internal:6379
```

**Redis** (public — for local debugging):
```
redis://default:<password>@<host>.proxy.rlwy.net:<port>
```

> Get the actual URLs with: `railway link --service Postgres && railway variables`

---

## Prerequisites

- A [Railway](https://railway.app) account
- Railway CLI installed: `npm install -g @railway/cli`
- Project repository on GitHub: `Cleberw3b/govmunicipio`

---

## 1. Project Structure on Railway

The Railway project has 3 services:

```
govmunicipio (Railway Project)
├── api        → NestJS API (from GitHub, Nixpacks build)
├── Postgres   → PostgreSQL 16 (managed database)
└── Redis      → Redis 7 (managed, for OTP tokens)
```

### Adding Services via CLI

```bash
railway login
railway link  # Select the govmunicipio project

# Add databases
railway add -d postgres
railway add -d redis
```

---

## 2. Build Configuration

The API builds using **Nixpacks** with configuration in `nixpacks.toml`:

```toml
[phases.setup]
nixPkgs = ["nodejs_22", "nodePackages.pnpm"]

[phases.install]
cmds = ["pnpm install --frozen-lockfile"]
```

And `railway.toml`:

```toml
[build]
builder = "NIXPACKS"
buildCommand = "pnpm install && pnpm turbo build --filter=@govmunicipio/api"

[deploy]
startCommand = "node apps/api/dist/main.js"
restartPolicyType = "ON_FAILURE"
restartPolicyMaxRetries = 3
```

> **Note**: Node version is controlled by the `NIXPACKS_NODE_VERSION=24` env var on Railway, not the nixPkgs entry.

---

## 3. Environment Variables

Set on the **api** service (Settings → Variables):

```env
# Database — Railway reference variable (resolves to internal URL automatically)
DATABASE_URL=${{Postgres.DATABASE_URL}}

# Redis — Railway reference variable
REDIS_URL=${{Redis.REDIS_URL}}

# JWT
JWT_SECRET=<generate with: openssl rand -base64 64>
JWT_EXPIRATION=7d

# Application
NODE_ENV=production
NIXPACKS_NODE_VERSION=24

# CORS — Frontend URL on Vercel
CORS_ORIGIN=https://govmunicipio.vercel.app
```

> **Important**: Use `${{Postgres.DATABASE_URL}}` and `${{Redis.REDIS_URL}}` reference syntax — Railway resolves these to the internal service URLs automatically.

---

## 4. Database Setup

### Run Migrations (from local)

```bash
# Link to Postgres service to get the public URL
railway link --service Postgres
DB_PUBLIC_URL=$(railway variables --json | python3 -c "import sys,json; print(json.load(sys.stdin)['DATABASE_PUBLIC_URL'])")

# Switch to API directory and run migrations
cd apps/api
DATABASE_URL="$DB_PUBLIC_URL" npx dotenv-cli -e /dev/null -- \
  ts-node --project tsconfig.json node_modules/typeorm/cli.js \
  migration:run -d src/database/data-source.ts
```

### Run Seed (from local)

```bash
DATABASE_URL="$DB_PUBLIC_URL" npx ts-node --project tsconfig.json \
  src/database/seeds/seed.ts
```

This creates:
- 5 TFD statuses (draft, pending, in_transit, finalized, cancelled)
- TFD module with module-status links
- 11 permissions + 4 roles (super_admin, admin_municipality, operator_tfd, viewer)
- 4,829 SIGTAP medical specialties
- Sample municipality, hospital, persons
- Default principals: `admin` / `admin123`, `superadmin` / `super123`

### Full Reset (drop + recreate)

```bash
# Get public URL
railway link --service Postgres
DB_PUBLIC_URL=$(railway variables --json | python3 -c "import sys,json; print(json.load(sys.stdin)['DATABASE_PUBLIC_URL'])")

# Drop and recreate schema
cd apps/api
node -e "
const { Client } = require('pg');
const c = new Client({ connectionString: '$DB_PUBLIC_URL' });
c.connect()
  .then(() => c.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public; GRANT ALL ON SCHEMA public TO public;'))
  .then(() => { console.log('Schema reset'); c.end(); })
  .catch(e => { console.error(e.message); c.end(); process.exit(1); });
"

# Run migrations + seed
DATABASE_URL="$DB_PUBLIC_URL" npx dotenv-cli -e /dev/null -- \
  ts-node --project tsconfig.json node_modules/typeorm/cli.js \
  migration:run -d src/database/data-source.ts

DATABASE_URL="$DB_PUBLIC_URL" npx ts-node --project tsconfig.json \
  src/database/seeds/seed.ts
```

> **Security**: Change all default passwords immediately after the first login.

---

## 5. Deploy

### Manual Deploy (from local)

```bash
railway link --service api
railway up --detach
```

### CI/CD Deploy (GitHub Actions)

The CI pipeline (`.github/workflows/ci.yml`) includes a `deploy-railway` job that runs automatically on push to `main` when `apps/api/` or `packages/shared/` change.

**Required GitHub secret:** `RAILWAY_TOKEN`

> ⚠️ **This must be a Project Token, NOT an Account Token.**
>
> - **Project Tokens** are created at: **Project Settings → Tokens**
>   → [railway.com/project/3462a872-ff29-4501-915f-be99281dea97/settings/tokens](https://railway.com/project/3462a872-ff29-4501-915f-be99281dea97/settings/tokens)
>   → Select the **production** environment when creating the token.
>   → These work with the `RAILWAY_TOKEN` env var.
>
> - **Account Tokens** (created at `railway.com/account/tokens`) do **NOT** work with `RAILWAY_TOKEN`.
>   Account tokens use the `RAILWAY_API_TOKEN` env var instead and require a different auth flow.
>
> After creating the project token, set it as a GitHub secret:
> ```bash
> gh secret set RAILWAY_TOKEN -R Cleberw3b/govmunicipio
> ```

The CI deploy command uses explicit project/service/environment flags (no `railway link` needed in CI):
```bash
railway up \
  --project 3462a872-ff29-4501-915f-be99281dea97 \
  --service api \
  --environment production \
  --detach
```

---

## 6. Verify the Deployment

```bash
# Test login endpoint
curl -s https://api-production-eb2b7.up.railway.app/api/v1/auth/login \
  -X POST -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}'

# Check logs
railway link --service api
railway logs -n 30
```

---

## 7. Frontend Connection

The frontend on Vercel connects to the API via:

```env
NEXT_PUBLIC_API_URL=https://api-production-eb2b7.up.railway.app/api/v1
```

---

## 8. Final Architecture

```
GitHub (Cleberw3b/govmunicipio)
│
├── apps/web  ───── CI ────►  Vercel
│                              URL: https://govmunicipio.vercel.app
│
└── apps/api  ───── CI ────►  Railway
                               URL: https://api-production-eb2b7.up.railway.app
                               ├── PostgreSQL (managed, internal networking)
                               └── Redis 7 (managed, for OTP tokens)
```

---

## Useful Commands

```bash
# Link to project
railway link --project 3462a872-ff29-4501-915f-be99281dea97 --service api --environment production

# View logs
railway logs -n 50

# View environment variables
railway variables

# List deployments
railway deployment list

# Open dashboard
railway open

# Redeploy
railway up --detach
```

---

## Troubleshooting

### Error: "Configuration key JWT_SECRET does not exist"

The deployment went to a service without env vars. Ensure you're linked to the correct API service:
```bash
railway link --service api --environment production
railway variables  # Verify JWT_SECRET is listed
railway up --detach
```

### Error: "Unable to connect to the database"

Check that `DATABASE_URL` uses the Railway reference variable `${{Postgres.DATABASE_URL}}` and that the Postgres service is running:
```bash
railway link --service Postgres
railway deployment list  # Should show SUCCESS
```

### Error: "Cannot find module '@govmunicipio/shared'"

The monorepo build needs the shared package. The `buildCommand` in `railway.toml` handles this:
```
pnpm install && pnpm turbo build --filter=@govmunicipio/api
```

### Error: "Unauthorized" or "Invalid RAILWAY_TOKEN" in CI deploy

The `RAILWAY_TOKEN` GitHub secret is using an **Account Token** instead of a **Project Token**.

- Account tokens (`railway.com/account/tokens`) → use `RAILWAY_API_TOKEN`, not `RAILWAY_TOKEN`
- Project tokens (`Project Settings → Tokens`) → use `RAILWAY_TOKEN` ✅

Fix:
1. Go to [Project Settings → Tokens](https://railway.com/project/3462a872-ff29-4501-915f-be99281dea97/settings/tokens)
2. Create a new token scoped to the **production** environment
3. Update the GitHub secret: `gh secret set RAILWAY_TOKEN -R Cleberw3b/govmunicipio`
4. Re-run the failed CI job: `gh run rerun <run_id> --failed -R Cleberw3b/govmunicipio`

### Redis warnings in logs

If `REDIS_URL` is not set, the API runs without Redis (OTP features disabled). Set it with:
```bash
railway link --service api
railway variables set REDIS_URL='${{Redis.REDIS_URL}}'
```
