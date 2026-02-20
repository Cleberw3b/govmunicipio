# Deploy do Backend no Railway

Este guia descreve como fazer o deploy da API (`apps/api`) no Railway com PostgreSQL gerenciado.

---

## Pré-requisitos

- Conta no [Railway](https://railway.app)
- Railway CLI instalado: `npm install -g @railway/cli`
- Repositório do projeto no GitHub: `Cleberw3b/govmunicipio`

---

## 1. Criar o Projeto no Railway

### Via Dashboard

1. Acesse [railway.app](https://railway.app) e clique em **New Project**
2. Selecione **Deploy from GitHub repo**
3. Autorize o Railway a acessar sua conta GitHub
4. Selecione o repositório `Cleberw3b/govmunicipio`

### Via CLI

```bash
railway login
railway init
# Selecione "Empty Project" e nomeie como "govmunicipio"
```

---

## 2. Adicionar PostgreSQL

No dashboard do Railway, dentro do projeto:

1. Clique em **+ New** → **Database** → **Add PostgreSQL**
2. O Railway criará automaticamente um banco e injetará a variável `DATABASE_URL`

---

## 3. Configurar o Serviço da API

### Root Directory

No serviço da API, configure o **Root Directory** como `apps/api` nas Settings do serviço.

### Build Command

```
pnpm install && pnpm build
```

### Start Command

```
node dist/main.js
```

### Watch Paths

Configure para re-fazer deploy apenas quando arquivos relevantes mudarem:

```
apps/api/**
packages/shared/**
package.json
pnpm-lock.yaml
```

---

## 4. Variáveis de Ambiente

Configure as seguintes variáveis de ambiente no Railway (Settings → Variables):

```env
# Banco de dados (fornecida automaticamente pelo Railway PostgreSQL)
DATABASE_URL=${{Postgres.DATABASE_URL}}

# JWT
JWT_SECRET=sua_chave_secreta_forte_aqui
JWT_EXPIRATION=7d

# Aplicação
NODE_ENV=production
PORT=3001

# CORS - URL do frontend no Vercel
CORS_ORIGIN=https://govmunicipio.vercel.app
```

> **Importante**: Para `JWT_SECRET`, use uma string aleatória de pelo menos 64 caracteres.
> Gere com: `openssl rand -base64 64`

---

## 5. Configurar CORS na API

Edite `apps/api/src/main.ts` para ler o CORS_ORIGIN da variável de ambiente:

```typescript
app.enableCors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  credentials: true,
});
```

---

## 6. Configurar TypeORM para Produção

O `apps/api/src/database/database.module.ts` já usa `synchronize: false` em produção.
Para aplicar o schema inicial, execute as migrations:

```bash
# Gerar migration a partir das entities
railway run pnpm typeorm migration:generate -- -d src/database/data-source.ts src/database/migrations/InitialSchema

# Rodar migrations
railway run pnpm typeorm migration:run -- -d src/database/data-source.ts
```

Ou, para ambiente de desenvolvimento inicial, defina `DB_SYNCHRONIZE=true` temporariamente nas variáveis de ambiente (remova após o primeiro deploy).

---

## 7. Executar Seed Inicial

Após o primeiro deploy e com `DB_SYNCHRONIZE=true`:

```bash
railway run pnpm seed
```

Isso criará:
- Módulo TFD com statuses (Solicitado, Em Análise, Aprovado, Negado, etc.)
- Roles e Permissions (super_admin, admin_municipality, operator_tfd, viewer)
- 8 especialidades médicas
- Usuário administrador padrão: `admin` / `admin123`

> **Segurança**: Troque a senha do admin imediatamente após o primeiro login.

---

## 8. Verificar o Deploy

Após o deploy, a API estará disponível na URL fornecida pelo Railway (ex: `https://govmunicipio-api.up.railway.app`).

Verifique o health check:

```bash
curl https://govmunicipio-api.up.railway.app/health
# Esperado: {"status":"ok"}
```

---

## 9. Conectar o Frontend à API

No Vercel, adicione a variável de ambiente no projeto `govmunicipio`:

```env
NEXT_PUBLIC_API_URL=https://govmunicipio-api.up.railway.app
```

E atualize `apps/web/src/lib/api.ts` para usar essa variável:

```typescript
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
```

Após alterar, refaça o deploy do frontend com:

```bash
vercel deploy --prod
```

---

## 10. Estrutura Final de Deploy

```
GitHub (Cleberw3b/govmunicipio)
│
├── apps/web  ──────────────────►  Vercel
│                                  URL: https://govmunicipio.vercel.app
│
└── apps/api  ──────────────────►  Railway
                                   URL: https://govmunicipio-api.up.railway.app
                                   DB: Railway PostgreSQL (gerenciado)
```

---

## Comandos Úteis

```bash
# Ver logs da API no Railway
railway logs

# Abrir dashboard do projeto
railway open

# Executar comando no ambiente Railway
railway run <comando>

# Ver variáveis de ambiente configuradas
railway variables
```

---

## Troubleshooting

### Erro: "Cannot find module '@govmunicipio/shared'"

Certifique-se de que o build do monorepo está compilando o pacote shared antes da api.
Verifique se o `turbo.json` tem `^build` como dependência do pipeline de build.

### Erro: "SSL required" no PostgreSQL

O Railway exige SSL. Adicione ao `database.module.ts`:

```typescript
ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
```

### Deploy não atualiza após push

Verifique se o Watch Paths está configurado corretamente ou force um redeploy manual no dashboard.
