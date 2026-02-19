# GovMunicípio — Design do Sistema TFD

**Data:** 2025-06-20
**Módulo:** Tratamento Fora do Domicílio (TFD)
**Status:** Aprovado

---

## 1. Visão Geral

O **GovMunicípio** é uma plataforma de sistemas para prefeituras brasileiras. O primeiro módulo é o **TFD (Tratamento Fora do Domicílio)**, regulamentado pela Portaria SAS nº 055/1999, que cobre transporte e diárias para pacientes que necessitam de tratamento de média/alta complexidade fora do seu município de origem.

### 1.1 Objetivo do MVP

Permitir que operadores de prefeituras criem solicitações de TFD, vinculando paciente, acompanhante (opcional), médico solicitante e hospital destino, com controle de status e rastreabilidade por município.

---

## 2. Stack Tecnológica

| Camada | Tecnologia |
|--------|-----------|
| Monorepo | Turborepo + pnpm workspaces |
| Frontend | Next.js 15 (App Router), Tailwind CSS, shadcn/ui, React Hook Form, Zod |
| Backend | NestJS, TypeORM, PostgreSQL, JWT (Passport) |
| Compartilhado | DTOs, enums, interfaces TypeScript |
| Deploy FE | Vercel |
| Deploy BE | Railway |
| DB | PostgreSQL (Railway managed) |

---

## 3. Arquitetura

### 3.1 Estrutura do Monorepo

```
govmunicipio/
├── apps/
│   ├── web/          # Next.js (App Router) — deploy Vercel
│   └── api/          # NestJS — deploy Railway
├── packages/
│   ├── shared/       # DTOs, interfaces, enums, validações
│   └── ui/           # Componentes UI reutilizáveis (futuro)
├── docs/
│   └── plans/
├── turbo.json
├── package.json
└── tsconfig.base.json
```

### 3.2 Deploy

- **Frontend (Next.js):** Vercel — deploy automático via GitHub
- **Backend (NestJS):** Railway — container com PostgreSQL managed
- **Comunicação:** REST API com JWT Bearer tokens

---

## 4. Modelo de Dados (ERD)

### 4.1 Princípios de Design

- **Principal** é a entidade central de identidade (padrão Identity Framework)
- **Person** e **Organization** podem ser Principals
- **Organization** é a entidade base para Municipality, Hospital e Hotel
- **Contact** é independente, vinculado via link tables a Person e Organization
- **Status** é genérico, vinculado a módulos via link table `ModuleStatus`
- **PersonIdentification** isola PII para compliance com LGPD
- **Specialty** tem link tables para Doctor e Hospital

### 4.2 Entidades

#### Identity & Auth
- **Principal** — entidade de autenticação (username, password_hash, person_id?, organization_id?)
- **Role** — papéis (admin_prefeitura, operator_tfd, etc.)
- **Permission** — permissões granulares (resource + action)
- **PrincipalRole** — link Principal ↔ Role
- **RolePermission** — link Role ↔ Permission
- **PrincipalOrganization** — link Principal ↔ Organization (genérico)

#### Person
- **Person** — dados pessoais (first_name, last_name, gender, address_id)
- **PersonIdentification** — PII (cpf, rg, sus_card_number, date_of_birth)

#### Contact
- **Contact** — tipo polimórfico (phone, email, whatsapp, etc.)
- **PersonContact** — link Person ↔ Contact
- **OrganizationContact** — link Organization ↔ Contact

#### Address
- **Address** — endereço reutilizável (street, number, city, state, zip_code)

#### Organization
- **Organization** — base (name, cnpj, address_id)
- **Municipality** — subtipo (ibge_code, state)
- **Hospital** — subtipo (cnes_code)
- **Hotel** — subtipo (municipality_id para convênio)

#### Domain
- **Doctor** — (person_id, crm)
- **Specialty** — catálogo de especialidades
- **DoctorSpecialty** — link Doctor ↔ Specialty
- **HospitalSpecialty** — link Hospital ↔ Specialty
- **Status** — genérico (code, label, sort_order)
- **Module** — sistemas (tfd, transporte, etc.)
- **ModuleStatus** — link Module ↔ Status

#### TFD
- **TfdRequest** — solicitação principal com protocol_number, vínculos a patient (Person), companion (Person?), Doctor, Hospital, Hotel?, Municipality, Principal (criador), Status

### 4.3 ERD Mermaid

