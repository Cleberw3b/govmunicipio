# Assign Organization to User — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Allow super_admin to assign or remove a user's organization via a searchable combobox in the edit user modal.

**Architecture:** The API receives an optional `organizationId` field on PATCH `/admin/users/:id` and updates both the OneToOne `organization` FK and the ManyToMany `organizations` join table. The frontend adds a shadcn Combobox (Command + Popover) that lazy-loads municipalities from `/admin/municipalities` and sends `organizationId` in the PATCH body only when the value changed.

**Tech Stack:** NestJS (class-validator), TypeORM transactions, React, shadcn/ui (Command + Popover), cmdk, Tailwind CSS.

---

## Context

- Design doc: `docs/plans/2026-02-20-assign-user-org-design.md`
- API: `apps/api/src/admin/`
- Frontend: `apps/web/src/app/admin/users/page.tsx`
- `PrincipalEntity` has two org-related fields:
  - `organization` (OneToOne → `organization_id` FK on `principal` table)
  - `organizations` (ManyToMany → `principal_organization` join table)
- `GET /admin/municipalities` returns `MunicipalityEntity[]` with `organization.address` eager relation. Used to populate combobox options. Value stored = `organization.id` (not municipality.id).
- No existing test infrastructure for admin module — verify manually with curl.

---

### Task 1: API — Add `organizationId` to UpdateUserDto

**Files:**
- Modify: `apps/api/src/admin/dto/update-user.dto.ts`

**Step 1: Open the file and view current contents**

File currently at `apps/api/src/admin/dto/update-user.dto.ts`:
```typescript
import {
  IsString,
  IsOptional,
  IsBoolean,
  IsArray,
  MinLength,
} from 'class-validator';

export class UpdateUserDto {
  @IsOptional() @IsString() username?: string;
  @IsOptional() @IsString() @MinLength(8) password?: string;
  @IsOptional() @IsString() firstName?: string;
  @IsOptional() @IsString() lastName?: string;
  @IsOptional() @IsString() cpf?: string;
  @IsOptional() @IsBoolean() isActive?: boolean;
  @IsOptional() @IsArray() @IsString({ each: true }) roles?: string[];
}
```

**Step 2: Replace the file with the updated DTO**

Replace entire content with:
```typescript
import {
  IsString,
  IsOptional,
  IsBoolean,
  IsArray,
  IsUUID,
  ValidateIf,
  MinLength,
} from 'class-validator';

export class UpdateUserDto {
  @IsOptional() @IsString() username?: string;
  @IsOptional() @IsString() @MinLength(8) password?: string;
  @IsOptional() @IsString() firstName?: string;
  @IsOptional() @IsString() lastName?: string;
  @IsOptional() @IsString() cpf?: string;
  @IsOptional() @IsBoolean() isActive?: boolean;
  @IsOptional() @IsArray() @IsString({ each: true }) roles?: string[];

  @IsOptional()
  @ValidateIf((o) => o.organizationId !== null)
  @IsUUID()
  organizationId?: string | null;
}
```

Semantics:
- `undefined` → no change (field absent in PATCH body)
- `null` → remove organization from user
- UUID string → assign user to that organization

**Step 3: Commit**

```bash
cd /Users/cleberw3b/zPessoalCode/govmunicipio
git add apps/api/src/admin/dto/update-user.dto.ts
git commit -m "feat(api): add organizationId to UpdateUserDto"
```

---

### Task 2: API — Handle `organizationId` in AdminService.updateUser

**Files:**
- Modify: `apps/api/src/admin/admin.service.ts` (lines 162–224)

**Step 1: Locate the `updateUser` method**

Find the `if (dto.roles !== undefined)` block at approximately line 202 in `apps/api/src/admin/admin.service.ts`. After the closing `}` of that block (still inside `this.dataSource.transaction(async (manager) => {`), add the org block before the closing of the transaction callback.

**Step 2: Add the organizationId block inside the transaction**

Inside the transaction callback (after the roles block, before the closing `});`), add:

