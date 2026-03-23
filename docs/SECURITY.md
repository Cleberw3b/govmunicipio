# Security Guidelines

These rules apply to all code, tests, configuration, and documentation in this repository.

---

## 1. Credentials and secrets

**Never hardcode credentials in source files.**

This includes: passwords, API keys, JWT secrets, database URLs, tokens, private keys, and any value that grants access to a system.

| Allowed | Not allowed |
|---------|-------------|
| `process.env.JWT_SECRET` | `const secret = 'my-secret-123'` |
| `config.get('DB_PASSWORD')` | `password: 'postgres'` in production config |
| `{{superadminPassword}}` via env file | `"password": "superadmin123"` in a committed file |
| `.env` (gitignored) | `.env` committed to git |

### Rules
- All secrets go in environment variables — never in code, config files, or documentation.
- Every secret must have a corresponding entry in `.env.example` with a blank or placeholder value.
- `.env` files must be listed in `.gitignore`. The root `.gitignore` already covers `.env` and `.env.*`.
- Test credentials go in `docs/tests/.env` (gitignored). Use `docs/tests/.env.example` to document the required vars.
- If a secret is accidentally committed: rotate it immediately, then remove it from git history.

### Checking for leaked secrets before committing
```bash
# Search for patterns that look like hardcoded secrets
grep -rn "password\s*=\s*['\"][^'\"]\+['\"]" apps/ --include="*.ts"
grep -rn "apikey\|api_key\|secret\s*=" apps/ --include="*.ts" -i
```

---

## 2. Environment variables

| Variable | Where defined | Used by |
|----------|---------------|---------|
| `DATABASE_URL` | Railway (production) / `.env` (local) | API (TypeORM) |
| `DB_HOST`, `DB_PORT`, `DB_USERNAME`, `DB_PASSWORD`, `DB_NAME` | `.env` (local fallback) | API (TypeORM, when `DATABASE_URL` is absent) |
| `JWT_SECRET` | Railway / `.env` | API (auth) |
| `JWT_EXPIRATION` | Railway / `.env` | API (auth, default: `1h`) |
| `CORS_ORIGIN` | Railway / `.env` | API |
| `NODE_ENV` | Railway / `.env` | API (toggles SSL, synchronize, logging) |
| `PORT` | Railway / `.env` | API (default: `3001`) |
| `DB_SYNCHRONIZE` | Railway / `.env` | API (enables TypeORM auto-sync, use only in dev) |
| `WHATSAPP_API_URL` | Railway / `.env` | API (TFD WhatsApp notifications) |
| `WHATSAPP_API_KEY` | Railway / `.env` | API (TFD WhatsApp notifications) |
| `WHATSAPP_INSTANCE` | Railway / `.env` | API (TFD WhatsApp notifications) |
| `NEXT_PUBLIC_API_URL` | Vercel / `.env.local` | Frontend |
| `SUPERADMIN_PASSWORD` | `docs/tests/.env` | Smoke tests |
| `ADMIN_USERNAME` / `ADMIN_PASSWORD` | `docs/tests/.env` | Smoke tests |

Never log environment variables. Never return them in API responses.

---

## 3. Authentication and authorization

- All API routes are protected by `JwtAuthGuard` + `PermissionsGuard` by default.
- Never bypass guards with `@Public()` on sensitive routes.
- Role separation is enforced by route prefix: `super_admin` → `/admin/*`, `admin_municipality` → `/dashboard/*` and `/tfd/*`.
- JWT tokens must not carry sensitive PII beyond what's needed (current payload: `sub`, `organizationId`, `roles`, `permissions`).
- Token expiration must be set (`JWT_EXPIRATION`). Never use non-expiring tokens in production.
- OTP codes expire in 15 minutes and are single-use. Previous OTP codes for the same principal are invalidated on new request.
- Passwords are hashed with bcryptjs (10 salt rounds). Never store plain-text passwords.

---

## 4. Input validation

- All incoming DTOs must use `class-validator` decorators (`@IsString()`, `@IsUUID()`, `@IsEnum()`, etc.).
- Never pass raw request body directly to a repository or query builder.
- UUIDs from route params must be validated as UUIDs before use in queries — an invalid UUID will crash TypeORM with a `string_to_uuid` error if not guarded.

```typescript
// Always guard against empty/invalid organizationId before using in queries
if (!organizationId) {
  throw new NotFoundException('...');
}
```

---

## 5. SQL / injection

- Use TypeORM query builder with named parameters — never string interpolation in queries.

```typescript
// Correct
.where('tfd.municipality_id = :id', { id: municipality.id })

// Wrong — SQL injection risk
.where(`tfd.municipality_id = '${id}'`)
```

---

## 6. CORS

- `CORS_ORIGIN` must be set to the exact frontend URL in production (e.g. `https://govmunicipio.vercel.app`).
- Never use `*` as CORS origin in production.

---

## 7. Error responses

- Never expose stack traces, internal error details, or DB error messages to the client.
- NestJS default exception filter already strips these — do not override it with verbose errors.
- Log errors server-side (Railway logs) but return only generic messages like `"Internal server error"`.

---

## 8. Dependency security

```bash
# Audit dependencies for known vulnerabilities
pnpm audit

# Update packages with patches
pnpm update --recursive
```

Review `pnpm audit` output before every production deploy.
