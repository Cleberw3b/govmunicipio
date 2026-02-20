# Edit Municipalities & Users Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Allow superadmin to edit municipalities and users via modal dialogs, and allow admin_municipality to manage users of their own municipality from the dashboard.

**Architecture:** Three API additions: PATCH endpoints on the existing `AdminModule`, plus a new `MunicipalityModule` scoped to `admin_municipality`. Frontend uses shadcn Dialog modals inline on the existing list pages, plus a new `/dashboard/users` page in the protected layout.

**Tech Stack:** NestJS (PATCH endpoints, class-validator DTOs), TypeORM transactions, Next.js App Router, shadcn/ui Dialog, React controlled state.

---

### Task 1: API — UpdateMunicipalityDto + PATCH /admin/municipalities/:id

**Files:**
- Create: `apps/api/src/admin/dto/update-municipality.dto.ts`
- Modify: `apps/api/src/admin/admin.service.ts`
- Modify: `apps/api/src/admin/admin.controller.ts`
- Modify: `apps/api/src/admin/admin.module.ts`

**Step 1: Create UpdateMunicipalityDto**

```typescript
// apps/api/src/admin/dto/update-municipality.dto.ts
import {
  IsString,
  IsOptional,
  IsBoolean,
  Length,
  Matches,
} from 'class-validator';

export class UpdateMunicipalityDto {
  @IsOptional() @IsString() name?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}$/, {
    message: 'cnpj must be in format XX.XXX.XXX/XXXX-XX',
  })
  cnpj?: string;

  @IsOptional() @IsString() ibgeCode?: string;
  @IsOptional() @IsString() @Length(2, 2) state?: string;
  @IsOptional() @IsString() city?: string;
  @IsOptional() @IsString() street?: string;
  @IsOptional() @IsString() number?: string;
  @IsOptional() @IsString() neighborhood?: string;
  @IsOptional() @IsString() zipCode?: string;
  @IsOptional() @IsBoolean() isActive?: boolean;
}
```

**Step 2: Add updateMunicipality to AdminService**

Add these imports at the top of `apps/api/src/admin/admin.service.ts` (merge with existing):
```typescript
import {
  AddressEntity,
  OrganizationEntity,
  PersonEntity,
  PersonIdentificationEntity,
} from '../entities';
import { UpdateMunicipalityDto } from './dto/update-municipality.dto';
```

Add this method inside `AdminService`:
```typescript
async updateMunicipality(
  id: string,
  dto: UpdateMunicipalityDto,
): Promise<MunicipalityEntity> {
  const municipality = await this.findMunicipalityById(id);

  await this.dataSource.transaction(async (manager) => {
    const addressUpdates: Partial<AddressEntity> = {};
    if (dto.street !== undefined) addressUpdates.street = dto.street;
    if (dto.number !== undefined) addressUpdates.number = dto.number;
    if (dto.neighborhood !== undefined) addressUpdates.neighborhood = dto.neighborhood;
    if (dto.city !== undefined) addressUpdates.city = dto.city;
    if (dto.state !== undefined) addressUpdates.state = dto.state;
    if (dto.zipCode !== undefined) addressUpdates.zipCode = dto.zipCode;
    if (Object.keys(addressUpdates).length > 0) {
      await manager.update(
        AddressEntity,
        { id: municipality.organization.address.id },
        addressUpdates,
      );
    }

    const orgUpdates: Partial<OrganizationEntity> = {};
    if (dto.name !== undefined) orgUpdates.name = dto.name;
    if (dto.cnpj !== undefined) orgUpdates.cnpj = dto.cnpj;
    if (dto.isActive !== undefined) orgUpdates.isActive = dto.isActive;
    if (Object.keys(orgUpdates).length > 0) {
      await manager.update(OrganizationEntity, { id: municipality.organization.id }, orgUpdates);
    }

    const mUpdates: Partial<MunicipalityEntity> = {};
    if (dto.ibgeCode !== undefined) mUpdates.ibgeCode = dto.ibgeCode;
    if (dto.state !== undefined) mUpdates.state = dto.state;
    if (Object.keys(mUpdates).length > 0) {
      await manager.update(MunicipalityEntity, { id }, mUpdates);
    }
  });

  return this.findMunicipalityById(id);
}
```

**Step 3: Add PATCH endpoint to AdminController**

