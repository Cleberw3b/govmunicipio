# Super Admin & Municipality Management Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a `superadmin` seed user and a self-contained admin area (`/admin`) for creating municipalities and their first administrator in a single atomic operation.

**Architecture:** NestJS `admin` module with `RolesGuard('super_admin')` protecting all routes; atomic `POST /admin/municipalities` transaction that creates Organization + Municipality + Address + Person + Principal in one DB transaction. Frontend `/admin` route group with its own layout that verifies `super_admin` role from JWT before rendering.

**Tech Stack:** NestJS 11, TypeORM 0.3, class-validator, Next.js 16 App Router, React 19, shadcn/ui, Tailwind v4.

---

## Task 1: Update Seed — New Permissions + Superadmin Principal

**Files:**
- Modify: `apps/api/src/database/seeds/seed.ts`

**Context:** The seed already creates `super_admin`, `admin_municipality`, `operator_tfd`, and `viewer` roles. The `super_admin` role gets `permissions = all`. We need to:
1. Add 4 new permissions: `municipality:create`, `municipality:read`, `principal:create`, `principal:read`
2. Create a second `Principal` with username `superadmin`, role `super_admin`, and `organization = null`

**Step 1: Add new permissions to the permissionsData array**

In `apps/api/src/database/seeds/seed.ts`, locate the `permissionsData` array (around line 63) and add 4 entries after the last existing one:

```typescript
// After { resource: 'person', action: 'update', ... }
{
  resource: 'municipality',
  action: 'create',
  description: 'Criar municipio',
},
{
  resource: 'municipality',
  action: 'read',
  description: 'Visualizar municipios',
},
{
  resource: 'principal',
  action: 'create',
  description: 'Criar principal/usuario',
},
{
  resource: 'principal',
  action: 'read',
  description: 'Visualizar principals/usuarios',
},
```

**Step 2: Add superadmin Person + Principal at the end of the seed (after the admin principal block, step 14)**

```typescript
// -------------------------------------------------------
// 15. Superadmin Principal (platform-level, no organization)
// -------------------------------------------------------
const superadminPerson = await personRepo.save(
  personRepo.create({
    firstName: 'Super',
    lastName: 'Admin',
    gender: Gender.NOT_INFORMED,
  }),
);
await identificationRepo.save(
  identificationRepo.create({
    cpf: '999.999.999-99',
    dateOfBirth: '1990-01-01' as unknown as Date,
    person: superadminPerson,
  }),
);

const superadminPasswordHash = await bcrypt.hash('superadmin123', 10);
const superadminPrincipal = principalRepo.create({
  username: 'superadmin',
  passwordHash: superadminPasswordHash,
  isActive: true,
  person: superadminPerson,
  organization: null,
});
superadminPrincipal.roles = [superAdmin];
superadminPrincipal.organizations = [];
await principalRepo.save(superadminPrincipal);
console.log(`Seeded principal: ${superadminPrincipal.username}`);
```

**Step 3: Verify seed compiles**

```bash
cd apps/api && npx tsc --noEmit
```

Expected: no errors.

**Step 4: Commit**

```bash
git add apps/api/src/database/seeds/seed.ts
git commit -m "feat: add municipality/principal permissions and superadmin seed"
```

---

## Task 2: Create Admin Module — DTO

**Files:**
- Create: `apps/api/src/admin/dto/create-municipality.dto.ts`

**Context:** The DTO needs nested objects validated with class-validator. Install note: `class-validator` and `class-transformer` are already installed in the API.

**Step 1: Create DTO file**