```typescript
      if (dto.organizationId !== undefined) {
        const p = await manager.findOne(PrincipalEntity, {
          where: { id },
          relations: { organizations: true },
        });
        if (!p) throw new NotFoundException(`User ${id} not found`);

        if (dto.organizationId === null) {
          p.organization = null;
          p.organizations = [];
        } else {
          const org = await manager.findOne(OrganizationEntity, {
            where: { id: dto.organizationId },
          });
          if (!org) {
            throw new NotFoundException(
              `Organization ${dto.organizationId} not found`,
            );
          }
          p.organization = org;
          p.organizations = [org];
        }
        await manager.save(p);
      }
```

The `OrganizationEntity` is already imported at line 14. No new imports needed.

**Step 3: Verify the full transaction block looks correct**

After the edit, the full transaction callback should contain these blocks in order:
1. `personUpdates` (firstName, lastName)
2. CPF update (PersonIdentificationEntity)
3. `principalUpdates` (username, isActive, password)
4. Roles update
5. **New:** organizationId update

**Step 4: Manual verification (after Task 3 frontend is done — or via curl now)**

Test null (remove org):
```bash
curl -s -X PATCH http://localhost:3001/api/v1/admin/users/<USER_ID> \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"organizationId": null}' | jq '.organizations'
# Expected: []
```

Test assign org:
```bash
curl -s -X PATCH http://localhost:3001/api/v1/admin/users/<USER_ID> \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"organizationId": "<VALID_ORG_ID>"}' | jq '.organizations[0].name'
# Expected: "<org name>"
```

**Step 5: Commit**

```bash
git add apps/api/src/admin/admin.service.ts
git commit -m "feat(api): handle organizationId in updateUser — assign/remove org"
```

---

### Task 3: Frontend — Install shadcn command + popover components

**Files:**
- Create: `apps/web/src/components/ui/command.tsx` (generated by shadcn)
- Create: `apps/web/src/components/ui/popover.tsx` (generated by shadcn)

**Step 1: Install the shadcn components**

Run from the repo root:
```bash
cd /Users/cleberw3b/zPessoalCode/govmunicipio
pnpm dlx shadcn@latest add command popover --cwd apps/web
```

If prompted for overwrite of existing files, choose yes.

**Step 2: Verify files were created**

```bash
ls apps/web/src/components/ui/command.tsx apps/web/src/components/ui/popover.tsx
```

Expected: both files exist.

**Step 3: Commit**

```bash
git add apps/web/src/components/ui/command.tsx apps/web/src/components/ui/popover.tsx
git commit -m "feat(web): add shadcn command and popover components"
```

---

### Task 4: Frontend — Add org combobox to edit user modal

**Files:**
- Modify: `apps/web/src/app/admin/users/page.tsx`

**Step 1: Replace the entire file with the updated version**

Replace `apps/web/src/app/admin/users/page.tsx` with:

```tsx
'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Check, ChevronsUpDown, Pencil } from 'lucide-react';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from '@/components/ui/command';
import {
  Popover, PopoverContent, PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { apiClient } from '@/lib/api';

interface Principal {
  id: string;
  username: string;
  isActive: boolean;
  person: { firstName: string; lastName: string; identification?: { cpf: string } } | null;
  roles: { name: string }[];
  organizations: { id: string; name: string }[];
}

interface MunicipalityResponse {
  id: string;
  state: string;
  organization: {
    id: string;
    name: string;
    address: { city: string; state: string } | null;
  };
}

const ROLE_LABELS: Record<string, string> = {
  super_admin: 'Super Admin',
  admin_municipality: 'Admin Municipal',
  operator_tfd: 'Operador TFD',
  viewer: 'Visualizador',
};

const ALL_ROLES = ['super_admin', 'admin_municipality', 'operator_tfd', 'viewer'];

interface EditForm {
  username: string;
  password: string;
  firstName: string;
  lastName: string;
  cpf: string;
  isActive: boolean;
  roles: string[];
  organizationId: string | null;
}

export default function UsersPage() {
  const [users, setUsers] = useState<Principal[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Principal | null>(null);
  const [form, setForm] = useState<EditForm | null>(null);
  const [saving, setSaving] = useState(false);
  const [municipalities, setMunicipalities] = useState<{ orgId: string; label: string }[]>([]);
  const [comboOpen, setComboOpen] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    return apiClient<Principal[]>('/admin/users')
      .then(setUsers)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  function openEdit(u: Principal) {
    setEditing(u);
    setForm({
      username: u.username,
      password: '',
      firstName: u.person?.firstName ?? '',
      lastName: u.person?.lastName ?? '',
      cpf: u.person?.identification?.cpf ?? '',
      isActive: u.isActive,
      roles: u.roles.map((r) => r.name),
      organizationId: u.organizations[0]?.id ?? null,
    });
    if (municipalities.length === 0) {
      apiClient<MunicipalityResponse[]>('/admin/municipalities')
        .then((data) =>
          setMunicipalities(
            data.map((m) => ({
              orgId: m.organization.id,
              label: `${m.organization.name} — ${m.organization.address?.city ?? ''}/${m.state}`,
            })),
          ),
        )
        .catch(console.error);
    }
  }

  function updateField(field: keyof EditForm) {
    return (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((prev) => prev ? { ...prev, [field]: e.target.type === 'checkbox' ? e.target.checked : e.target.value } : prev);
  }

  function toggleRole(role: string) {
    setForm((prev) => {
      if (!prev) return prev;
      const roles = prev.roles.includes(role)
        ? prev.roles.filter((r) => r !== role)
        : [...prev.roles, role];
      return { ...prev, roles };
    });
  }

  async function handleSave() {
    if (!editing || !form) return;
    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        username: form.username,
        firstName: form.firstName,
        lastName: form.lastName,
        cpf: form.cpf,
        isActive: form.isActive,
        roles: form.roles,
      };
      if (form.password) body.password = form.password;
      const originalOrgId = editing.organizations[0]?.id ?? null;
      if (form.organizationId !== originalOrgId) {
        body.organizationId = form.organizationId;
      }
      await apiClient(`/admin/users/${editing.id}`, {
        method: 'PATCH',
        body: JSON.stringify(body),
      });
      toast.success('Usuário atualizado!');
      setEditing(null);
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao atualizar');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Usuários</h1>
        <p className="text-muted-foreground">{users.length} usuário(s) cadastrado(s)</p>
      </div>

      {loading ? (
        <p className="text-muted-foreground">Carregando...</p>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Usuário</TableHead>
                <TableHead>Nome</TableHead>
                <TableHead>Roles</TableHead>
                <TableHead>Organização</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-16" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((u) => (
                <TableRow key={u.id}>
                  <TableCell className="font-mono font-medium">{u.username}</TableCell>
                  <TableCell>
                    {u.person ? `${u.person.firstName} ${u.person.lastName}` : '—'}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {u.roles.map((r) => (
                        <Badge key={r.name} variant="outline">
                          {ROLE_LABELS[r.name] ?? r.name}
                        </Badge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell>
                    {u.organizations.length > 0 ? (
                      u.organizations[0].name
                    ) : (
                      <span className="italic text-muted-foreground">Plataforma</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant={u.isActive ? 'default' : 'secondary'}>
                      {u.isActive ? 'Ativo' : 'Inativo'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Button variant="ghost" size="icon" onClick={() => openEdit(u)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={!!editing} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Editar Usuário</DialogTitle>
          </DialogHeader>
          {form && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Nome</Label>
                  <Input value={form.firstName} onChange={updateField('firstName')} />
                </div>
                <div className="space-y-2">
                  <Label>Sobrenome</Label>
                  <Input value={form.lastName} onChange={updateField('lastName')} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>CPF</Label>
                <Input value={form.cpf} onChange={updateField('cpf')} placeholder="000.000.000-00" />
              </div>
              <div className="space-y-2">
                <Label>Nome de Usuário</Label>
                <Input value={form.username} onChange={updateField('username')} />
              </div>
              <div className="space-y-2">
                <Label>Nova Senha (deixe em branco para manter)</Label>
                <Input type="password" value={form.password} onChange={updateField('password')} />
              </div>
              <div className="space-y-2">
                <Label>Roles</Label>
                <div className="flex flex-wrap gap-3">
                  {ALL_ROLES.map((role) => (
                    <label key={role} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={form.roles.includes(role)}
                        onChange={() => toggleRole(role)}
                        className="h-4 w-4"
                      />
                      {ROLE_LABELS[role]}
                    </label>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <Label>Organização</Label>
                <Popover open={comboOpen} onOpenChange={setComboOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={comboOpen}
                      className="w-full justify-between font-normal"
                    >
                      {form.organizationId
                        ? municipalities.find((m) => m.orgId === form.organizationId)?.label ?? 'Carregando...'
                        : 'Sem organização'}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0">
                    <Command>
                      <CommandInput placeholder="Buscar município..." />
                      <CommandList>
                        <CommandEmpty>Nenhum município encontrado.</CommandEmpty>
                        <CommandGroup>
                          <CommandItem
                            value="__none__"
                            onSelect={() => {
                              setForm((prev) => prev ? { ...prev, organizationId: null } : prev);
                              setComboOpen(false);
                            }}
                          >
                            <Check
                              className={cn('mr-2 h-4 w-4', form.organizationId === null ? 'opacity-100' : 'opacity-0')}
                            />
                            Sem organização
                          </CommandItem>
                          {municipalities.map((m) => (
                            <CommandItem
                              key={m.orgId}
                              value={m.label}
                              onSelect={() => {
                                setForm((prev) => prev ? { ...prev, organizationId: m.orgId } : prev);
                                setComboOpen(false);
                              }}
                            >
                              <Check
                                className={cn('mr-2 h-4 w-4', form.organizationId === m.orgId ? 'opacity-100' : 'opacity-0')}
                              />
                              {m.label}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="userActive"
                  checked={form.isActive}
                  onChange={updateField('isActive')}
                  className="h-4 w-4"
                />
                <Label htmlFor="userActive">Usuário ativo</Label>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? 'Salvando...' : 'Salvar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
```

