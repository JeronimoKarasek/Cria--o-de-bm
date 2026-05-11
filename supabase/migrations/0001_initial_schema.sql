-- ============================================================
-- MIGRATION: 0001_initial_schema.sql
-- Sistema de Validação de BM + WhatsApp Business
-- Banco: Supabase Postgres
-- IMPORTANTE: Todas as instruções usam IF NOT EXISTS para
-- garantir que NUNCA derrubem tabelas/colunas existentes.
-- ============================================================

-- Habilita extensão necessária para gen_random_uuid (caso queira usar futuramente)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ------------------------------------------------------------
-- ENUM TYPES
-- ------------------------------------------------------------
DO $$ BEGIN
  CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'FUNCIONARIO');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "EmpresaStatus" AS ENUM ('PENDENTE', 'EM_ANALISE', 'APROVADA', 'REJEITADA');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "DocumentoTipo" AS ENUM ('CNPJ_CARTAO', 'CONTRATO_SOCIAL', 'PROCURACAO', 'COMPROVANTE_ENDERECO', 'IDENTIDADE', 'OUTRO');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "DocumentoStatus" AS ENUM ('PENDENTE', 'APROVADO', 'REJEITADO');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "ContaMetaStatus" AS ENUM ('ATIVA', 'DESATIVADA', 'EM_REVISAO', 'SUSPENSA', 'CANCELADA', 'RESTRITA');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ------------------------------------------------------------