```typescript
// apps/api/src/admin/dto/create-municipality.dto.ts
import { Type } from 'class-transformer';
import {
  IsString,
  IsNotEmpty,
  MinLength,
  ValidateNested,
  IsOptional,
  Length,
  Matches,
} from 'class-validator';

export class MunicipalityDataDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsString()
  @IsNotEmpty()
  @Matches(/^\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}$/, {
    message: 'cnpj must be in format XX.XXX.XXX/XXXX-XX',
  })
  cnpj!: string;

  @IsString()
  @IsNotEmpty()
  ibgeCode!: string;

  @IsString()
  @Length(2, 2)
  state!: string;

  @IsString()
  @IsNotEmpty()
  city!: string;

  @IsString()
  @IsNotEmpty()
  street!: string;

  @IsString()
  @IsNotEmpty()
  number!: string;

  @IsString()
  @IsOptional()
  neighborhood?: string;

  @IsString()
  @IsOptional()
  zipCode?: string;
}

export class AdminDataDto {
  @IsString()
  @IsNotEmpty()
  username!: string;

  @IsString()
  @MinLength(8)
  password!: string;

  @IsString()
  @IsNotEmpty()
  firstName!: string;

  @IsString()
  @IsNotEmpty()
  lastName!: string;

  @IsString()
  @IsNotEmpty()
  cpf!: string;
}

export class CreateMunicipalityDto {
  @ValidateNested()
  @Type(() => MunicipalityDataDto)
  municipality!: MunicipalityDataDto;

  @ValidateNested()
  @Type(() => AdminDataDto)
  admin!: AdminDataDto;
}
```

**Step 2: Verify DTO compiles**

```bash
cd apps/api && npx tsc --noEmit
```

**Step 3: Commit**

```bash
git add apps/api/src/admin/
git commit -m "feat: add admin module DTO for municipality creation"
```

---

## Task 3: Create Admin Service

**Files:**
- Create: `apps/api/src/admin/admin.service.ts`

**Context:** The service performs an atomic transaction using TypeORM's `DataSource.transaction()`. Look at how `seed.ts` uses `queryRunner` for the pattern. The service must hash the password with bcrypt and assign the `admin_municipality` role.

**Step 1: Create service file**

```typescript
// apps/api/src/admin/admin.service.ts
import {
  Injectable,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { InjectDataSource } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { Gender } from '@govmunicipio/shared';
import {
  AddressEntity,
  OrganizationEntity,
  MunicipalityEntity,
  PersonEntity,
  PersonIdentificationEntity,
  PrincipalEntity,
  RoleEntity,
} from '../entities';
import { CreateMunicipalityDto } from './dto/create-municipality.dto';

@Injectable()
export class AdminService {
  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,

    @InjectRepository(MunicipalityEntity)
    private readonly municipalityRepository: Repository<MunicipalityEntity>,

    @InjectRepository(PrincipalEntity)
    private readonly principalRepository: Repository<PrincipalEntity>,

    @InjectRepository(RoleEntity)
    private readonly roleRepository: Repository<RoleEntity>,
  ) {}

  async findAllMunicipalities(): Promise<MunicipalityEntity[]> {
    return this.municipalityRepository.find({
      relations: { organization: { address: true } },
      order: { createdAt: 'DESC' },
    });
  }

  async findMunicipalityById(id: string): Promise<MunicipalityEntity> {
    const municipality = await this.municipalityRepository.findOne({
      where: { id },
      relations: { organization: { address: true, contacts: true } },
    });
    if (!municipality) {
      throw new NotFoundException(`Municipality ${id} not found`);
    }
    return municipality;
  }

  async findAllUsers(): Promise<PrincipalEntity[]> {
    return this.principalRepository.find({
      relations: { roles: true, organizations: true, person: true },
      order: { createdAt: 'DESC' },
    });
  }

  async createMunicipalityWithAdmin(
    dto: CreateMunicipalityDto,
  ): Promise<MunicipalityEntity> {
    // Check for conflicts before starting transaction
    const existingOrg = await this.dataSource
      .getRepository(OrganizationEntity)
      .findOne({ where: { cnpj: dto.municipality.cnpj } });
    if (existingOrg) {
      throw new ConflictException(
        `Organization with CNPJ ${dto.municipality.cnpj} already exists`,
      );
    }

    const existingPrincipal = await this.principalRepository.findOne({
      where: { username: dto.admin.username },
    });
    if (existingPrincipal) {
      throw new ConflictException(
        `Username ${dto.admin.username} already exists`,
      );
    }

    const adminRole = await this.roleRepository.findOne({
      where: { name: 'admin_municipality' },
    });
    if (!adminRole) {
      throw new NotFoundException('Role admin_municipality not found in DB');
    }

    const passwordHash = await bcrypt.hash(dto.admin.password, 10);

    return this.dataSource.transaction(async (manager) => {
      // 1. Address
      const address = await manager.save(
        manager.create(AddressEntity, {
          street: dto.municipality.street,
          number: dto.municipality.number,
          neighborhood: dto.municipality.neighborhood,
          city: dto.municipality.city,
          state: dto.municipality.state,
          zipCode: dto.municipality.zipCode,
        }),
      );

      // 2. Organization
      const organization = await manager.save(
        manager.create(OrganizationEntity, {
          name: dto.municipality.name,
          cnpj: dto.municipality.cnpj,
          isActive: true,
          address,
        }),
      );

      // 3. Municipality
      const municipality = await manager.save(
        manager.create(MunicipalityEntity, {
          ibgeCode: dto.municipality.ibgeCode,
          state: dto.municipality.state,
          organization,
        }),
      );

      // 4. Person
      const person = await manager.save(
        manager.create(PersonEntity, {
          firstName: dto.admin.firstName,
          lastName: dto.admin.lastName,
          gender: Gender.NOT_INFORMED,
        }),
      );

      // 5. PersonIdentification
      await manager.save(
        manager.create(PersonIdentificationEntity, {
          cpf: dto.admin.cpf,
          dateOfBirth: '1990-01-01' as unknown as Date,
          person,
        }),
      );

      // 6. Principal
      const principal = manager.create(PrincipalEntity, {
        username: dto.admin.username,
        passwordHash,
        isActive: true,
        person,
        organization,
      });
      principal.roles = [adminRole];
      principal.organizations = [organization];
      await manager.save(principal);

      return municipality;
    });
  }
}
```

