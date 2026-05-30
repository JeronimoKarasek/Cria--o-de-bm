# Changelog — Refatoração para Supabase + Vercel

## 1.0.0 — 2026-05-11

### 🆕 Adicionado
- **Camada Supabase**: `lib/supabase.ts` (Anon + Service Role) e `lib/storage.ts` (Storage com signed URLs).
- **Webhook do Meta** em `app/api/meta-webhook/route.ts` com verificação de assinatura `X-Hub-Signature-256` (HMAC SHA-256, timing-safe).
- **Rotas de domínios** (`app/api/dominios/*`) com integração Graph API (add, verify).
- **Rotas de templates** (`app/api/templates/*`) com criação/exclusão via Graph API.
- **Funções Graph API** adicionais em `lib/meta-api.ts`:
  - `createBusiness` (criar BM)
  - `createWABA` (criar WhatsApp Business Account)
  - `addPhoneNumber` (adicionar número)
  - `getOwnedDomains`, `addOwnedDomain`, `verifyDomain`
  - `createMessageTemplate`, `deleteMessageTemplate`, `subscribeAppToWABA`
  - `debugToken`, `getMe`, `listAccessibleBusinesses`
- **Migration SQL idempotente** em `supabase/migrations/0001_initial_schema.sql` (CREATE IF NOT EXISTS, sem DROP).
- **Script de migração segura** `scripts/apply-supabase-migrations.js` (bloqueia comandos destrutivos).
- **Tabelas novas**:
  - `dominios_verificacao` — domínios de cada empresa
  - `message_templates` — templates WhatsApp
  - `webhook_events` — auditoria de webhooks
- **Trigger automático de `updated_at`** em todas as tabelas.
- **`vercel.json`** com regions=gru1 + timeout específico para rotas de import/sync/webhook.
- **`.env.example`** completo.
- **README + CHANGELOG**.

### 🔧 Corrigido
- **Prisma client duplicado**: removido `lib/db.ts`, mantido apenas `lib/prisma.ts`.
- **`schema.prisma`**: removido `output` absoluto (`/home/ubuntu/...`) que quebrava build na Vercel.
- **`schema.prisma`**: ajustado `binaryTargets` para `["native", "rhel-openssl-3.0.x"]` (compatível com Vercel).
- **`@@map` em todas as tabelas**: snake_case no banco, camelCase no Prisma client.
- **`next.config.js`**: removido `outputFileTracingRoot: '../'` que quebrava a detecção de root pela Vercel.
- **`app/layout.tsx`**: removido `<script src="https://apps.abacus.ai/chatllm/appllm-lib.js" />` (vinculação ao Abacus.AI).
- **`package.json`**: removidas ~40 dependências não usadas (plotly, dayjs, formik, lodash, jotai, zustand, maplibre-gl, csv, jsonwebtoken, react-select, etc.), versões atualizadas e travadas.
- **`tailwind.config.ts`**: reescrita com paths corretos (`./app`, `./components`, `./lib`).
- **`middleware.ts`**: liberada rota `/api/meta-webhook` (precisa ser pública para o Meta enviar eventos).

### 🗑️ Removido
- **AWS S3** (`@aws-sdk/*`, `@azure/storage-blob`) — substituído por Supabase Storage.
- **`lib/aws-config.ts` e `lib/s3.ts`** — substituídos por `lib/storage.ts`.
- **`.env` versionado** (com secrets) — agora apenas `.env.example` no repo.
- **Banco `db005.hosteddb.reai.io`** — substituído por Supabase.
- **Pasta `meta_verification_system/nextjs_space/`** — projeto agora vive na raiz para Vercel detectar automaticamente. (Backup preservado em `_backup/`.)

### 🔐 Segurança
- Webhook valida `X-Hub-Signature-256` antes de processar.
- App Secret + Access Tokens nunca são logados (apenas mascarados nas respostas GET de config).
- `seed.ts` é idempotente (não recria admin se já existe).
- `safe-seed.ts` aborta se detectar operações destrutivas no seed.

---

## 1.1.0 — 2026-05-30

### 🆕 Adicionado — Sistema de Warming (Aquecimento Gradual)

- **Migration SQL** `0003_warming_system.sql`:
  - Enum `WarmingStage` (COLD → WARMING_1_3 → ... → ACTIVE)
  - 8 colunas novas em `numeros_whatsapp` (warming_stage, warming_day, daily_msg_count, etc)
  - Tabela `warming_log` (histórico diário de aquecimento)
  - Funções PostgreSQL: `calc_warming_stage()`, `calc_daily_limit()`, `advance_warming_day()`, `can_send_message()`

- **API de Warming** `/api/numeros-whatsapp/[id]/warming`:
  - `GET` — status completo de aquecimento
  - `PATCH` — ações: start, pause, resume, reset

- **Lib `lib/warming.ts`**:
  - `canSendMessage()` — verificação pré-envio (rate limiting + qualidade)
  - `registerMessageSent()` — incrementa contadores após envio
  - `advanceWarmingDay()` — cronjob diário para avançar estágios
  - `getWarmingSummary()` — métricas agregadas para dashboard

- **Componente `WarmingPanel`** — painel de aquecimento por número
- **Dashboard `/warming`** — visão geral com cards, filtros e lista

- **Prisma Schema** atualizado com campos de warming + modelo `WarmingLog`

### 📊 Limites por estágio
| Dia | Estágio | Msgs/dia |
|---|---|---|
| 0 | COLD | 10 |
| 1-3 | WARMING_1_3 | 20 |
| 4-7 | WARMING_4_7 | 50 |
| 8-14 | WARMING_8_14 | 150 |
| 15-21 | WARMING_15_21 | 500 |
| 22+ | ACTIVE | 2000 |

---

## Migrations futuras

Para adicionar colunas/tabelas:

1. Crie `supabase/migrations/000N_descricao.sql` usando **apenas** `CREATE … IF NOT EXISTS` e `ALTER TABLE … ADD COLUMN IF NOT EXISTS`.
2. Rode `node scripts/apply-supabase-migrations.js`.
3. Atualize `prisma/schema.prisma` e rode `npx prisma generate`.