```mermaid
erDiagram
    Principal {
        uuid id PK
        string username UK
        string password_hash
        boolean is_active
        uuid person_id FK
        uuid organization_id FK
        timestamp last_login
        timestamp created_at
        timestamp updated_at
    }

    Role {
        uuid id PK
        string name UK
        string description
        timestamp created_at
    }

    Permission {
        uuid id PK
        string resource
        string action
        string description
        timestamp created_at
    }

    RolePermission {
        uuid role_id FK
        uuid permission_id FK
    }

    PrincipalRole {
        uuid principal_id FK
        uuid role_id FK
    }

    PrincipalOrganization {
        uuid principal_id FK
        uuid organization_id FK
    }

    Person {
        uuid id PK
        string first_name
        string last_name
        string gender
        uuid address_id FK
        timestamp created_at
        timestamp updated_at
    }

    PersonIdentification {
        uuid id PK
        uuid person_id FK
        string cpf UK
        string rg
        string sus_card_number UK
        date date_of_birth
        string issuing_authority
        timestamp created_at
        timestamp updated_at
    }

    Contact {
        uuid id PK
        string type
        string value
        string label
        boolean is_primary
        timestamp created_at
        timestamp updated_at
    }

    PersonContact {
        uuid person_id FK
        uuid contact_id FK
    }

    OrganizationContact {
        uuid organization_id FK
        uuid contact_id FK
    }

    Address {
        uuid id PK
        string street
        string number
        string complement
        string neighborhood
        string city
        string state
        string zip_code
        timestamp created_at
        timestamp updated_at
    }

    Organization {
        uuid id PK
        string name
        string cnpj UK
        uuid address_id FK
        boolean is_active
        timestamp created_at
        timestamp updated_at
    }

    Municipality {
        uuid id PK
        uuid organization_id FK
        string ibge_code UK
        string state
        timestamp created_at
        timestamp updated_at
    }

    Hospital {
        uuid id PK
        uuid organization_id FK
        string cnes_code UK
        timestamp created_at
        timestamp updated_at
    }

    Hotel {
        uuid id PK
        uuid organization_id FK
        uuid municipality_id FK
        timestamp created_at
        timestamp updated_at
    }

    Specialty {
        uuid id PK
        string name UK
        string description
        boolean is_active
        timestamp created_at
    }

    DoctorSpecialty {
        uuid doctor_id FK
        uuid specialty_id FK
    }

    HospitalSpecialty {
        uuid hospital_id FK
        uuid specialty_id FK
    }

    Doctor {
        uuid id PK
        uuid person_id FK
        string crm UK
        boolean is_active
        timestamp created_at
        timestamp updated_at
    }

    Status {
        uuid id PK
        string code UK
        string label
        int sort_order
        boolean is_active
        timestamp created_at
    }

    Module {
        uuid id PK
        string code UK
        string name
        string description
        boolean is_active
        timestamp created_at
    }

    ModuleStatus {
        uuid module_id FK
        uuid status_id FK
        int sort_order
    }

    TfdRequest {
        uuid id PK
        string protocol_number UK
        uuid patient_person_id FK
        uuid companion_person_id FK
        uuid requesting_doctor_id FK
        uuid destination_hospital_id FK
        uuid hotel_id FK
        uuid municipality_id FK
        uuid created_by_principal_id FK
        uuid status_id FK
        string diagnosis_cid
        string procedure_description
        string justification
        date request_date
        date travel_date
        date return_date
        string transport_type
        decimal estimated_cost
        string notes
        timestamp created_at
        timestamp updated_at
    }

    Principal ||--o| Person : "is a person"
    Principal ||--o| Organization : "is an organization"
    Principal ||--o{ PrincipalRole : "has"
    Role ||--o{ PrincipalRole : "assigned to"
    Role ||--o{ RolePermission : "has"
    Permission ||--o{ RolePermission : "granted in"
    Principal ||--o{ PrincipalOrganization : "belongs to"
    Organization ||--o{ PrincipalOrganization : "has members"

    Person ||--|| PersonIdentification : "identified by"
    Person ||--o| Address : "lives at"
    Person ||--o{ PersonContact : "has"
    Contact ||--o{ PersonContact : "linked to"

    Organization ||--o| Address : "located at"
    Organization ||--o{ OrganizationContact : "has"
    Contact ||--o{ OrganizationContact : "linked to"
    Organization ||--o| Municipality : "is a"
    Organization ||--o| Hospital : "is a"
    Organization ||--o| Hotel : "is a"
    Municipality ||--o{ Hotel : "contracted"

    Person ||--o| Doctor : "can be"
    Doctor ||--o{ DoctorSpecialty : "has"
    Specialty ||--o{ DoctorSpecialty : "assigned to"
    Hospital ||--o{ HospitalSpecialty : "offers"
    Specialty ||--o{ HospitalSpecialty : "available at"

    Module ||--o{ ModuleStatus : "uses"
    Status ||--o{ ModuleStatus : "available in"
    TfdRequest }o--|| Status : "current state"

    TfdRequest }o--|| Person : "patient"
    TfdRequest }o--o| Person : "companion"
    TfdRequest }o--|| Doctor : "requested by"
    TfdRequest }o--|| Hospital : "destination"
    TfdRequest }o--o| Hotel : "lodging"
    TfdRequest }o--|| Municipality : "belongs to"
    TfdRequest }o--|| Principal : "created by"
```

