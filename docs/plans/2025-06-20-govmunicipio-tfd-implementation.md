# GovMunicípio TFD — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build the GovMunicípio TFD module — a monorepo with Next.js frontend and NestJS backend for managing Tratamento Fora do Domicílio requests for Brazilian municipalities.

**Architecture:** Turborepo monorepo with pnpm workspaces. `apps/web` (Next.js 15 App Router) deploys to Vercel. `apps/api` (NestJS + TypeORM + PostgreSQL) deploys to Railway. `packages/shared` holds DTOs, interfaces, and enums shared between apps. RBAC with granular permissions, JWT auth with organization context.

**Tech Stack:** TypeScript, Next.js 15, NestJS, TypeORM, PostgreSQL, Turborepo, pnpm, Tailwind CSS, shadcn/ui, React Hook Form, Zod, Passport JWT

---

## Task 1: Create GitHub Repository

**Files:**
- None (GitHub operation)

**Step 1: Create the remote repo**

```bash
gh repo create Cleberw3b/govmunicipio --public --description "GovMunicípio — Municipal government systems platform. First module: TFD (Tratamento Fora do Domicílio)" --clone=false
```

Expected: Repository created at `github.com/Cleberw3b/govmunicipio`

**Step 2: Connect local repo to remote**

```bash
cd ~/zPessoalCode/govmunicipio
git remote add origin https://github.com/Cleberw3b/govmunicipio.git
git branch -M main
git push -u origin main
```

Expected: Design doc pushed to remote main branch

**Step 3: Commit**

Already committed (design doc). Just push.

---

## Task 2: Monorepo Foundation (Turborepo + pnpm)

**Files:**
- Create: `package.json` (root)
- Create: `pnpm-workspace.yaml`
- Create: `turbo.json`
- Create: `tsconfig.base.json`
- Create: `.gitignore`
- Create: `.nvmrc`
- Create: `.npmrc`

**Step 1: Initialize root package.json**

```json
{
  "name": "govmunicipio",
  "version": "0.0.1",
  "private": true,
  "description": "GovMunicípio — Municipal government systems platform",
  "scripts": {
    "dev": "turbo dev",
    "build": "turbo build",
    "lint": "turbo lint",
    "clean": "turbo clean",
    "api:dev": "turbo dev --filter=@govmunicipio/api",
    "web:dev": "turbo dev --filter=@govmunicipio/web"
  },
  "devDependencies": {
    "turbo": "^2"
  },
  "packageManager": "pnpm@10.30.0"
}
```

**Step 2: Create pnpm-workspace.yaml**

```yaml
packages:
  - "apps/*"
  - "packages/*"
```

**Step 3: Create turbo.json**

```json
{
  "$schema": "https://turbo.build/schema.json",
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**", ".next/**", "!.next/cache/**"]
    },
    "dev": {
      "cache": false,
      "persistent": true
    },
    "lint": {
      "dependsOn": ["^build"]
    },
    "clean": {
      "cache": false
    }
  }
}
```

