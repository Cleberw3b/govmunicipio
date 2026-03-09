# govmunicipio — Project Guidelines

## Security

See [docs/SECURITY.md](docs/SECURITY.md) for full security guidelines.

Key rules:
- **Never hardcode credentials** — passwords, API keys, tokens, or secrets of any kind in source files, tests, or docs.
- All secrets go in `.env` files (gitignored). Document required vars in the corresponding `.env.example`.
- All API routes are protected by `JwtAuthGuard` + `PermissionsGuard`. Never bypass guards on sensitive routes.
- Use TypeORM named parameters in queries — never string interpolation.
- Always validate UUIDs from route params before passing to queries (empty string causes `string_to_uuid` crash).

## Stack

- **API**: NestJS + TypeORM + PostgreSQL (Railway)
- **Frontend**: Next.js 16 App Router + Tailwind CSS + shadcn/ui (Vercel)
- **Monorepo**: Turborepo + pnpm workspaces

## Key paths

| Path | Description |
|------|-------------|
| `apps/api/src/` | NestJS API |
| `apps/web/src/app/` | Next.js pages |
| `apps/web/src/components/ui/` | shadcn/ui components |
| `packages/shared/src/` | Shared types |

## Roles & route access

| Role | Prefix | Example |
|------|--------|---------|
| `super_admin` | `/admin/*` | `/admin/hospitals` |
| `admin_municipality` | `/dashboard/*` | `/dashboard/hospitals` |

## UI conventions

### Button sizing in table action rows

All action buttons inside table rows (`<TableCell>`) **must use the default size** — do not add `size="sm"` or `size="lg"`. This ensures consistent height across all buttons in the same row.

**Correct:**
```tsx
<Button variant="outline" onClick={...}>
  <Stethoscope className="h-4 w-4" />
  Especialidades
</Button>
<Button variant="outline" onClick={...}>
  <Pencil className="h-4 w-4" />
  Editar
</Button>
<Button variant="outline" className="border-destructive/40 text-destructive ..." onClick={...}>
  <Unlink className="h-4 w-4" />
  Desvincular
</Button>
```

**Wrong** — mixing default and `size="sm"` causes unequal heights:
```tsx
<Button variant="outline" onClick={...}>Especialidades</Button>
<Button variant="outline" size="sm" onClick={...}>Editar</Button>  {/* too short */}
```

### Exceptions where `size="sm"` is intentional

- Back/navigation links: `<Button variant="ghost" size="sm" className="-ml-2">` (compact inline nav)
- Sidebar menu items: full-width nav buttons in layouts
- Compact list items inside dialogs/popovers (e.g. "Vincular" inside a search result list)

### Destructive action buttons

Use this pattern for destructive actions (unlink, delete) in table rows:
```tsx
<Button
  variant="outline"
  className="border-destructive/40 text-destructive hover:bg-destructive hover:text-white"
  onClick={...}
>
```
