# Backend Deployment on Railway

This guide describes how to deploy the API (`apps/api`) on Railway with managed PostgreSQL.

---

## Prerequisites

- A [Railway](https://railway.app) account
- Railway CLI installed: `npm install -g @railway/cli`
- Project repository on GitHub: `Cleberw3b/govmunicipio`

---

## 1. Create the Project on Railway

### Via Dashboard

1. Go to [railway.app](https://railway.app) and click **New Project**
2. Select **Deploy from GitHub repo**
3. Authorize Railway to access your GitHub account
4. Select the repository `Cleberw3b/govmunicipio`

### Via CLI

```bash
railway login
railway init
# Select "Empty Project" and name it "govmunicipio"
```

---

## 2. Add PostgreSQL

In the Railway dashboard, inside the project:

1. Click **+ New** → **Database** → **Add PostgreSQL**
2. Railway will automatically create a database and inject the `DATABASE_URL` variable

---

## 3. Configure the API Service

### Root Directory

In the API service settings, set the **Root Directory** to `apps/api`.

### Build Command

```
pnpm install && pnpm build
```

### Start Command

```
node dist/main.js
```

### Watch Paths

Configure to redeploy only when relevant files change:

```
apps/api/**
packages/shared/**
package.json
pnpm-lock.yaml
```

---

## 4. Environment Variables

Set the following environment variables in Railway (Settings → Variables):

```env
# Database (automatically provided by Railway PostgreSQL)
DATABASE_URL=${{Postgres.DATABASE_URL}}

# JWT
JWT_SECRET=your_strong_secret_key_here
JWT_EXPIRATION=7d

# Application
NODE_ENV=production
PORT=3001

# CORS - Frontend URL on Vercel
CORS_ORIGIN=https://govmunicipio.vercel.app
```

> **Important**: For `JWT_SECRET`, use a random string of at least 64 characters.
> Generate with: `openssl rand -base64 64`

---

## 5. Configure CORS in the API

Edit `apps/api/src/main.ts` to read CORS_ORIGIN from the environment variable:

```typescript
app.enableCors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  credentials: true,
});
```

---

## 6. Configure TypeORM for Production

`apps/api/src/database/database.module.ts` already uses `synchronize: false` in production.
To apply the initial schema, run the migrations:

```bash
# Generate migration from entities
railway run pnpm typeorm migration:generate -- -d src/database/data-source.ts src/database/migrations/InitialSchema

# Run migrations
railway run pnpm typeorm migration:run -- -d src/database/data-source.ts
```

Or, for initial development, set `DB_SYNCHRONIZE=true` temporarily in the environment variables (remove after the first deploy).

---

## 7. Run the Initial Seed

After the first deploy with `DB_SYNCHRONIZE=true`:

```bash
railway run pnpm seed
```

This will create:
- TFD module with statuses (Draft, Pending, Approved, Rejected, Scheduled, Completed, Cancelled)
- Roles and permissions (super_admin, admin_municipality, operator_tfd, viewer) with resource:action format
- SIGTAP medical specialties (run `pnpm seed:specialties` separately for the full SIGTAP list)
- Default superadmin user (credentials from env)

> **Security**: Change all default passwords immediately after the first login. Use the OTP flow to set strong passwords.

---

## 8. Verify the Deployment

After deployment, the API will be available at the URL provided by Railway (e.g. `https://govmunicipio-api.up.railway.app`).

Check the health endpoint:

```bash
curl https://govmunicipio-api.up.railway.app/health
# Expected: {"status":"ok"}
```

---

## 9. Connect the Frontend to the API

In Vercel, add the environment variable to the `govmunicipio` project:

```env
NEXT_PUBLIC_API_URL=https://govmunicipio-api.up.railway.app
```

And update `apps/web/src/lib/api.ts` to use this variable:

```typescript
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
```

After the change, redeploy the frontend with:

```bash
vercel deploy --prod
```

---

## 10. Final Deployment Structure

```
GitHub (Cleberw3b/govmunicipio)
│
├── apps/web  ──────────────────►  Vercel
│                                  URL: https://govmunicipio.vercel.app
│
└── apps/api  ──────────────────►  Railway
                                   URL: https://govmunicipio-api.up.railway.app
                                   DB: Railway PostgreSQL (managed)
```

---

## Useful Commands

```bash
# View API logs on Railway
railway logs

# Open project dashboard
railway open

# Run a command in the Railway environment
railway run <command>

# View configured environment variables
railway variables
```

---

## Troubleshooting

### Error: "Cannot find module '@govmunicipio/shared'"

Make sure the monorepo build is compiling the shared package before the API.
Check that `turbo.json` has `^build` as a dependency in the build pipeline.

### Error: "SSL required" on PostgreSQL

Railway requires SSL. Add to `database.module.ts`:

```typescript
ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
```

### Deploy not updating after push

Check that Watch Paths is configured correctly, or force a manual redeploy from the dashboard.