**Step 4: Create tsconfig.base.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  },
  "exclude": ["node_modules"]
}
```

**Step 5: Create .gitignore**

```
node_modules/
dist/
.next/
.turbo/
*.log
.env
.env.*
!.env.example
.DS_Store
coverage/
```

**Step 6: Create .nvmrc**

```
24
```

**Step 7: Create .npmrc**

```
auto-install-peers=true
```

**Step 8: Install dependencies**

```bash
cd ~/zPessoalCode/govmunicipio
pnpm install
```

Expected: `turbo` installed, `node_modules` created, `pnpm-lock.yaml` generated

**Step 9: Commit**

```bash
git add -A
git commit -m "chore: initialize Turborepo monorepo with pnpm workspaces"
```

---

## Task 3: Shared Package (DTOs, Interfaces, Enums)

**Files:**
- Create: `packages/shared/package.json`
- Create: `packages/shared/tsconfig.json`
- Create: `packages/shared/src/index.ts`
- Create: `packages/shared/src/enums/index.ts`
- Create: `packages/shared/src/enums/gender.enum.ts`
- Create: `packages/shared/src/enums/contact-type.enum.ts`
- Create: `packages/shared/src/enums/transport-type.enum.ts`
- Create: `packages/shared/src/enums/tfd-status.enum.ts`
- Create: `packages/shared/src/interfaces/index.ts`
- Create: `packages/shared/src/interfaces/principal.interface.ts`
- Create: `packages/shared/src/interfaces/person.interface.ts`
- Create: `packages/shared/src/interfaces/organization.interface.ts`
- Create: `packages/shared/src/interfaces/tfd-request.interface.ts`
- Create: `packages/shared/src/interfaces/jwt-payload.interface.ts`
- Create: `packages/shared/src/dto/index.ts`
- Create: `packages/shared/src/dto/auth/login.dto.ts`
- Create: `packages/shared/src/dto/tfd/create-tfd-request.dto.ts`

**Step 1: Create packages/shared/package.json**

```json
{
  "name": "@govmunicipio/shared",
  "version": "0.0.1",
  "private": true,
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "scripts": {
    "lint": "tsc --noEmit",
    "clean": "rm -rf dist node_modules"
  },
  "devDependencies": {
    "typescript": "^5"
  }
}
```

**Step 2: Create packages/shared/tsconfig.json**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src"]
}
```

**Step 3: Create enums**

`packages/shared/src/enums/gender.enum.ts`:
```typescript
export enum Gender {
  MALE = 'male',
  FEMALE = 'female',
  OTHER = 'other',
  NOT_INFORMED = 'not_informed',
}
```

`packages/shared/src/enums/contact-type.enum.ts`:
```typescript
export enum ContactType {
  PHONE = 'phone',
  EMAIL = 'email',
  WHATSAPP = 'whatsapp',
  FAX = 'fax',
  OTHER = 'other',
}
```

`packages/shared/src/enums/transport-type.enum.ts`:
```typescript
export enum TransportType {
  BUS = 'bus',
  VAN = 'van',
  AMBULANCE = 'ambulance',
  AIR = 'air',
  OWN_VEHICLE = 'own_vehicle',
  OTHER = 'other',
}
```

`packages/shared/src/enums/tfd-status.enum.ts`:
```typescript
export enum TfdStatus {
  DRAFT = 'draft',
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  SCHEDULED = 'scheduled',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
}
```

`packages/shared/src/enums/index.ts`:
```typescript
export * from './gender.enum';
export * from './contact-type.enum';
export * from './transport-type.enum';
export * from './tfd-status.enum';
```

**Step 4: Create interfaces**

`packages/shared/src/interfaces/jwt-payload.interface.ts`:
```typescript
export interface IJwtPayload {
  sub: string;
  organizationId: string;
  roles: string[];
  permissions: string[];
  iat?: number;
  exp?: number;
}
```

`packages/shared/src/interfaces/principal.interface.ts`:
```typescript
export interface IPrincipal {
  id: string;
  username: string;
  isActive: boolean;
  personId?: string | null;
  organizationId?: string | null;
  lastLogin?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}
```

`packages/shared/src/interfaces/person.interface.ts`:
```typescript
import { Gender } from '../enums';

export interface IPerson {
  id: string;
  firstName: string;
  lastName: string;
  gender: Gender;
  addressId?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface IPersonIdentification {
  id: string;
  personId: string;
  cpf: string;
  rg?: string | null;
  susCardNumber?: string | null;
  dateOfBirth: Date;
  issuingAuthority?: string | null;
  createdAt: Date;
  updatedAt: Date;
}
```

`packages/shared/src/interfaces/organization.interface.ts`:
```typescript
export interface IOrganization {
  id: string;
  name: string;
  cnpj: string;
  addressId?: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface IMunicipality {
  id: string;
  organizationId: string;
  ibgeCode: string;
  state: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface IHospital {
  id: string;
  organizationId: string;
  cnesCode: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface IHotel {
  id: string;
  organizationId: string;
  municipalityId?: string | null;
  createdAt: Date;
  updatedAt: Date;
}
```