Add `Patch` to the `@nestjs/common` import, add `UpdateMunicipalityDto` import, add method:
```typescript
@Patch('municipalities/:id')
updateMunicipality(
  @Param('id') id: string,
  @Body() dto: UpdateMunicipalityDto,
): Promise<MunicipalityEntity> {
  return this.adminService.updateMunicipality(id, dto);
}
```

**Step 4: Update AdminModule to include missing entities**

In `apps/api/src/admin/admin.module.ts`, the `TypeOrmModule.forFeature` array already has `[MunicipalityEntity, PrincipalEntity, RoleEntity]`. No change needed — `updateMunicipality` uses `dataSource` directly, which doesn't require extra repository registrations.

**Step 5: Test manually**
```bash
# Start API with local docker
docker compose up -d
cd apps/api && pnpm dev

# Test PATCH
curl -X PATCH http://localhost:3001/api/v1/admin/municipalities/<id> \
  -H "Authorization: Bearer <superadmin_token>" \
  -H "Content-Type: application/json" \
  -d '{"name": "Prefeitura Atualizada", "isActive": false}'
# Expected: 200 with updated municipality JSON
```

**Step 6: Commit**
```bash
git add apps/api/src/admin/dto/update-municipality.dto.ts apps/api/src/admin/admin.service.ts apps/api/src/admin/admin.controller.ts
git commit -m "feat(api): add PATCH /admin/municipalities/:id"
```

---

### Task 2: API — UpdateUserDto + PATCH /admin/users/:id

**Files:**
- Create: `apps/api/src/admin/dto/update-user.dto.ts`
- Modify: `apps/api/src/admin/admin.service.ts`
- Modify: `apps/api/src/admin/admin.controller.ts`

**Step 1: Create UpdateUserDto**

```typescript
// apps/api/src/admin/dto/update-user.dto.ts
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

**Step 2: Add updateUser to AdminService**

Add imports (merge with existing):
```typescript
import { PersonEntity, PersonIdentificationEntity } from '../entities';
import { UpdateUserDto } from './dto/update-user.dto';
```

Add method inside `AdminService`:
```typescript
async updateUser(id: string, dto: UpdateUserDto): Promise<PrincipalEntity> {
  const principal = await this.principalRepository.findOne({
    where: { id },
    relations: { person: { identification: true }, roles: true },
  });
  if (!principal) throw new NotFoundException(`User ${id} not found`);

  await this.dataSource.transaction(async (manager) => {
    const personUpdates: Partial<PersonEntity> = {};
    if (dto.firstName !== undefined) personUpdates.firstName = dto.firstName;
    if (dto.lastName !== undefined) personUpdates.lastName = dto.lastName;
    if (Object.keys(personUpdates).length > 0) {
      await manager.update(PersonEntity, { id: principal.person!.id }, personUpdates);
    }

    if (dto.cpf !== undefined && principal.person?.identification) {
      await manager.update(
        PersonIdentificationEntity,
        { id: principal.person.identification.id },
        { cpf: dto.cpf },
      );
    }

    const principalUpdates: Partial<PrincipalEntity> = {};
    if (dto.username !== undefined) principalUpdates.username = dto.username;
    if (dto.isActive !== undefined) principalUpdates.isActive = dto.isActive;
    if (dto.password) principalUpdates.passwordHash = await bcrypt.hash(dto.password, 10);
    if (Object.keys(principalUpdates).length > 0) {
      await manager.update(PrincipalEntity, { id }, principalUpdates);
    }

    if (dto.roles !== undefined) {
      const roleEntities = await this.roleRepository.findBy(
        dto.roles.map((name) => ({ name })),
      );
      const p = await manager.findOne(PrincipalEntity, {
        where: { id },
        relations: { roles: true },
      });
      p!.roles = roleEntities;
      await manager.save(p!);
    }
  });

  return this.principalRepository.findOne({
    where: { id },
    relations: { roles: true, organizations: true, person: true },
  }) as Promise<PrincipalEntity>;
}
```

**Step 3: Add PATCH endpoint to AdminController**

Add `UpdateUserDto` import, add method:
```typescript
@Patch('users/:id')
updateUser(
  @Param('id') id: string,
  @Body() dto: UpdateUserDto,
): Promise<PrincipalEntity> {
  return this.adminService.updateUser(id, dto);
}
```

**Step 4: Test manually**
```bash
curl -X PATCH http://localhost:3001/api/v1/admin/users/<id> \
  -H "Authorization: Bearer <superadmin_token>" \
  -H "Content-Type: application/json" \
  -d '{"firstName": "João", "isActive": true, "roles": ["admin_municipality"]}'