**Step 2: Verify compiles**

```bash
cd apps/api && npx tsc --noEmit
```

**Step 3: Commit**

```bash
git add apps/api/src/admin/admin.service.ts
git commit -m "feat: add AdminService with municipality + admin creation transaction"
```

---

## Task 4: Create Admin Controller + Module

**Files:**
- Create: `apps/api/src/admin/admin.controller.ts`
- Create: `apps/api/src/admin/admin.module.ts`
- Modify: `apps/api/src/app.module.ts`

**Step 1: Create controller**

```typescript
// apps/api/src/admin/admin.controller.ts
import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { AdminService } from './admin.service';
import { CreateMunicipalityDto } from './dto/create-municipality.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { MunicipalityEntity } from '../entities';
import { PrincipalEntity } from '../entities';

@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('super_admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('municipalities')
  findAllMunicipalities(): Promise<MunicipalityEntity[]> {
    return this.adminService.findAllMunicipalities();
  }

  @Get('municipalities/:id')
  findMunicipality(@Param('id') id: string): Promise<MunicipalityEntity> {
    return this.adminService.findMunicipalityById(id);
  }

  @Post('municipalities')
  @HttpCode(HttpStatus.CREATED)
  createMunicipality(
    @Body() dto: CreateMunicipalityDto,
  ): Promise<MunicipalityEntity> {
    return this.adminService.createMunicipalityWithAdmin(dto);
  }

  @Get('users')
  findAllUsers(): Promise<PrincipalEntity[]> {
    return this.adminService.findAllUsers();
  }
}
```

**Step 2: Create module**

```typescript
// apps/api/src/admin/admin.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import {
  MunicipalityEntity,
  PrincipalEntity,
  RoleEntity,
} from '../entities';

@Module({
  imports: [
    TypeOrmModule.forFeature([MunicipalityEntity, PrincipalEntity, RoleEntity]),
  ],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}
```

**Step 3: Register AdminModule in AppModule**