`packages/shared/src/interfaces/tfd-request.interface.ts`:
```typescript
import { TransportType } from '../enums';

export interface ITfdRequest {
  id: string;
  protocolNumber: string;
  patientPersonId: string;
  companionPersonId?: string | null;
  requestingDoctorId: string;
  destinationHospitalId: string;
  hotelId?: string | null;
  municipalityId: string;
  createdByPrincipalId: string;
  statusId: string;
  diagnosisCid: string;
  procedureDescription: string;
  justification: string;
  requestDate: Date;
  travelDate?: Date | null;
  returnDate?: Date | null;
  transportType: TransportType;
  estimatedCost?: number | null;
  notes?: string | null;
  createdAt: Date;
  updatedAt: Date;
}
```

`packages/shared/src/interfaces/index.ts`:
```typescript
export * from './jwt-payload.interface';
export * from './principal.interface';
export * from './person.interface';
export * from './organization.interface';
export * from './tfd-request.interface';
```

**Step 5: Create DTOs**

`packages/shared/src/dto/auth/login.dto.ts`:
```typescript
export interface LoginDto {
  username: string;
  password: string;
  organizationId?: string;
}

export interface LoginResponseDto {
  accessToken: string;
  principal: {
    id: string;
    username: string;
    roles: string[];
    permissions: string[];
    organizationId: string;
  };
}
```

`packages/shared/src/dto/tfd/create-tfd-request.dto.ts`:
```typescript
import { TransportType } from '../../enums';

export interface CreateTfdRequestDto {
  patientPersonId: string;
  companionPersonId?: string | null;
  requestingDoctorId: string;
  destinationHospitalId: string;
  hotelId?: string | null;
  diagnosisCid: string;
  procedureDescription: string;
  justification: string;
  requestDate: string;
  travelDate?: string | null;
  returnDate?: string | null;
  transportType: TransportType;
  estimatedCost?: number | null;
  notes?: string | null;
}
```

`packages/shared/src/dto/index.ts`:
```typescript
export * from './auth/login.dto';
export * from './tfd/create-tfd-request.dto';
```

**Step 6: Create root index**

`packages/shared/src/index.ts`:
```typescript
export * from './enums';
export * from './interfaces';
export * from './dto';
```

**Step 7: Install shared deps and verify**

```bash
cd ~/zPessoalCode/govmunicipio
pnpm install
pnpm --filter @govmunicipio/shared lint
```

Expected: No TypeScript errors

**Step 8: Commit**

```bash
git add packages/shared
git commit -m "feat: add shared package with DTOs, interfaces, and enums"
```

---

## Task 4: NestJS API Scaffold

**Files:**
- Create: `apps/api/package.json`
- Create: `apps/api/tsconfig.json`
- Create: `apps/api/tsconfig.build.json`
- Create: `apps/api/nest-cli.json`
- Create: `apps/api/src/main.ts`
- Create: `apps/api/src/app.module.ts`
- Create: `apps/api/src/app.controller.ts`
- Create: `apps/api/.env.example`

**Step 1: Scaffold NestJS app**

```bash
cd ~/zPessoalCode/govmunicipio
mkdir -p apps/api/src
```

**Step 2: Create apps/api/package.json**

```json
{
  "name": "@govmunicipio/api",
  "version": "0.0.1",
  "private": true,
  "scripts": {
    "build": "nest build",
    "dev": "nest start --watch",
    "start": "nest start",
    "start:prod": "node dist/main",
    "lint": "tsc --noEmit",
    "clean": "rm -rf dist node_modules"
  },
  "dependencies": {
    "@nestjs/common": "^11",
    "@nestjs/core": "^11",
    "@nestjs/platform-express": "^11",
    "@nestjs/config": "^4",
    "@nestjs/typeorm": "^11",
    "@nestjs/passport": "^11",
    "@nestjs/jwt": "^11",
    "typeorm": "^0.3",
    "pg": "^8",
    "passport": "^0.7",
    "passport-jwt": "^4",
    "bcrypt": "^5",
    "class-validator": "^0.14",
    "class-transformer": "^0.5",
    "reflect-metadata": "^0.2",
    "rxjs": "^7",
    "uuid": "^11",
    "@govmunicipio/shared": "workspace:*"
  },
  "devDependencies": {
    "@nestjs/cli": "^11",
    "@types/node": "^22",
    "@types/passport-jwt": "^4",
    "@types/bcrypt": "^5",
    "@types/uuid": "^10",
    "typescript": "^5"
  }
}
```