Key changes from the previous version:
- Added `id` to `Principal.organizations` type
- Added `MunicipalityResponse` interface (matches what `/admin/municipalities` returns)
- Added `organizationId: string | null` to `EditForm`
- Added `municipalities` + `comboOpen` state
- `openEdit` now pre-populates `organizationId` and lazy-fetches municipalities
- Added Combobox (Popover + Command) UI section for "Organização"
- `handleSave` sends `organizationId` only when it changed from original

**Step 2: Verify the build compiles**

```bash
cd /Users/cleberw3b/zPessoalCode/govmunicipio
pnpm turbo build --filter=@govmunicipio/web
```

Expected: build succeeds with no TypeScript errors.

If there are TypeScript errors, common causes:
- Missing import: check that `Command`, `CommandEmpty`, `CommandGroup`, `CommandInput`, `CommandItem`, `CommandList` are exported from `@/components/ui/command`
- Missing import: check that `Popover`, `PopoverContent`, `PopoverTrigger` are exported from `@/components/ui/popover`

**Step 3: Commit**

```bash
git add apps/web/src/app/admin/users/page.tsx
git commit -m "feat(web): add org combobox to edit user modal"
```

---

### Task 5: Local verification before deploy

**Step 1: Start local stack**

```bash
cd /Users/cleberw3b/zPessoalCode/govmunicipio
docker compose up -d
```

**Step 2: Start API**

```bash
pnpm turbo dev --filter=@govmunicipio/api
```

**Step 3: Start web**

In a separate terminal:
```bash
pnpm turbo dev --filter=@govmunicipio/web
```

**Step 4: Manual test in browser**

1. Go to `http://localhost:3000/auth/login`, login as `superadmin` / `superadmin123`
2. Navigate to `/admin/users`
3. Click pencil on any user
4. Verify "Organização" combobox appears with municipalities listed
5. Type in the search box to filter — options filter client-side
6. Select "Sem organização" for a user that has an org → save → verify org column shows "Plataforma"
7. Select a municipality for a user with no org → save → verify org column shows org name
8. Open the same user again → verify selected org is pre-populated in the combobox

**Step 5: Deploy to Railway + Vercel**

```bash
railway up --service api --detach
vercel --prod
```