# Expected: 200 with updated user JSON
```

**Step 5: Commit**
```bash
git add apps/api/src/admin/dto/update-user.dto.ts apps/api/src/admin/admin.service.ts apps/api/src/admin/admin.controller.ts
git commit -m "feat(api): add PATCH /admin/users/:id"
```

---

### Task 3: API — MunicipalityModule (GET/POST/PATCH /municipality/users)

**Files:**
- Create: `apps/api/src/municipality/dto/create-municipality-user.dto.ts`
- Create: `apps/api/src/municipality/dto/update-municipality-user.dto.ts`
- Create: `apps/api/src/municipality/municipality.service.ts`
- Create: `apps/api/src/municipality/municipality.controller.ts`
- Create: `apps/api/src/municipality/municipality.module.ts`
- Modify: `apps/api/src/app.module.ts`

**Step 1: Create DTOs**

```typescript
// apps/api/src/municipality/dto/create-municipality-user.dto.ts
import { IsString, IsNotEmpty, IsIn, MinLength } from 'class-validator';

export class CreateMunicipalityUserDto {
  @IsString() @IsNotEmpty() username!: string;
  @IsString() @MinLength(8) password!: string;
  @IsString() @IsNotEmpty() firstName!: string;
  @IsString() @IsNotEmpty() lastName!: string;
  @IsString() @IsNotEmpty() cpf!: string;

  @IsString()
  @IsIn(['admin_municipality', 'operator_tfd', 'viewer'])
  role!: string;
}
```

```typescript
// apps/api/src/municipality/dto/update-municipality-user.dto.ts
import { IsString, IsOptional, IsBoolean, IsIn, MinLength } from 'class-validator';

export class UpdateMunicipalityUserDto {
  @IsOptional() @IsString() username?: string;
  @IsOptional() @IsString() @MinLength(8) password?: string;
  @IsOptional() @IsString() firstName?: string;
  @IsOptional() @IsString() lastName?: string;
  @IsOptional() @IsString() cpf?: string;
  @IsOptional() @IsBoolean() isActive?: boolean;

  @IsOptional()
  @IsString()
  @IsIn(['admin_municipality', 'operator_tfd', 'viewer'])
  role?: string;
}
```

**Step 2: Create MunicipalityService**

```typescript
// apps/api/src/municipality/municipality.service.ts
import {
  Injectable,
  ConflictException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository, InjectDataSource } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { Gender } from '@govmunicipio/shared';
import {
  PrincipalEntity,
  PersonEntity,
  PersonIdentificationEntity,
  OrganizationEntity,
  RoleEntity,
} from '../entities';
import { CreateMunicipalityUserDto } from './dto/create-municipality-user.dto';
import { UpdateMunicipalityUserDto } from './dto/update-municipality-user.dto';