In `apps/api/src/app.module.ts`, add the import:

```typescript
import { AdminModule } from './admin/admin.module';

// In @Module({ imports: [...] }) add:
AdminModule,
```

**Step 4: Verify full build**

```bash
cd apps/api && npx tsc --noEmit
```

Expected: no errors.

**Step 5: Manual smoke test (requires running DB)**

If you have the API running locally:

```bash
# Login as superadmin
TOKEN=$(curl -s -X POST http://localhost:3001/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"superadmin","password":"superadmin123"}' \
  | jq -r '.accessToken')

# List municipalities
curl -s http://localhost:3001/admin/municipalities \
  -H "Authorization: Bearer $TOKEN" | jq .

# Create municipality + admin
curl -s -X POST http://localhost:3001/admin/municipalities \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "municipality": {
      "name": "Prefeitura de Lauro de Freitas",
      "cnpj": "13.927.815/0001-40",
      "ibgeCode": "2919207",
      "state": "BA",
      "city": "Lauro de Freitas",
      "street": "Rua Dois",
      "number": "s/n",
      "neighborhood": "Centro"
    },
    "admin": {
      "username": "admin_lauro",
      "password": "admin1234",
      "firstName": "Joao",
      "lastName": "Souza",
      "cpf": "555.555.555-55"
    }
  }' | jq .
```

**Step 6: Commit**

```bash
git add apps/api/src/admin/ apps/api/src/app.module.ts
git commit -m "feat: add Admin module with municipalities and users endpoints"
```

---

## Task 5: Frontend — Admin Layout

**Files:**
- Create: `apps/web/src/app/admin/layout.tsx`
- Create: `apps/web/src/lib/admin-auth.ts`

**Context:** The admin layout must check that the logged-in user has `super_admin` in their JWT roles. The JWT payload is stored in localStorage as `govmunicipio_principal` (see `apps/web/src/lib/auth.ts`).

**Step 1: Check how auth stores the principal**

Read `apps/web/src/lib/auth.ts` to understand the localStorage key. The principal object stored includes `roles: string[]`.

**Step 2: Create `admin-auth.ts` helper**

```typescript
// apps/web/src/lib/admin-auth.ts
export function isSuperAdmin(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const raw = localStorage.getItem('govmunicipio_principal');
    if (!raw) return false;
    const principal = JSON.parse(raw) as { roles?: string[] };
    return Array.isArray(principal.roles) && principal.roles.includes('super_admin');
  } catch {
    return false;
  }
}
```

**Step 3: Create admin layout**

```tsx
// apps/web/src/app/admin/layout.tsx
'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { Building2, Users, LayoutDashboard, LogOut, ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { isAuthenticated, logout } from '@/lib/auth';
import { isSuperAdmin } from '@/lib/admin-auth';

const adminNav = [
  { name: 'Municípios', href: '/admin/municipalities', icon: Building2 },
  { name: 'Usuários', href: '/admin/users', icon: Users },
];

function AdminSidebar({ pathname }: { pathname: string }) {
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 px-4 py-5">
        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-destructive text-destructive-foreground">
          <ShieldAlert className="h-4 w-4" />
        </div>
        <div>
          <p className="text-sm font-semibold leading-none">GovMunicípio</p>
          <p className="text-xs text-muted-foreground">Administração</p>
        </div>
      </div>

      <Separator />

      <nav className="flex-1 space-y-1 px-3 py-4">
        {adminNav.map((item) => {
          const isActive = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-accent text-accent-foreground'
                  : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
              }`}
            >
              <item.icon className="h-4 w-4" />
              {item.name}
            </Link>
          );
        })}
      </nav>

      <Separator />

      <div className="px-4 py-4 space-y-2">
        <Link href="/dashboard" className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground">
          <LayoutDashboard className="h-3 w-3" />
          Voltar ao sistema
        </Link>
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start"
          onClick={() => logout()}
        >
          <LogOut className="h-4 w-4" />
          Sair
        </Button>
      </div>
    </div>
  );
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    if (!isAuthenticated() || !isSuperAdmin()) {
      router.push('/dashboard');
      return;
    }
    setMounted(true);
  }, [router]);

  if (!mounted) return null;

  return (
    <div className="flex h-screen">
      <aside className="hidden w-64 shrink-0 border-r bg-card md:block">
        <AdminSidebar pathname={pathname} />
      </aside>
      <main className="flex-1 overflow-y-auto p-6">{children}</main>
    </div>
  );
}
```

**Step 4: Create admin index page (redirect)**

```tsx
// apps/web/src/app/admin/page.tsx
import { redirect } from 'next/navigation';