**Step 3: Create apps/api/tsconfig.json**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "module": "commonjs",
    "moduleResolution": "node",
    "outDir": "./dist",
    "rootDir": "./src",
    "target": "ES2022",
    "emitDecoratorMetadata": true,
    "experimentalDecorators": true,
    "declaration": false,
    "declarationMap": false
  },
  "include": ["src"]
}
```

**Step 4: Create apps/api/tsconfig.build.json**

```json
{
  "extends": "./tsconfig.json",
  "exclude": ["node_modules", "dist", "test", "**/*.spec.ts"]
}
```

**Step 5: Create apps/api/nest-cli.json**

```json
{
  "$schema": "https://json.schemastore.org/nest-cli",
  "collection": "@nestjs/schematics",
  "sourceRoot": "src",
  "compilerOptions": {
    "tsConfigPath": "tsconfig.build.json"
  }
}
```

**Step 6: Create apps/api/src/app.controller.ts**

```typescript
import { Controller, Get } from '@nestjs/common';

@Controller()
export class AppController {
  @Get()
  healthCheck() {
    return { status: 'ok', service: 'govmunicipio-api', timestamp: new Date().toISOString() };
  }
}
```

**Step 7: Create apps/api/src/app.module.ts**

```typescript
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
  ],
  controllers: [AppController],
})
export class AppModule {}
```

**Step 8: Create apps/api/src/main.ts**

```typescript
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.setGlobalPrefix('api/v1');

  app.enableCors({
    origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const port = process.env.PORT || 3001;
  await app.listen(port);
  console.log(`GovMunicípio API running on port ${port}`);
}

bootstrap();
```

**Step 9: Create apps/api/.env.example**

```
PORT=3001
CORS_ORIGIN=http://localhost:3000

# Database
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=postgres
DB_NAME=govmunicipio

# JWT
JWT_SECRET=change-me-in-production
JWT_EXPIRATION=24h
```

**Step 10: Install and verify**

```bash
cd ~/zPessoalCode/govmunicipio
pnpm install
pnpm --filter @govmunicipio/api lint
```

Expected: No TypeScript errors

**Step 11: Commit**

```bash
git add apps/api
git commit -m "feat: scaffold NestJS API with health check endpoint"
```

---

## Task 5: TypeORM Entities — Core (Principal, Person, Address, Contact, Organization)

**Files:**
- Create: `apps/api/src/database/database.module.ts`
- Create: `apps/api/src/entities/base.entity.ts`
- Create: `apps/api/src/entities/principal.entity.ts`
- Create: `apps/api/src/entities/role.entity.ts`
- Create: `apps/api/src/entities/permission.entity.ts`
- Create: `apps/api/src/entities/person.entity.ts`
- Create: `apps/api/src/entities/person-identification.entity.ts`
- Create: `apps/api/src/entities/address.entity.ts`
- Create: `apps/api/src/entities/contact.entity.ts`
- Create: `apps/api/src/entities/organization.entity.ts`
- Create: `apps/api/src/entities/municipality.entity.ts`
- Create: `apps/api/src/entities/hospital.entity.ts`
- Create: `apps/api/src/entities/hotel.entity.ts`
- Create: `apps/api/src/entities/specialty.entity.ts`
- Create: `apps/api/src/entities/doctor.entity.ts`
- Create: `apps/api/src/entities/status.entity.ts`
- Create: `apps/api/src/entities/module.entity.ts`
- Create: `apps/api/src/entities/tfd-request.entity.ts`
- Create: `apps/api/src/entities/index.ts`
- Modify: `apps/api/src/app.module.ts` (add TypeORM)

**Step 1: Create base entity**

`apps/api/src/entities/base.entity.ts`:
```typescript
import { PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';

export abstract class BaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
```

**Step 2: Create all entities**

Each entity maps exactly to the approved ERD. Use decorators: `@Entity`, `@Column`, `@ManyToOne`, `@ManyToMany`, `@JoinTable`, `@OneToOne`, `@JoinColumn`. Use `snake_case` for DB column names, `camelCase` for TS properties.

Key relationships:
- `Principal` has nullable `@OneToOne` to `Person` and `Organization`
- `Principal` has `@ManyToMany` to `Role` via `principal_role` join table
- `Role` has `@ManyToMany` to `Permission` via `role_permission` join table
- `Principal` has `@ManyToMany` to `Organization` via `principal_organization` join table
- `Person` has `@OneToOne` to `PersonIdentification`
- `Person` has `@ManyToMany` to `Contact` via `person_contact` join table
- `Organization` has `@ManyToMany` to `Contact` via `organization_contact` join table
- `Person` has `@ManyToOne` to `Address`
- `Organization` has `@ManyToOne` to `Address`
- `Municipality`, `Hospital`, `Hotel` each have `@OneToOne` to `Organization`
- `Doctor` has `@OneToOne` to `Person`
- `Doctor` has `@ManyToMany` to `Specialty` via `doctor_specialty` join table
- `Hospital` has `@ManyToMany` to `Specialty` via `hospital_specialty` join table
- `Module` has `@ManyToMany` to `Status` via `module_status` join table
- `TfdRequest` has `@ManyToOne` to Person (patient), Person (companion nullable), Doctor, Hospital, Hotel (nullable), Municipality, Principal, Status

**Step 3: Create database module**

`apps/api/src/database/database.module.ts`:
```typescript
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        host: config.get('DB_HOST', 'localhost'),
        port: config.get<number>('DB_PORT', 5432),
        username: config.get('DB_USERNAME', 'postgres'),
        password: config.get('DB_PASSWORD', 'postgres'),
        database: config.get('DB_NAME', 'govmunicipio'),
        entities: [__dirname + '/../entities/*.entity{.ts,.js}'],
        synchronize: config.get('NODE_ENV') !== 'production',
        logging: config.get('NODE_ENV') !== 'production',
      }),
    }),
  ],
})
export class DatabaseModule {}
```

**Step 4: Update app.module.ts to import DatabaseModule**

**Step 5: Verify compilation**

```bash
pnpm --filter @govmunicipio/api lint
```

Expected: No TypeScript errors

**Step 6: Commit**

```bash
git add apps/api/src
git commit -m "feat: add TypeORM entities for all ERD tables"
```

---

## Task 6: Auth Module (JWT, Login, Guards)

**Files:**
- Create: `apps/api/src/auth/auth.module.ts`
- Create: `apps/api/src/auth/auth.controller.ts`
- Create: `apps/api/src/auth/auth.service.ts`
- Create: `apps/api/src/auth/strategies/jwt.strategy.ts`
- Create: `apps/api/src/auth/guards/jwt-auth.guard.ts`
- Create: `apps/api/src/auth/guards/roles.guard.ts`
- Create: `apps/api/src/auth/guards/permissions.guard.ts`
- Create: `apps/api/src/auth/decorators/current-principal.decorator.ts`
- Create: `apps/api/src/auth/decorators/roles.decorator.ts`
- Create: `apps/api/src/auth/decorators/permissions.decorator.ts`
- Create: `apps/api/src/auth/dto/login.dto.ts`
- Modify: `apps/api/src/app.module.ts` (add AuthModule)

**Step 1: Create auth service**

- `validatePrincipal(username, password)` — finds Principal by username, verifies bcrypt hash, returns Principal with roles/permissions
- `login(principal, organizationId?)` — generates JWT with sub, organizationId, roles, permissions
- Injects TypeORM repositories for Principal, Role, Permission

**Step 2: Create JWT strategy**

- Extracts JWT from Bearer header
- Validates payload, returns `{ principalId, organizationId, roles, permissions }`
- Uses `JWT_SECRET` and `JWT_EXPIRATION` from config

**Step 3: Create guards**

- `JwtAuthGuard` — extends `AuthGuard('jwt')`
- `RolesGuard` — checks `@Roles()` decorator metadata against JWT roles
- `PermissionsGuard` — checks `@Permissions()` decorator metadata against JWT permissions

**Step 4: Create decorators**

- `@CurrentPrincipal()` — extracts principal from request
- `@Roles(...roles)` — sets metadata for RolesGuard
- `@Permissions(...permissions)` — sets metadata for PermissionsGuard

**Step 5: Create auth controller**

- `POST /api/v1/auth/login` — accepts `{ username, password, organizationId? }`, returns `{ accessToken, principal }`
- `GET /api/v1/auth/me` — protected, returns current principal info

**Step 6: Verify compilation**

```bash
pnpm --filter @govmunicipio/api lint
```

**Step 7: Commit**

```bash
git add apps/api/src/auth
git commit -m "feat: add auth module with JWT, guards, and RBAC"
```

---

## Task 7: TFD Module (CRUD Endpoints)

**Files:**
- Create: `apps/api/src/tfd/tfd.module.ts`
- Create: `apps/api/src/tfd/tfd.controller.ts`
- Create: `apps/api/src/tfd/tfd.service.ts`
- Create: `apps/api/src/tfd/dto/create-tfd-request.dto.ts`
- Create: `apps/api/src/tfd/dto/update-tfd-request.dto.ts`
- Create: `apps/api/src/person/person.module.ts`
- Create: `apps/api/src/person/person.controller.ts`
- Create: `apps/api/src/person/person.service.ts`
- Create: `apps/api/src/organization/organization.module.ts`
- Create: `apps/api/src/organization/organization.service.ts`
- Modify: `apps/api/src/app.module.ts` (add TfdModule, PersonModule, OrganizationModule)

**Step 1: Create Person module**

- `PersonService`: CRUD for Person + PersonIdentification + Contacts
- `GET /api/v1/persons/search?cpf=X&sus=Y` — search by CPF or SUS card
- `POST /api/v1/persons` — create person with identification and contacts
- `GET /api/v1/persons/:id` — get person with relations

**Step 2: Create TFD module**

- `TfdService`:
  - `create(dto, principalId, organizationId)` — generates protocol_number, resolves municipalityId from organizationId, sets status to 'draft'
  - `findAll(organizationId, filters)` — list TFD requests filtered by municipality
  - `findOne(id, organizationId)` — get single request (scoped to municipality)
  - `updateStatus(id, statusId, principalId)` — change status with validation
- `TfdController`:
  - `POST /api/v1/tfd/requests` — @Permissions('tfd_request:create')
  - `GET /api/v1/tfd/requests` — @Permissions('tfd_request:read')
  - `GET /api/v1/tfd/requests/:id` — @Permissions('tfd_request:read')
  - `PATCH /api/v1/tfd/requests/:id/status` — @Permissions('tfd_request:update')
  - All endpoints use `@CurrentPrincipal()` to get organizationId from JWT

**Step 3: Create Organization module**

- `OrganizationService`: query hospitals, hotels, doctors, specialties
- `GET /api/v1/hospitals` — list hospitals with specialties
- `GET /api/v1/doctors` — list doctors with specialties
- `GET /api/v1/specialties` — list specialties

**Step 4: Verify compilation**

```bash
pnpm --filter @govmunicipio/api lint
```

**Step 5: Commit**

```bash
git add apps/api/src
git commit -m "feat: add TFD, Person, and Organization modules with CRUD endpoints"
```

---

## Task 8: Seed Data

**Files:**
- Create: `apps/api/src/database/seeds/seed.ts`
- Modify: `apps/api/package.json` (add seed script)

**Step 1: Create seed script**

Seeds the database with:
- Module: `{ code: 'tfd', name: 'Tratamento Fora do Domicílio' }`
- Statuses: draft, pending, approved, rejected, scheduled, completed, cancelled
- ModuleStatus links for TFD
- Permissions: tfd_request:create, tfd_request:read, tfd_request:update, person:create, person:read
- Roles: super_admin (all), admin_municipality (all), operator_tfd (tfd+person), viewer (read only)
- Specialties: Cardiologia, Oncologia, Neurologia, Ortopedia, Oftalmologia
- 1 Organization (Municipality: "Prefeitura de Camaçari", IBGE: 2905701)
- 1 Organization (Hospital: "Hospital Geral Roberto Santos", CNES: 0005622)
- 1 Principal (admin user, linked to Municipality org, role: admin_municipality)
- 1 Doctor (linked to a Person, CRM: "12345-BA", specialty: Cardiologia)
- 2 Persons (sample patient and companion)
- Addresses and Contacts for all entities

**Step 2: Add seed script to package.json**

```json
"seed": "ts-node -r tsconfig-paths/register src/database/seeds/seed.ts"
```

**Step 3: Commit**

```bash
git add apps/api/src/database/seeds apps/api/package.json
git commit -m "feat: add database seed with initial data for TFD module"
```

---

## Task 9: Next.js Frontend Scaffold

**Files:**
- Create: `apps/web/package.json`
- Create: `apps/web/tsconfig.json`
- Create: `apps/web/next.config.ts`
- Create: `apps/web/tailwind.config.ts`
- Create: `apps/web/postcss.config.mjs`
- Create: `apps/web/src/app/layout.tsx`
- Create: `apps/web/src/app/page.tsx`
- Create: `apps/web/src/app/globals.css`
- Create: `apps/web/src/lib/api.ts`
- Create: `apps/web/src/lib/auth.ts`
- Create: `apps/web/.env.example`

**Step 1: Initialize Next.js with App Router**

Use `pnpm create next-app` or scaffold manually. Key config:
- App Router (no pages dir)
- Tailwind CSS
- TypeScript
- src/ directory
- Import alias `@/*`

**Step 2: Install shadcn/ui**

```bash
cd apps/web
pnpm dlx shadcn@latest init
```

Add components: button, input, label, card, dialog, select, form, table, badge, toast, separator, tabs, sheet

**Step 3: Create API client**

`apps/web/src/lib/api.ts` — fetch wrapper that:
- Reads `NEXT_PUBLIC_API_URL` from env
- Attaches JWT from localStorage/cookie
- Handles 401 → redirect to login

**Step 4: Create auth utilities**

`apps/web/src/lib/auth.ts` — helpers for:
- `login(username, password, organizationId)`
- `logout()`
- `getToken()`
- `getCurrentPrincipal()`

**Step 5: Verify**

```bash
pnpm --filter @govmunicipio/web dev
```

Expected: Next.js dev server starts on port 3000

**Step 6: Commit**

```bash
git add apps/web
git commit -m "feat: scaffold Next.js frontend with Tailwind and shadcn/ui"
```

---

## Task 10: Frontend — Auth Pages (Login)

**Files:**
- Create: `apps/web/src/app/auth/login/page.tsx`
- Create: `apps/web/src/components/auth/login-form.tsx`
- Create: `apps/web/src/app/(protected)/layout.tsx`
- Create: `apps/web/src/middleware.ts`

**Step 1: Create login page**

- Form with username, password fields
- Organization selector (if principal belongs to multiple orgs)
- Calls `POST /api/v1/auth/login`
- Stores JWT, redirects to dashboard

**Step 2: Create protected layout**

- Checks for valid JWT
- Sidebar with navigation (Dashboard, TFD, Admin)
- Header with user info and logout

**Step 3: Create middleware**

- Next.js middleware that redirects unauthenticated users to `/auth/login`
- Protects all routes except `/auth/*`

**Step 4: Commit**

```bash
git add apps/web/src
git commit -m "feat: add login page and auth middleware"
```

---

## Task 11: Frontend — TFD Multi-step Form

**Files:**
- Create: `apps/web/src/app/(protected)/tfd/requests/page.tsx`
- Create: `apps/web/src/app/(protected)/tfd/requests/new/page.tsx`
- Create: `apps/web/src/app/(protected)/tfd/requests/[id]/page.tsx`
- Create: `apps/web/src/components/tfd/request-list.tsx`
- Create: `apps/web/src/components/tfd/request-form/index.tsx`
- Create: `apps/web/src/components/tfd/request-form/step-patient.tsx`
- Create: `apps/web/src/components/tfd/request-form/step-companion.tsx`
- Create: `apps/web/src/components/tfd/request-form/step-doctor.tsx`
- Create: `apps/web/src/components/tfd/request-form/step-hospital.tsx`
- Create: `apps/web/src/components/tfd/request-form/step-clinical.tsx`
- Create: `apps/web/src/components/tfd/request-form/step-review.tsx`
- Create: `apps/web/src/components/tfd/request-detail.tsx`

**Step 1: Create TFD request list page**

- Table with columns: Protocol, Patient, Doctor, Hospital, Status, Date
- Filters by status
- Pagination
- "Nova Solicitação" button

**Step 2: Create multi-step form**

Uses React Hook Form + Zod. Steps:

1. **StepPatient**: Search person by CPF/SUS card, or create new. Shows person info once found.
2. **StepCompanion**: Optional. Same search/create as patient.
3. **StepDoctor**: Searchable select of doctors with specialty filter.
4. **StepHospital**: Searchable select of hospitals with specialty filter.
5. **StepClinical**: CID input, procedure description, justification, dates, transport type, cost estimate.
6. **StepReview**: Summary of all data. Submit button.

**Step 3: Create request detail page**

- Shows all TFD request data
- Status badge with color
- Status change buttons (based on permissions)

**Step 4: Commit**

```bash
git add apps/web/src
git commit -m "feat: add TFD request list, multi-step form, and detail pages"
```

---

## Task 12: Frontend — Dashboard

**Files:**
- Create: `apps/web/src/app/(protected)/dashboard/page.tsx`
- Create: `apps/web/src/components/dashboard/stats-cards.tsx`
- Create: `apps/web/src/components/dashboard/recent-requests.tsx`

**Step 1: Create dashboard**

- Stats cards: Total requests, Pending, Approved, This month
- Recent TFD requests table (last 10)
- Quick action: "Nova Solicitação TFD"

**Step 2: Commit**

```bash
git add apps/web/src
git commit -m "feat: add dashboard with stats and recent TFD requests"
```

---

## Task 13: Deploy Frontend to Vercel

**Step 1: Push all code to GitHub**

```bash
cd ~/zPessoalCode/govmunicipio
git push origin main
```

**Step 2: Deploy to Vercel**

Use the Vercel MCP integration to deploy `apps/web`. Configure:
- Root directory: `apps/web`
- Framework: Next.js
- Build command: `cd ../.. && pnpm turbo build --filter=@govmunicipio/web`
- Install command: `cd ../.. && pnpm install`
- Environment variables: `NEXT_PUBLIC_API_URL` (Railway backend URL, set after Task 14)

**Step 3: Verify deployment**

Access the Vercel URL and confirm the login page loads.

**Step 4: Commit any Vercel config**

```bash
git add .vercel
git commit -m "chore: add Vercel deployment configuration"
```

---

## Task 14: Deploy Backend to Railway (Manual — User Action)

**Step 1: Document Railway setup**

Create `docs/deploy-railway.md` with instructions:
1. Create Railway project
2. Add PostgreSQL service
3. Add NestJS service from GitHub repo (root dir: `apps/api`)
4. Set environment variables (DB_HOST, DB_PORT, etc. from Railway PostgreSQL)
5. Set build command: `cd ../.. && pnpm install && pnpm turbo build --filter=@govmunicipio/api`
6. Set start command: `node dist/main`

**Step 2: Commit**

```bash
git add docs/deploy-railway.md
git commit -m "docs: add Railway deployment instructions for backend"
```

---

## Review Checkpoints

- **After Task 3**: Verify shared package compiles — user reviews enums/interfaces
- **After Task 6**: Verify auth flow — user reviews JWT/guards structure
- **After Task 8**: Verify seed runs — user reviews seed data
- **After Task 11**: Verify frontend form flow — user reviews UI
- **After Task 13**: Verify Vercel deployment — user reviews live site
