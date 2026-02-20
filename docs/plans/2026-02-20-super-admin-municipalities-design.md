# Design: Super Admin e Gestão de Municípios

**Data:** 2026-02-20
**Status:** Aprovado

---

## Contexto

O sistema atual possui apenas um usuário `admin` com role `admin_municipality` vinculado ao município de Camaçari. Não existe um administrador global da plataforma nem telas para criar municípios e seus administradores.

Este documento descreve a adição de:
1. Usuário `superadmin` global (sem vínculo com município)
2. Módulo `admin` no backend com endpoints de gestão
3. Área `/admin` no frontend com layout próprio

---

## Decisões

| Decisão | Escolha |
|---------|---------|
| Layout do super_admin | Área separada `/admin` com layout próprio |
| Fluxo de criação | Município + primeiro admin num único formulário/endpoint |
| Abordagem de implementação | Módulo `admin` separado (A) com endpoint de onboarding (C) |

---

## 1. Seed

O `seed.ts` existente cria `admin` (admin_municipality). Será adicionado um segundo bloco:

- `Person`: firstName="Admin", lastName="Sistema"
- `Principal`: username=`superadmin`, password=`superadmin123`
- Role: `super_admin` (já existe)
- `organization = null` — sem vínculo com município
- JWT resultante: `{ sub, organizationId: '', roles: ['super_admin'], permissions: [...] }`

Também serão adicionadas as permissões novas ao seed e à role `super_admin`:
- `municipality:create`
- `municipality:read`
- `principal:create`
- `principal:read`

---

## 2. Backend — Módulo Admin

### Estrutura

```
apps/api/src/admin/
  admin.module.ts
  admin.controller.ts
  admin.service.ts
  dto/
    create-municipality.dto.ts
```

### Guards

Todos os endpoints do módulo `admin` requerem:
- `JwtAuthGuard` (token válido)
- `RolesGuard` com `@Roles('super_admin')`

### Endpoints

| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/admin/municipalities` | Lista todos os municípios com organização |
| POST | `/admin/municipalities` | Cria município + admin (transação atômica) |
| GET | `/admin/municipalities/:id` | Detalhe do município |
| GET | `/admin/users` | Lista todos os principals com roles e organização |

### DTO `CreateMunicipalityDto`

```typescript
class MunicipalityDataDto {
  name: string;       // nome da prefeitura
  cnpj: string;
  ibgeCode: string;
  state: string;      // UF (2 chars)
  city: string;
  street: string;
  number: string;
  neighborhood?: string;
  zipCode?: string;
}

class AdminDataDto {
  username: string;
  password: string;
  firstName: string;
  lastName: string;
  cpf: string;
}

class CreateMunicipalityDto {
  municipality: MunicipalityDataDto;
  admin: AdminDataDto;
}
```

### Transação de criação (`POST /admin/municipalities`)

1. `Address` ← dados de endereço
2. `Organization` ← name, cnpj, isActive=true, address
3. `Municipality` ← ibgeCode, state, organization
4. `Person` ← firstName, lastName, gender=NOT_INFORMED
5. `PersonIdentification` ← cpf, person
6. `Principal` ← username, passwordHash, person, organization=orgEntity
7. `principal.roles = [admin_municipality]`
8. `principal.organizations = [orgEntity]`
9. Commit transação

---

## 3. Frontend — Área `/admin`

### Estrutura de rotas

```
apps/web/src/app/admin/
  layout.tsx             ← verifica role super_admin, layout próprio
  page.tsx               ← redirect para /admin/municipalities
  municipalities/
    page.tsx             ← lista de municípios (tabela)
    new/
      page.tsx           ← formulário 2 passos
  users/
    page.tsx             ← lista de principals (somente leitura)
```

### Layout `/admin`

- Sidebar próprio com links: **Municípios** e **Usuários**
- Header com "GovMunicípio — Administração da Plataforma"
- Proteção: lê token JWT do localStorage, verifica `roles.includes('super_admin')`, senão redireciona para `/dashboard`

### Tela de Municípios (`/admin/municipalities`)

- Tabela com colunas: Nome, CNPJ, Estado, Código IBGE, Ativo
- Botão "Novo Município"

### Formulário Novo Município (`/admin/municipalities/new`)

**Passo 1 — Dados do Município:**
- Nome da prefeitura, CNPJ, Código IBGE, UF
- Endereço: rua, número, bairro, CEP, cidade

**Passo 2 — Primeiro Administrador:**
- Username, Senha, Nome, Sobrenome, CPF

Submissão: `POST /admin/municipalities` com ambos os conjuntos de dados.

### Tela de Usuários (`/admin/users`)

- Tabela com colunas: Username, Nome, Roles, Organização, Ativo
- Somente leitura (CRUD de usuários pode ser adicionado em iteração futura)

---

## 4. Proteção de Acesso

O `super_admin` sem `organizationId` não deve acessar dados de TFD (que são filtrados por `organizationId`). Reciprocamente, o `admin_municipality` não deve acessar `/admin`.

A verificação de role `super_admin` no frontend é feita pelo layout `/admin/layout.tsx` via JWT claims. No backend, o `RolesGuard` valida a role no token.

---

## Entregas

1. `seed.ts` — bloco superadmin + permissões novas
2. `apps/api/src/admin/` — módulo com 4 endpoints
3. `apps/web/src/app/admin/` — 4 páginas com layout próprio