export default function AdminPage() {
  redirect('/admin/municipalities');
}
```

**Step 5: Update `apps/web/src/middleware.ts` to also allow `/admin` routes through**

Read `apps/web/src/middleware.ts` first. If it currently redirects `/` to `/dashboard`, it should not interfere with `/admin`. Add `/admin` to the list of protected paths if needed, or verify it doesn't block it.

**Step 6: Commit**

```bash
git add apps/web/src/app/admin/ apps/web/src/lib/admin-auth.ts
git commit -m "feat: add admin layout with super_admin guard and sidebar"
```

---

## Task 6: Frontend — Municipalities List Page

**Files:**
- Create: `apps/web/src/app/admin/municipalities/page.tsx`

**Context:** Calls `GET /admin/municipalities`. The `apiClient` in `apps/web/src/lib/api.ts` handles the JWT header automatically.

**Step 1: Create the page**

```tsx
// apps/web/src/app/admin/municipalities/page.tsx
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { apiClient } from '@/lib/api';

interface Municipality {
  id: string;
  ibgeCode: string;
  state: string;
  organization: {
    name: string;
    cnpj: string;
    isActive: boolean;
    address: { city: string } | null;
  };
}

export default function MunicipalitiesPage() {
  const [municipalities, setMunicipalities] = useState<Municipality[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiClient<Municipality[]>('/admin/municipalities')
      .then(setMunicipalities)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Municípios</h1>
          <p className="text-muted-foreground">
            {municipalities.length} município(s) cadastrado(s)
          </p>
        </div>
        <Button asChild>
          <Link href="/admin/municipalities/new">
            <Plus className="mr-2 h-4 w-4" />
            Novo Município
          </Link>
        </Button>
      </div>

      {loading ? (
        <p className="text-muted-foreground">Carregando...</p>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>CNPJ</TableHead>
                <TableHead>Cidade/UF</TableHead>
                <TableHead>Cód. IBGE</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {municipalities.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground">
                    Nenhum município cadastrado
                  </TableCell>
                </TableRow>
              ) : (
                municipalities.map((m) => (
                  <TableRow key={m.id}>
                    <TableCell className="font-medium">{m.organization.name}</TableCell>
                    <TableCell>{m.organization.cnpj}</TableCell>
                    <TableCell>
                      {m.organization.address?.city ?? '—'}/{m.state}
                    </TableCell>
                    <TableCell>{m.ibgeCode}</TableCell>
                    <TableCell>
                      <Badge variant={m.organization.isActive ? 'default' : 'secondary'}>
                        {m.organization.isActive ? 'Ativo' : 'Inativo'}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add apps/web/src/app/admin/municipalities/page.tsx
git commit -m "feat: add municipalities list page for admin area"
```

---

## Task 7: Frontend — New Municipality Form (2-step)

**Files:**
- Create: `apps/web/src/app/admin/municipalities/new/page.tsx`

**Step 1: Create the 2-step form page**

```tsx
// apps/web/src/app/admin/municipalities/new/page.tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { apiClient } from '@/lib/api';
import { ChevronLeft, ChevronRight, Check } from 'lucide-react';

interface MunicipalityData {
  name: string;
  cnpj: string;
  ibgeCode: string;
  state: string;
  city: string;
  street: string;
  number: string;
  neighborhood: string;
  zipCode: string;
}

interface AdminData {
  username: string;
  password: string;
  firstName: string;
  lastName: string;
  cpf: string;
}

const emptyMunicipality: MunicipalityData = {
  name: '', cnpj: '', ibgeCode: '', state: '',
  city: '', street: '', number: '', neighborhood: '', zipCode: '',
};

const emptyAdmin: AdminData = {
  username: '', password: '', firstName: '', lastName: '', cpf: '',
};

export default function NewMunicipalityPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [mData, setMData] = useState<MunicipalityData>(emptyMunicipality);
  const [aData, setAData] = useState<AdminData>(emptyAdmin);
  const [loading, setLoading] = useState(false);

  function updateM(field: keyof MunicipalityData) {
    return (e: React.ChangeEvent<HTMLInputElement>) =>
      setMData((prev) => ({ ...prev, [field]: e.target.value }));
  }

  function updateA(field: keyof AdminData) {
    return (e: React.ChangeEvent<HTMLInputElement>) =>
      setAData((prev) => ({ ...prev, [field]: e.target.value }));
  }

  async function handleSubmit() {
    setLoading(true);
    try {
      await apiClient('/admin/municipalities', {
        method: 'POST',
        body: JSON.stringify({ municipality: mData, admin: aData }),
      });
      toast.success('Município criado com sucesso!');
      router.push('/admin/municipalities');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao criar município');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Novo Município</h1>
        <div className="mt-3 flex items-center gap-3">
          {[1, 2].map((s) => (
            <div key={s} className="flex items-center gap-2">
              <div
                className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-medium ${
                  step > s
                    ? 'bg-primary text-primary-foreground'
                    : step === s
                    ? 'bg-primary text-primary-foreground'
                    : 'border border-muted-foreground text-muted-foreground'
                }`}
              >
                {step > s ? <Check className="h-3 w-3" /> : s}
              </div>
              <span className={`text-sm ${step === s ? 'font-medium' : 'text-muted-foreground'}`}>
                {s === 1 ? 'Dados do Município' : 'Administrador'}
              </span>
              {s < 2 && <div className="h-px w-8 bg-border" />}
            </div>
          ))}
        </div>
      </div>

      {step === 1 && (
        <Card>
          <CardHeader>
            <CardTitle>Dados do Município</CardTitle>
            <CardDescription>Informações da prefeitura municipal</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nome da Prefeitura</Label>
              <Input id="name" value={mData.name} onChange={updateM('name')}
                placeholder="Prefeitura Municipal de..." />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="cnpj">CNPJ</Label>
                <Input id="cnpj" value={mData.cnpj} onChange={updateM('cnpj')}
                  placeholder="XX.XXX.XXX/XXXX-XX" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ibgeCode">Código IBGE</Label>
                <Input id="ibgeCode" value={mData.ibgeCode} onChange={updateM('ibgeCode')}
                  placeholder="7 dígitos" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="city">Cidade</Label>
                <Input id="city" value={mData.city} onChange={updateM('city')} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="state">UF</Label>
                <Input id="state" value={mData.state} onChange={updateM('state')}
                  maxLength={2} placeholder="BA" />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="col-span-2 space-y-2">
                <Label htmlFor="street">Rua</Label>
                <Input id="street" value={mData.street} onChange={updateM('street')} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="number">Número</Label>
                <Input id="number" value={mData.number} onChange={updateM('number')} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="neighborhood">Bairro</Label>
                <Input id="neighborhood" value={mData.neighborhood} onChange={updateM('neighborhood')} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="zipCode">CEP</Label>
                <Input id="zipCode" value={mData.zipCode} onChange={updateM('zipCode')}
                  placeholder="00000-000" />
              </div>
            </div>
            <div className="flex justify-end pt-2">
              <Button onClick={() => setStep(2)}>
                Próximo <ChevronRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 2 && (
        <Card>
          <CardHeader>
            <CardTitle>Primeiro Administrador</CardTitle>
            <CardDescription>Usuário admin_municipality para este município</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="firstName">Nome</Label>
                <Input id="firstName" value={aData.firstName} onChange={updateA('firstName')} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName">Sobrenome</Label>
                <Input id="lastName" value={aData.lastName} onChange={updateA('lastName')} />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="cpf">CPF</Label>
              <Input id="cpf" value={aData.cpf} onChange={updateA('cpf')}
                placeholder="000.000.000-00" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="username">Nome de Usuário</Label>
              <Input id="username" value={aData.username} onChange={updateA('username')}
                placeholder="admin_cidade" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Senha (mínimo 8 caracteres)</Label>
              <Input id="password" type="password" value={aData.password} onChange={updateA('password')} />
            </div>
            <div className="flex justify-between pt-2">
              <Button variant="outline" onClick={() => setStep(1)}>
                <ChevronLeft className="mr-2 h-4 w-4" /> Voltar
              </Button>
              <Button onClick={handleSubmit} disabled={loading}>
                {loading ? 'Criando...' : 'Criar Município'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add apps/web/src/app/admin/municipalities/new/
git commit -m "feat: add 2-step municipality creation form"
```

---

## Task 8: Frontend — Users List Page

**Files:**
- Create: `apps/web/src/app/admin/users/page.tsx`

**Step 1: Create users list page**

```tsx
// apps/web/src/app/admin/users/page.tsx
'use client';

import { useEffect, useState } from 'react';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { apiClient } from '@/lib/api';

interface Principal {
  id: string;
  username: string;
  isActive: boolean;
  person: { firstName: string; lastName: string } | null;
  roles: { name: string }[];
  organizations: { name: string }[];
}

const ROLE_LABELS: Record<string, string> = {
  super_admin: 'Super Admin',
  admin_municipality: 'Admin Municipal',
  operator_tfd: 'Operador TFD',
  viewer: 'Visualizador',
};

export default function UsersPage() {
  const [users, setUsers] = useState<Principal[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiClient<Principal[]>('/admin/users')
      .then(setUsers)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

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
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((u) => (
                <TableRow key={u.id}>
                  <TableCell className="font-medium font-mono">{u.username}</TableCell>
                  <TableCell>
                    {u.person
                      ? `${u.person.firstName} ${u.person.lastName}`
                      : '—'}
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
                    {u.organizations.length > 0
                      ? u.organizations[0].name
                      : <span className="text-muted-foreground italic">Plataforma</span>}
                  </TableCell>
                  <TableCell>
                    <Badge variant={u.isActive ? 'default' : 'secondary'}>
                      {u.isActive ? 'Ativo' : 'Inativo'}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add apps/web/src/app/admin/users/page.tsx
git commit -m "feat: add users list page for admin area"
```

---

## Task 9: Final Build Check + Deploy

**Step 1: Verify API TypeScript build**

```bash
cd apps/api && npx tsc --noEmit
```

**Step 2: Verify web TypeScript build**

```bash
cd apps/web && npx tsc --noEmit
```

**Step 3: Full turbo build**

```bash
cd ../.. && pnpm turbo build
```

Expected: both `@govmunicipio/api` and `@govmunicipio/web` build successfully.

**Step 4: Push to GitHub**

```bash
git push origin main
```

**Step 5: Deploy frontend to Vercel**

```bash
vercel deploy --prod --yes
```

Check deployment URL: https://govmunicipio.vercel.app/admin/municipalities

---

## Summary of New Files

```
apps/api/src/admin/
  dto/create-municipality.dto.ts
  admin.service.ts
  admin.controller.ts
  admin.module.ts

apps/web/src/app/admin/
  layout.tsx
  page.tsx
  municipalities/
    page.tsx
    new/
      page.tsx
  users/
    page.tsx

apps/web/src/lib/
  admin-auth.ts
```

## Modified Files

```
apps/api/src/database/seeds/seed.ts   ← new permissions + superadmin
apps/api/src/app.module.ts            ← register AdminModule
```