---

## 5. Autenticação & Autorização

### 5.1 Modelo: RBAC com Permissões Granulares

- **Principal** autentica via username/password
- **JWT** contém: sub (principal_id), organization_id (contexto ativo), roles, permissions
- **NestJS Guards** validam roles/permissions por endpoint
- **organization_id** no JWT é resolvido para Municipality ao criar TfdRequest

### 5.2 JWT Payload

```json
{
  "sub": "principal-uuid",
  "organization_id": "org-uuid",
  "roles": ["operator_tfd"],
  "permissions": ["tfd_request:create", "tfd_request:read", "person:create"]
}
```

### 5.3 Roles Iniciais

| Role | Descrição |
|------|-----------|
| super_admin | Administrador da plataforma |
| admin_municipality | Administrador da prefeitura |
| operator_tfd | Operador de TFD |
| viewer | Apenas visualização |

---

## 6. Frontend (Next.js)

### 6.1 Estrutura de Rotas

```
/                       → Dashboard
/auth/login             → Login
/tfd/requests           → Lista de solicitações TFD
/tfd/requests/new       → Nova solicitação (multi-step)
/tfd/requests/[id]      → Detalhe da solicitação
/admin/users            → Gestão de usuários
/admin/organizations    → Gestão de organizações
```

### 6.2 Formulário de Nova Solicitação TFD (Multi-step)

1. **Paciente** — Buscar por CPF ou cartão SUS, ou cadastrar novo
2. **Acompanhante** — Opcional, buscar ou cadastrar
3. **Médico Solicitante** — Selecionar médico e especialidade
4. **Hospital Destino** — Selecionar hospital e especialidade
5. **Dados Clínicos** — CID, procedimento, justificativa, datas
6. **Revisão** — Confirmar e submeter

### 6.3 UI

- Tailwind CSS + shadcn/ui
- React Hook Form + Zod (validação)
- Responsivo (mobile-first)

---

## 7. Status Flow do TFD

```
draft → pending → approved → scheduled → completed
                → rejected
         ↕
      cancelled
```

---

## 8. Decisões Técnicas

| Decisão | Escolha | Justificativa |
|---------|---------|---------------|
| Monorepo | Turborepo + pnpm | Tipos compartilhados, build otimizado |
| Frontend | Next.js 15 | SSR, App Router, deploy nativo Vercel |
| Backend | NestJS | Modular, DI, guards, integração TypeORM |
| ORM | TypeORM | Decorators, migrations, entities tipadas |
| DB | PostgreSQL | Robusto, JSON support, bom para dados relacionais |
| Auth | RBAC + permissões granulares | Flexível para múltiplos módulos futuros |
| Deploy FE | Vercel | Otimizado para Next.js |
| Deploy BE | Railway | Container managed para NestJS + PostgreSQL |

---

## 9. Entrega em Etapas

### Etapa 1 — Fundação
- Monorepo setup (Turborepo, pnpm, configs)
- Package shared (DTOs, interfaces, enums)
- GitHub repo

### Etapa 2 — Backend Core
- NestJS scaffold + TypeORM + PostgreSQL
- Entities base (Principal, Person, Organization, Address, Contact)
- Auth module (JWT, login, guards)

### Etapa 3 — Backend TFD
- Entities TFD (Doctor, Hospital, Hotel, Municipality, Specialty, Status, Module, TfdRequest)
- CRUD endpoints TFD
- Seed data

### Etapa 4 — Frontend Core
- Next.js scaffold + Tailwind + shadcn/ui
- Layout, auth pages, dashboard
- API client

### Etapa 5 — Frontend TFD
- Formulário multi-step de solicitação TFD
- Lista e detalhe de solicitações
- Integração com backend

### Etapa 6 — Deploy
- Vercel (frontend)
- Railway (backend + PostgreSQL)
- Variáveis de ambiente

---

*Documento aprovado pelo stakeholder em 2025-06-20.*