-- USERS
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.users (
  id          TEXT PRIMARY KEY,
  email       TEXT NOT NULL UNIQUE,
  name        TEXT NOT NULL,
  password    TEXT NOT NULL,
  role        "UserRole" NOT NULL DEFAULT 'FUNCIONARIO',
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS users_email_idx ON public.users(email);

-- ------------------------------------------------------------
-- EMPRESAS
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.empresas (
  id              TEXT PRIMARY KEY,
  razao_social    TEXT NOT NULL,
  nome_fantasia   TEXT NOT NULL,
  cnpj            TEXT NOT NULL UNIQUE,
  segmento        TEXT NOT NULL,
  email           TEXT NOT NULL,
  telefone        TEXT,
  website         TEXT,
  endereco        TEXT,
  cidade          TEXT,
  estado          TEXT,
  cep             TEXT,
  status          "EmpresaStatus" NOT NULL DEFAULT 'PENDENTE',
  trust_score     INTEGER NOT NULL DEFAULT 0,
  observacoes     TEXT,
  criado_por_id   TEXT NOT NULL REFERENCES public.users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS empresas_cnpj_idx ON public.empresas(cnpj);
CREATE INDEX IF NOT EXISTS empresas_status_idx ON public.empresas(status);
CREATE INDEX IF NOT EXISTS empresas_criado_por_idx ON public.empresas(criado_por_id);

-- ------------------------------------------------------------
-- DOCUMENTOS
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.documentos (
  id                  TEXT PRIMARY KEY,
  tipo                "DocumentoTipo" NOT NULL,
  nome                TEXT NOT NULL,
  cloud_storage_path  TEXT NOT NULL,
  is_public           BOOLEAN NOT NULL DEFAULT false,
  status              "DocumentoStatus" NOT NULL DEFAULT 'PENDENTE',
  observacao          TEXT,
  empresa_id          TEXT NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS documentos_empresa_idx ON public.documentos(empresa_id);
CREATE INDEX IF NOT EXISTS documentos_tipo_idx ON public.documentos(tipo);

-- ------------------------------------------------------------
-- CONTAS META (Business Manager)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.contas_meta (
  id                  TEXT PRIMARY KEY,
  nome                TEXT NOT NULL,
  meta_business_id    TEXT,
  ad_account_id       TEXT,
  waba_id             TEXT,
  app_id              TEXT,
  access_token        TEXT,
  status              "ContaMetaStatus" NOT NULL DEFAULT 'ATIVA',
  tipo                TEXT NOT NULL DEFAULT 'Business Manager',
  verificacao_status  TEXT DEFAULT 'NAO_VERIFICADA',
  observacoes         TEXT,
  motivo_restricao    TEXT,
  data_restricao      TIMESTAMPTZ,
  recurso_enviado     BOOLEAN NOT NULL DEFAULT false,
  data_recurso        TIMESTAMPTZ,
  recurso_descricao   TEXT,
  empresa_id          TEXT NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS contas_meta_empresa_idx ON public.contas_meta(empresa_id);
CREATE INDEX IF NOT EXISTS contas_meta_status_idx ON public.contas_meta(status);

-- ------------------------------------------------------------
-- NÚMEROS WHATSAPP
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.numeros_whatsapp (
  id                  TEXT PRIMARY KEY,
  numero              TEXT NOT NULL,
  phone_number_id     TEXT UNIQUE,
  display_name        TEXT,
  quality_rating      TEXT DEFAULT 'GREEN',
  status              TEXT NOT NULL DEFAULT 'PENDENTE',
  codigo_verificacao  TEXT,
  pin_2fa             TEXT,
  limite_msg          TEXT DEFAULT '250',
  categoria           TEXT DEFAULT 'UTILITY',
  conta_meta_id       TEXT NOT NULL REFERENCES public.contas_meta(id) ON DELETE CASCADE,
  empresa_id          TEXT NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS numeros_conta_idx ON public.numeros_whatsapp(conta_meta_id);
CREATE INDEX IF NOT EXISTS numeros_empresa_idx ON public.numeros_whatsapp(empresa_id);
CREATE INDEX IF NOT EXISTS numeros_status_idx ON public.numeros_whatsapp(status);

-- ------------------------------------------------------------
-- CONTAS META HISTÓRICO
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.contas_meta_historico (
  id                TEXT PRIMARY KEY,
  status_anterior   TEXT NOT NULL,
  status_novo       TEXT NOT NULL,
  motivo            TEXT,
  conta_meta_id     TEXT NOT NULL REFERENCES public.contas_meta(id) ON DELETE CASCADE,
  criado_por_id     TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS conta_historico_conta_idx ON public.contas_meta_historico(conta_meta_id);
CREATE INDEX IF NOT EXISTS conta_historico_created_idx ON public.contas_meta_historico(created_at);

-- ------------------------------------------------------------
-- SITES DE VERIFICAÇÃO
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.sites_verificacao (
  id                    TEXT PRIMARY KEY,
  dominio               TEXT,
  template              TEXT NOT NULL DEFAULT 'institucional',
  segmento              TEXT NOT NULL,
  nome_empresa          TEXT NOT NULL,
  descricao             TEXT,
  cor_primaria          TEXT NOT NULL DEFAULT '#1877F2',
  cor_secundaria        TEXT NOT NULL DEFAULT '#42B72A',
  incluir_termos        BOOLEAN NOT NULL DEFAULT true,
  incluir_privacidade   BOOLEAN NOT NULL DEFAULT true,
  incluir_lgpd          BOOLEAN NOT NULL DEFAULT true,
  conteudo_gerado       TEXT,
  status                TEXT NOT NULL DEFAULT 'rascunho',
  empresa_id            TEXT NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS sites_empresa_idx ON public.sites_verificacao(empresa_id);

-- ------------------------------------------------------------
-- TRUST SCORE HISTÓRICO
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.trust_score_historico (
  id          TEXT PRIMARY KEY,
  score       INTEGER NOT NULL,
  detalhes    TEXT,
  empresa_id  TEXT NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS trust_score_empresa_idx ON public.trust_score_historico(empresa_id);
CREATE INDEX IF NOT EXISTS trust_score_created_idx ON public.trust_score_historico(created_at);

-- ------------------------------------------------------------
-- META API CONFIG
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.meta_api_config (
  id                  TEXT PRIMARY KEY,
  app_id              TEXT NOT NULL,
  app_secret          TEXT,
  access_token        TEXT,
  webhook_token       TEXT,
  graph_api_version   TEXT NOT NULL DEFAULT 'v21.0',
  ativo               BOOLEAN NOT NULL DEFAULT true,
  descricao           TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ------------------------------------------------------------
-- DOMÍNIOS DE VERIFICAÇÃO
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.dominios_verificacao (
  id                  TEXT PRIMARY KEY,
  dominio             TEXT NOT NULL,
  domain_id           TEXT,
  verificado          BOOLEAN NOT NULL DEFAULT false,
  metodo              TEXT,
  token_verificacao   TEXT,
  ultimo_check        TIMESTAMPTZ,
  empresa_id          TEXT NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (empresa_id, dominio)
);
CREATE INDEX IF NOT EXISTS dominios_empresa_idx ON public.dominios_verificacao(empresa_id);

-- ------------------------------------------------------------
-- MESSAGE TEMPLATES
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.message_templates (
  id                TEXT PRIMARY KEY,
  name              TEXT NOT NULL,
  template_id       TEXT,
  status            TEXT NOT NULL DEFAULT 'PENDING',
  category          TEXT NOT NULL DEFAULT 'UTILITY',
  language          TEXT NOT NULL DEFAULT 'pt_BR',
  components        TEXT,
  rejection_reason  TEXT,
  quality_score     TEXT,
  conta_meta_id     TEXT NOT NULL REFERENCES public.contas_meta(id) ON DELETE CASCADE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS templates_conta_idx ON public.message_templates(conta_meta_id);
CREATE INDEX IF NOT EXISTS templates_status_idx ON public.message_templates(status);

-- ------------------------------------------------------------
-- WEBHOOK EVENTS
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.webhook_events (
  id            TEXT PRIMARY KEY,
  event         TEXT NOT NULL,
  payload       TEXT NOT NULL,
  signature_ok  BOOLEAN NOT NULL DEFAULT false,
  processed     BOOLEAN NOT NULL DEFAULT false,
  error_msg     TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS webhook_event_idx ON public.webhook_events(event);
CREATE INDEX IF NOT EXISTS webhook_processed_idx ON public.webhook_events(processed);
CREATE INDEX IF NOT EXISTS webhook_created_idx ON public.webhook_events(created_at);

-- ------------------------------------------------------------
-- AUDIT LOGS
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id          TEXT PRIMARY KEY,
  acao        TEXT NOT NULL,
  descricao   TEXT NOT NULL,
  entidade    TEXT NOT NULL,
  entidade_id TEXT,
  user_id     TEXT REFERENCES public.users(id),
  empresa_id  TEXT REFERENCES public.empresas(id) ON DELETE SET NULL,
  metadata    TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS audit_user_idx ON public.audit_logs(user_id);
CREATE INDEX IF NOT EXISTS audit_empresa_idx ON public.audit_logs(empresa_id);
CREATE INDEX IF NOT EXISTS audit_created_idx ON public.audit_logs(created_at);

-- ------------------------------------------------------------
-- TRIGGER para updated_at automático
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.tg_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Aplica trigger em todas as tabelas que têm updated_at
DO $$
DECLARE
  t TEXT;
BEGIN
  FOR t IN
    SELECT c.table_name
    FROM information_schema.columns c
    WHERE c.table_schema = 'public'
      AND c.column_name = 'updated_at'
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS set_updated_at ON public.%I;', t);
    EXECUTE format('CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();', t);
  END LOOP;
END $$;

-- ------------------------------------------------------------
-- STORAGE BUCKET (documentos)
-- ------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public)
VALUES ('documentos', 'documentos', false)
ON CONFLICT (id) DO NOTHING;

-- ------------------------------------------------------------
-- ROW LEVEL SECURITY (preparado, desabilitado por padrão)
-- Para ativar, basta executar: ALTER TABLE ... ENABLE ROW LEVEL SECURITY;
-- O sistema usa NextAuth + service role; RLS é opcional.
-- ------------------------------------------------------------