@Injectable()
export class MunicipalityService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    @InjectRepository(PrincipalEntity)
    private readonly principalRepository: Repository<PrincipalEntity>,
    @InjectRepository(RoleEntity)
    private readonly roleRepository: Repository<RoleEntity>,
  ) {}

  async findUsers(organizationId: string): Promise<PrincipalEntity[]> {
    return this.principalRepository
      .createQueryBuilder('p')
      .leftJoinAndSelect('p.roles', 'role')
      .leftJoinAndSelect('p.person', 'person')
      .leftJoinAndSelect('p.organizations', 'org')
      .where('org.id = :organizationId', { organizationId })
      .orderBy('p.createdAt', 'DESC')
      .getMany();
  }

  async createUser(
    dto: CreateMunicipalityUserDto,
    organizationId: string,
  ): Promise<PrincipalEntity> {
    const existing = await this.principalRepository.findOne({
      where: { username: dto.username },
    });
    if (existing) {
      throw new ConflictException(`Username ${dto.username} already exists`);
    }

    const organization = await this.dataSource
      .getRepository(OrganizationEntity)
      .findOne({ where: { id: organizationId } });
    if (!organization) {
      throw new NotFoundException(`Organization not found`);
    }

    const role = await this.roleRepository.findOne({ where: { name: dto.role } });
    if (!role) throw new NotFoundException(`Role ${dto.role} not found`);

    const passwordHash = await bcrypt.hash(dto.password, 10);

    return this.dataSource.transaction(async (manager) => {
      const person = await manager.save(
        manager.create(PersonEntity, {
          firstName: dto.firstName,
          lastName: dto.lastName,
          gender: Gender.NOT_INFORMED,
        }),
      );

      await manager.save(
        manager.create(PersonIdentificationEntity, {
          cpf: dto.cpf,
          dateOfBirth: '1990-01-01' as unknown as Date,
          person,
        }),
      );

      const principal = manager.create(PrincipalEntity, {
        username: dto.username,
        passwordHash,
        isActive: true,
        person,
        organization,
      });
      principal.roles = [role];
      principal.organizations = [organization];
      return manager.save(principal);
    });
  }

  async updateUser(
    id: string,
    dto: UpdateMunicipalityUserDto,
    organizationId: string,
  ): Promise<PrincipalEntity> {
    const principal = await this.principalRepository
      .createQueryBuilder('p')
      .leftJoinAndSelect('p.roles', 'role')
      .leftJoinAndSelect('p.person', 'person')
      .leftJoinAndSelect('person.identification', 'identification')
      .leftJoinAndSelect('p.organizations', 'org')
      .where('p.id = :id', { id })
      .getOne();

    if (!principal) throw new NotFoundException(`User ${id} not found`);

    const belongsToOrg = principal.organizations.some((o) => o.id === organizationId);
    if (!belongsToOrg) {
      throw new ForbiddenException('User does not belong to your organization');
    }

    await this.dataSource.transaction(async (manager) => {
      const personUpdates: Partial<PersonEntity> = {};
      if (dto.firstName !== undefined) personUpdates.firstName = dto.firstName;
      if (dto.lastName !== undefined) personUpdates.lastName = dto.lastName;
      if (Object.keys(personUpdates).length > 0) {
        await manager.update(PersonEntity, { id: principal.person.id }, personUpdates);
      }

      if (dto.cpf !== undefined && principal.person.identification) {
        await manager.update(
          PersonIdentificationEntity,
          { id: principal.person.identification.id },
          { cpf: dto.cpf },
        );
      }

      const principalUpdates: Partial<PrincipalEntity> = {};
      if (dto.username !== undefined) principalUpdates.username = dto.username;
      if (dto.isActive !== undefined) principalUpdates.isActive = dto.isActive;
      if (dto.password) principalUpdates.passwordHash = await bcrypt.hash(dto.password, 10);
      if (Object.keys(principalUpdates).length > 0) {
        await manager.update(PrincipalEntity, { id }, principalUpdates);
      }

      if (dto.role !== undefined) {
        const roleEntity = await this.roleRepository.findOne({ where: { name: dto.role } });
        if (!roleEntity) throw new NotFoundException(`Role ${dto.role} not found`);
        const p = await manager.findOne(PrincipalEntity, {
          where: { id },
          relations: { roles: true },
        });
        p!.roles = [roleEntity];
        await manager.save(p!);
      }
    });

    return this.principalRepository
      .createQueryBuilder('p')
      .leftJoinAndSelect('p.roles', 'role')
      .leftJoinAndSelect('p.person', 'person')
      .leftJoinAndSelect('p.organizations', 'org')
      .where('p.id = :id', { id })
      .getOne() as Promise<PrincipalEntity>;
  }
}
```

**Step 3: Create MunicipalityController**

```typescript
// apps/api/src/municipality/municipality.controller.ts
import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { MunicipalityService } from './municipality.service';
import { CreateMunicipalityUserDto } from './dto/create-municipality-user.dto';
import { UpdateMunicipalityUserDto } from './dto/update-municipality-user.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentPrincipal } from '../auth/decorators/current-principal.decorator';
import { PrincipalEntity } from '../entities';

interface JwtPrincipal {
  principalId: string;
  organizationId: string;
  roles: string[];
  permissions: string[];
}

@Controller('municipality')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin_municipality')
export class MunicipalityController {
  constructor(private readonly municipalityService: MunicipalityService) {}

  @Get('users')
  findUsers(@CurrentPrincipal() p: JwtPrincipal): Promise<PrincipalEntity[]> {
    return this.municipalityService.findUsers(p.organizationId);
  }

  @Post('users')
  @HttpCode(HttpStatus.CREATED)
  createUser(
    @Body() dto: CreateMunicipalityUserDto,
    @CurrentPrincipal() p: JwtPrincipal,
  ): Promise<PrincipalEntity> {
    return this.municipalityService.createUser(dto, p.organizationId);
  }

  @Patch('users/:id')
  updateUser(
    @Param('id') id: string,
    @Body() dto: UpdateMunicipalityUserDto,
    @CurrentPrincipal() p: JwtPrincipal,
  ): Promise<PrincipalEntity> {
    return this.municipalityService.updateUser(id, dto, p.organizationId);
  }
}
```

**Step 4: Create MunicipalityModule**

```typescript
// apps/api/src/municipality/municipality.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MunicipalityController } from './municipality.controller';
import { MunicipalityService } from './municipality.service';
import { PrincipalEntity, RoleEntity } from '../entities';

@Module({
  imports: [TypeOrmModule.forFeature([PrincipalEntity, RoleEntity])],
  controllers: [MunicipalityController],
  providers: [MunicipalityService],
})
export class MunicipalityModule {}
```

**Step 5: Register in AppModule**

In `apps/api/src/app.module.ts`, add import and register:
```typescript
import { MunicipalityModule } from './municipality/municipality.module';

// In imports array, add after AdminModule:
MunicipalityModule,
```

**Step 6: Test manually**
```bash
# Login as admin and get token
curl -X POST http://localhost:3001/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}'

# List users for the municipality
curl http://localhost:3001/api/v1/municipality/users \
  -H "Authorization: Bearer <admin_token>"
# Expected: 200 with array of principals in Camaçari municipality
```

**Step 7: Commit**
```bash
git add apps/api/src/municipality/
git add apps/api/src/app.module.ts
git commit -m "feat(api): add MunicipalityModule with GET/POST/PATCH /municipality/users"
```

---

### Task 4: Frontend — isAdminMunicipality + Dashboard sidebar update

**Files:**
- Modify: `apps/web/src/lib/admin-auth.ts`
- Modify: `apps/web/src/app/(protected)/layout.tsx`

**Step 1: Add isAdminMunicipality to admin-auth.ts**

In `apps/web/src/lib/admin-auth.ts`, add after `isSuperAdmin`:
```typescript
export function isAdminMunicipality(): boolean {
  const principal = getCurrentPrincipal();
  return (
    Array.isArray(principal?.roles) &&
    principal.roles.includes('admin_municipality')
  );
}
```

**Step 2: Update (protected)/layout.tsx**

Replace the static `navigation` array and update `SidebarContent` to conditionally show the Usuários link. Full updated file:

```typescript
'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import {
  Building2,
  FileText,
  LayoutDashboard,
  LogOut,
  Menu,
  Users,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { isAuthenticated, getCurrentPrincipal, logout } from '@/lib/auth';
import { isAdminMunicipality } from '@/lib/admin-auth';

function SidebarContent({ pathname }: { pathname: string }) {
  const principal = getCurrentPrincipal();
  const adminMunicipality = isAdminMunicipality();

  const navigation = [
    { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
    { name: 'TFD > Solicitações', href: '/tfd/requests', icon: FileText },
    ...(adminMunicipality
      ? [{ name: 'Usuários', href: '/dashboard/users', icon: Users }]
      : []),
  ];

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 px-4 py-5">
        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
          <Building2 className="h-4 w-4" />
        </div>
        <span className="text-lg font-semibold">GovMunicípio</span>
      </div>

      <Separator />

      <nav className="flex-1 space-y-1 px-3 py-4">
        {navigation.map((item) => {
          const isActive = pathname === item.href;
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

      <div className="px-4 py-4">
        {principal && (
          <p className="mb-3 truncate text-sm text-muted-foreground">
            {principal.username}
          </p>
        )}
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

export default function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    if (!isAuthenticated()) {
      router.push('/auth/login');
      return;
    }
    setMounted(true);
  }, [router]);

  if (!mounted) {
    return null;
  }

  return (
    <div className="flex h-screen">
      {/* Desktop sidebar */}
      <aside className="hidden w-64 shrink-0 border-r bg-card md:block">
        <SidebarContent pathname={pathname} />
      </aside>

      {/* Mobile sidebar */}
      <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
        <div className="flex flex-1 flex-col overflow-hidden">
          {/* Mobile header */}
          <header className="flex h-14 items-center gap-2 border-b px-4 md:hidden">
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon">
                <Menu className="h-5 w-5" />
                <span className="sr-only">Abrir menu</span>
              </Button>
            </SheetTrigger>
            <div className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              <span className="font-semibold">GovMunicípio</span>
            </div>
          </header>

          {/* Main content */}
          <main className="flex-1 overflow-y-auto p-6">{children}</main>
        </div>

        <SheetContent side="left" className="w-64 p-0">
          <SheetHeader className="sr-only">
            <SheetTitle>Menu de navegação</SheetTitle>
          </SheetHeader>
          <SidebarContent pathname={pathname} />
        </SheetContent>
      </Sheet>
    </div>
  );
}
```

**Step 3: Commit**
```bash
git add apps/web/src/lib/admin-auth.ts apps/web/src/app/\(protected\)/layout.tsx
git commit -m "feat(web): add isAdminMunicipality helper and conditional Usuários link in sidebar"
```

---

### Task 5: Frontend — Edit Municipality modal

**Files:**
- Modify: `apps/web/src/app/admin/municipalities/page.tsx`

Replace the entire file with this version that adds an Edit button and modal dialog:

```typescript
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Plus, Pencil } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { apiClient } from '@/lib/api';

interface Municipality {
  id: string;
  ibgeCode: string;
  state: string;
  organization: {
    name: string;
    cnpj: string;
    isActive: boolean;
    address: { city: string; street: string; number: string; neighborhood: string; zipCode: string; state: string } | null;
  };
}

interface EditForm {
  name: string;
  cnpj: string;
  ibgeCode: string;
  state: string;
  city: string;
  street: string;
  number: string;
  neighborhood: string;
  zipCode: string;
  isActive: boolean;
}

export default function MunicipalitiesPage() {
  const [municipalities, setMunicipalities] = useState<Municipality[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Municipality | null>(null);
  const [form, setForm] = useState<EditForm | null>(null);
  const [saving, setSaving] = useState(false);

  function load() {
    return apiClient<Municipality[]>('/admin/municipalities')
      .then(setMunicipalities)
      .catch(console.error)
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, []);

  function openEdit(m: Municipality) {
    setEditing(m);
    setForm({
      name: m.organization.name,
      cnpj: m.organization.cnpj,
      ibgeCode: m.ibgeCode,
      state: m.state,
      city: m.organization.address?.city ?? '',
      street: m.organization.address?.street ?? '',
      number: m.organization.address?.number ?? '',
      neighborhood: m.organization.address?.neighborhood ?? '',
      zipCode: m.organization.address?.zipCode ?? '',
      isActive: m.organization.isActive,
    });
  }

  function updateField(field: keyof EditForm) {
    return (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((prev) => prev ? { ...prev, [field]: e.target.type === 'checkbox' ? e.target.checked : e.target.value } : prev);
  }

  async function handleSave() {
    if (!editing || !form) return;
    setSaving(true);
    try {
      await apiClient(`/admin/municipalities/${editing.id}`, {
        method: 'PATCH',
        body: JSON.stringify(form),
      });
      toast.success('Município atualizado!');
      setEditing(null);
      setLoading(true);
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao atualizar');
    } finally {
      setSaving(false);
    }
  }

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
                <TableHead className="w-16" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {municipalities.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground">
                    Nenhum município cadastrado
                  </TableCell>
                </TableRow>
              ) : (
                municipalities.map((m) => (
                  <TableRow key={m.id}>
                    <TableCell className="font-medium">{m.organization.name}</TableCell>
                    <TableCell>{m.organization.cnpj}</TableCell>
                    <TableCell>{m.organization.address?.city ?? '—'}/{m.state}</TableCell>
                    <TableCell>{m.ibgeCode}</TableCell>
                    <TableCell>
                      <Badge variant={m.organization.isActive ? 'default' : 'secondary'}>
                        {m.organization.isActive ? 'Ativo' : 'Inativo'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" onClick={() => openEdit(m)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={!!editing} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Editar Município</DialogTitle>
          </DialogHeader>
          {form && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Nome da Prefeitura</Label>
                <Input value={form.name} onChange={updateField('name')} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>CNPJ</Label>
                  <Input value={form.cnpj} onChange={updateField('cnpj')} placeholder="XX.XXX.XXX/XXXX-XX" />
                </div>
                <div className="space-y-2">
                  <Label>Código IBGE</Label>
                  <Input value={form.ibgeCode} onChange={updateField('ibgeCode')} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Cidade</Label>
                  <Input value={form.city} onChange={updateField('city')} />
                </div>
                <div className="space-y-2">
                  <Label>UF</Label>
                  <Input value={form.state} onChange={updateField('state')} maxLength={2} />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="col-span-2 space-y-2">
                  <Label>Rua</Label>
                  <Input value={form.street} onChange={updateField('street')} />
                </div>
                <div className="space-y-2">
                  <Label>Número</Label>
                  <Input value={form.number} onChange={updateField('number')} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Bairro</Label>
                  <Input value={form.neighborhood} onChange={updateField('neighborhood')} />
                </div>
                <div className="space-y-2">
                  <Label>CEP</Label>
                  <Input value={form.zipCode} onChange={updateField('zipCode')} placeholder="00000-000" />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="isActive"
                  checked={form.isActive}
                  onChange={updateField('isActive')}
                  className="h-4 w-4"
                />
                <Label htmlFor="isActive">Município ativo</Label>
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

**Step 2: Commit**
```bash
git add apps/web/src/app/admin/municipalities/page.tsx
git commit -m "feat(web): add edit municipality modal in /admin/municipalities"
```

---

### Task 6: Frontend — Edit User modal

**Files:**
- Modify: `apps/web/src/app/admin/users/page.tsx`

Replace the file with this version:

```typescript
'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Pencil } from 'lucide-react';
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
import { apiClient } from '@/lib/api';

interface Principal {
  id: string;
  username: string;
  isActive: boolean;
  person: { firstName: string; lastName: string; identification?: { cpf: string } } | null;
  roles: { name: string }[];
  organizations: { name: string }[];
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
}

export default function UsersPage() {
  const [users, setUsers] = useState<Principal[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Principal | null>(null);
  const [form, setForm] = useState<EditForm | null>(null);
  const [saving, setSaving] = useState(false);

  function load() {
    return apiClient<Principal[]>('/admin/users')
      .then(setUsers)
      .catch(console.error)
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, []);

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
    });
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
      await apiClient(`/admin/users/${editing.id}`, {
        method: 'PATCH',
        body: JSON.stringify(body),
      });
      toast.success('Usuário atualizado!');
      setEditing(null);
      setLoading(true);
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

**Step 2: Commit**
```bash
git add apps/web/src/app/admin/users/page.tsx
git commit -m "feat(web): add edit user modal in /admin/users"
```

---

### Task 7: Frontend — /dashboard/users page

**Files:**
- Create: `apps/web/src/app/(protected)/dashboard/users/page.tsx`

```typescript
'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Plus, Pencil } from 'lucide-react';
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
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { apiClient } from '@/lib/api';

interface MunicipalityUser {
  id: string;
  username: string;
  isActive: boolean;
  person: { firstName: string; lastName: string } | null;
  roles: { name: string }[];
}

const ROLE_LABELS: Record<string, string> = {
  admin_municipality: 'Admin Municipal',
  operator_tfd: 'Operador TFD',
  viewer: 'Visualizador',
};

interface UserForm {
  username: string;
  password: string;
  firstName: string;
  lastName: string;
  cpf: string;
  role: string;
  isActive: boolean;
}

const emptyForm: UserForm = {
  username: '',
  password: '',
  firstName: '',
  lastName: '',
  cpf: '',
  role: 'operator_tfd',
  isActive: true,
};

export default function DashboardUsersPage() {
  const [users, setUsers] = useState<MunicipalityUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<UserForm>(emptyForm);
  const [saving, setSaving] = useState(false);

  function load() {
    return apiClient<MunicipalityUser[]>('/municipality/users')
      .then(setUsers)
      .catch(console.error)
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, []);

  function openCreate() {
    setEditingId(null);
    setForm(emptyForm);
    setDialogOpen(true);
  }

  function openEdit(u: MunicipalityUser) {
    setEditingId(u.id);
    setForm({
      username: u.username,
      password: '',
      firstName: u.person?.firstName ?? '',
      lastName: u.person?.lastName ?? '',
      cpf: '',
      role: u.roles[0]?.name ?? 'operator_tfd',
      isActive: u.isActive,
    });
    setDialogOpen(true);
  }

  function updateField(field: keyof UserForm) {
    return (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((prev) => ({ ...prev, [field]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));
  }

  async function handleSave() {
    setSaving(true);
    try {
      if (editingId) {
        const body: Record<string, unknown> = {
          username: form.username,
          firstName: form.firstName,
          lastName: form.lastName,
          cpf: form.cpf,
          role: form.role,
          isActive: form.isActive,
        };
        if (form.password) body.password = form.password;
        await apiClient(`/municipality/users/${editingId}`, {
          method: 'PATCH',
          body: JSON.stringify(body),
        });
        toast.success('Usuário atualizado!');
      } else {
        await apiClient('/municipality/users', {
          method: 'POST',
          body: JSON.stringify(form),
        });
        toast.success('Usuário criado!');
      }
      setDialogOpen(false);
      setLoading(true);
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao salvar');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Usuários do Município</h1>
          <p className="text-muted-foreground">{users.length} usuário(s)</p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="mr-2 h-4 w-4" />
          Novo Usuário
        </Button>
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
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-16" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground">
                    Nenhum usuário cadastrado
                  </TableCell>
                </TableRow>
              ) : (
                users.map((u) => (
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
                ))
              )}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Editar Usuário' : 'Novo Usuário'}</DialogTitle>
          </DialogHeader>
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
              <Input value={form.username} onChange={updateField('username')} placeholder="operador_cidade" />
            </div>
            <div className="space-y-2">
              <Label>{editingId ? 'Nova Senha (deixe em branco para manter)' : 'Senha (mínimo 8 caracteres)'}</Label>
              <Input type="password" value={form.password} onChange={updateField('password')} />
            </div>
            <div className="space-y-2">
              <Label>Função</Label>
              <Select value={form.role} onValueChange={(v) => setForm((p) => ({ ...p, role: v }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin_municipality">Admin Municipal</SelectItem>
                  <SelectItem value="operator_tfd">Operador TFD</SelectItem>
                  <SelectItem value="viewer">Visualizador</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {editingId && (
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="muserActive"
                  checked={form.isActive}
                  onChange={updateField('isActive')}
                  className="h-4 w-4"
                />
                <Label htmlFor="muserActive">Usuário ativo</Label>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? 'Salvando...' : editingId ? 'Salvar' : 'Criar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
```

**Step 2: Commit**
```bash
git add "apps/web/src/app/(protected)/dashboard/users/page.tsx"
git commit -m "feat(web): add /dashboard/users page for admin_municipality user management"
```

---

### Task 8: Deploy

> ⚠️ **Antes de qualquer deploy, teste localmente com docker-compose.**

**Step 0: Teste local obrigatório**
```bash
# Subir banco local
docker compose up -d

# Rodar a API localmente
pnpm --filter @govmunicipio/api dev

# Em outro terminal, rodar o frontend
pnpm --filter @govmunicipio/web dev

# Verificar que os endpoints novos funcionam:
# - PATCH http://localhost:3001/api/v1/admin/municipalities/:id
# - PATCH http://localhost:3001/api/v1/admin/users/:id
# - GET/POST/PATCH http://localhost:3001/api/v1/municipality/users
# - Frontend: /admin/municipalities (botão editar)
# - Frontend: /admin/users (botão editar)
# - Frontend: /dashboard/users (página para admin_municipality)

# Somente após validar localmente, prosseguir com o deploy.
```

**Step 1: Push all commits**
```bash
git push
```

**Step 2: Deploy API to Railway**
```bash
railway up --service api --detach
```

**Step 3: Redeploy Vercel**
```bash
# Make empty commit with correct email for Vercel
git -c user.email="cleberw3b@gmail.com" -c user.name="Cleber Oliveira" \
  commit --allow-empty -m "chore: deploy edit municipalities/users features"
git push
vercel --prod
```

**Step 4: Verify**
```bash
# Login as superadmin
curl -X POST https://api-production-eb2b7.up.railway.app/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"superadmin","password":"superadmin123"}'

# Test PATCH municipality (replace <id> and <token>)
curl -X PATCH https://api-production-eb2b7.up.railway.app/api/v1/admin/municipalities/<id> \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"name":"Prefeitura Teste"}'

# Login as admin (municipality admin)
# Test municipality users endpoint
curl https://api-production-eb2b7.up.railway.app/api/v1/municipality/users \
  -H "Authorization: Bearer <admin_token>"
```
