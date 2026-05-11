-- ============================================================================
-- MIGRATION: 0002_full_schema_with_policies.sql
-- Sistema: Criação de BM + Validação de Empresa + WhatsApp Business
-- Banco: Supabase Postgres
--
-- ⚠️  GARANTIAS DE SEGURANÇA
-- ----------------------------------------------------------------------------
--  • Todas as instruções usam IF NOT EXISTS / DO blocks idempotentes.
--  • NENHUM comando DROP TABLE, DROP SCHEMA, TRUNCATE ou DELETE é executado.
--  • Pode ser executado MÚLTIPLAS VEZES sem efeitos colaterais.
--  • Pode ser executado em banco com dados — nada é apagado.
--  • Tabelas/colunas pré-existentes com mesmo nome são preservadas.
--  • Triggers/políticas são recriadas (DROP TRIGGER IF EXISTS) sem afetar dados.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 0) EXTENSÕES
-- ----------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS citext;

-- ============================================================================
-- 1) ENUM TYPES
-- ============================================================================
DO $$ BEGIN
  CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'FUNCIONARIO');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "EmpresaStatus" AS ENUM (
    'PENDENTE', 'EM_ANALISE', 'APROVADA', 'REJEITADA'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "DocumentoTipo" AS ENUM (
    'CNPJ_CARTAO', 'CONTRATO_SOCIAL', 'PROCURACAO',
    'COMPROVANTE_ENDERECO', 'IDENTIDADE', 'OUTRO'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "DocumentoStatus" AS ENUM (
    'PENDENTE', 'APROVADO', 'REJEITADO'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "ContaMetaStatus" AS ENUM (
    'ATIVA', 'DESATIVADA', 'EM_REVISAO', 'SUSPENSA', 'CANCELADA', 'RESTRITA'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================================================
-- 2) TABELAS
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 2.1) USERS
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.users (
  id          TEXT        PRIMARY KEY,
  email       TEXT        NOT NULL UNIQUE,
  name        TEXT        NOT NULL,
  password    TEXT        NOT NULL,
  role        "UserRole"  NOT NULL DEFAULT 'FUNCIONARIO',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS users_email_idx ON public.users(email);
CREATE INDEX IF NOT EXISTS users_role_idx  ON public.users(role);

-- ----------------------------------------------------------------------------
-- 2.2) EMPRESAS
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.empresas (
  id             TEXT             PRIMARY KEY,
  razao_social   TEXT             NOT NULL,
  nome_fantasia  TEXT             NOT NULL,
  cnpj           TEXT             NOT NULL UNIQUE,
  segmento       TEXT             NOT NULL,
  email          TEXT             NOT NULL,
  telefone       TEXT,
  website        TEXT,
  endereco       TEXT,
  cidade         TEXT,
  estado         TEXT,
  cep            TEXT,
  status         "EmpresaStatus"  NOT NULL DEFAULT 'PENDENTE',
  trust_score    INTEGER          NOT NULL DEFAULT 0,
  observacoes    TEXT,
  criado_por_id  TEXT             NOT NULL,
  created_at     TIMESTAMPTZ      NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ      NOT NULL DEFAULT now()
);

-- FK empresas.criado_por_id -> users.id  (apenas se ainda não existir)
DO $$ BEGIN
  ALTER TABLE public.empresas
    ADD CONSTRAINT empresas_criado_por_fk
    FOREIGN KEY (criado_por_id) REFERENCES public.users(id)
    ON UPDATE CASCADE ON DELETE RESTRICT;
EXCEPTION WHEN duplicate_object THEN NULL;
         WHEN invalid_foreign_key THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS empresas_cnpj_idx        ON public.empresas(cnpj);
CREATE INDEX IF NOT EXISTS empresas_status_idx      ON public.empresas(status);
CREATE INDEX IF NOT EXISTS empresas_criado_por_idx  ON public.empresas(criado_por_id);
CREATE INDEX IF NOT EXISTS empresas_segmento_idx    ON public.empresas(segmento);
CREATE INDEX IF NOT EXISTS empresas_trust_score_idx ON public.empresas(trust_score);

-- ----------------------------------------------------------------------------
-- 2.3) DOCUMENTOS
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.documentos (
  id                  TEXT              PRIMARY KEY,
  tipo                "DocumentoTipo"   NOT NULL,
  nome                TEXT              NOT NULL,
  cloud_storage_path  TEXT              NOT NULL,
  is_public           BOOLEAN           NOT NULL DEFAULT false,
  status              "DocumentoStatus" NOT NULL DEFAULT 'PENDENTE',
  observacao          TEXT,
  empresa_id          TEXT              NOT NULL,
  created_at          TIMESTAMPTZ       NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ       NOT NULL DEFAULT now()
);

DO $$ BEGIN
  ALTER TABLE public.documentos
    ADD CONSTRAINT documentos_empresa_fk
    FOREIGN KEY (empresa_id) REFERENCES public.empresas(id)
    ON UPDATE CASCADE ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
         WHEN invalid_foreign_key THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS documentos_empresa_idx ON public.documentos(empresa_id);
CREATE INDEX IF NOT EXISTS documentos_tipo_idx    ON public.documentos(tipo);
CREATE INDEX IF NOT EXISTS documentos_status_idx  ON public.documentos(status);

-- ----------------------------------------------------------------------------
-- 2.4) CONTAS META (Business Manager)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.contas_meta (
  id                  TEXT              PRIMARY KEY,
  nome                TEXT              NOT NULL,
  meta_business_id    TEXT,
  ad_account_id       TEXT,
  waba_id             TEXT,
  app_id              TEXT,
  access_token        TEXT,
  status              "ContaMetaStatus" NOT NULL DEFAULT 'ATIVA',
  tipo                TEXT              NOT NULL DEFAULT 'Business Manager',
  verificacao_status  TEXT              DEFAULT 'NAO_VERIFICADA',
  observacoes         TEXT,
  motivo_restricao    TEXT,
  data_restricao      TIMESTAMPTZ,
  recurso_enviado     BOOLEAN           NOT NULL DEFAULT false,
  data_recurso        TIMESTAMPTZ,
  recurso_descricao   TEXT,
  empresa_id          TEXT              NOT NULL,
  created_at          TIMESTAMPTZ       NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ       NOT NULL DEFAULT now()
);

DO $$ BEGIN
  ALTER TABLE public.contas_meta
    ADD CONSTRAINT contas_meta_empresa_fk
    FOREIGN KEY (empresa_id) REFERENCES public.empresas(id)
    ON UPDATE CASCADE ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
         WHEN invalid_foreign_key THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS contas_meta_empresa_idx        ON public.contas_meta(empresa_id);
CREATE INDEX IF NOT EXISTS contas_meta_status_idx         ON public.contas_meta(status);
CREATE INDEX IF NOT EXISTS contas_meta_meta_business_idx  ON public.contas_meta(meta_business_id);
CREATE INDEX IF NOT EXISTS contas_meta_waba_idx           ON public.contas_meta(waba_id);

-- ----------------------------------------------------------------------------
-- 2.5) NÚMEROS WHATSAPP
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.numeros_whatsapp (
  id                  TEXT         PRIMARY KEY,
  numero              TEXT         NOT NULL,
  phone_number_id     TEXT         UNIQUE,
  display_name        TEXT,
  quality_rating      TEXT         DEFAULT 'GREEN',
  status              TEXT         NOT NULL DEFAULT 'PENDENTE',
  codigo_verificacao  TEXT,
  pin_2fa             TEXT,
  limite_msg          TEXT         DEFAULT '250',
  categoria           TEXT         DEFAULT 'UTILITY',
  conta_meta_id       TEXT         NOT NULL,
  empresa_id          TEXT         NOT NULL,
  created_at          TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ  NOT NULL DEFAULT now()
);

DO $$ BEGIN
  ALTER TABLE public.numeros_whatsapp
    ADD CONSTRAINT numeros_whatsapp_conta_fk
    FOREIGN KEY (conta_meta_id) REFERENCES public.contas_meta(id)
    ON UPDATE CASCADE ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
         WHEN invalid_foreign_key THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.numeros_whatsapp
    ADD CONSTRAINT numeros_whatsapp_empresa_fk
    FOREIGN KEY (empresa_id) REFERENCES public.empresas(id)
    ON UPDATE CASCADE ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
         WHEN invalid_foreign_key THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS numeros_conta_idx    ON public.numeros_whatsapp(conta_meta_id);
CREATE INDEX IF NOT EXISTS numeros_empresa_idx  ON public.numeros_whatsapp(empresa_id);
CREATE INDEX IF NOT EXISTS numeros_status_idx   ON public.numeros_whatsapp(status);
CREATE INDEX IF NOT EXISTS numeros_quality_idx  ON public.numeros_whatsapp(quality_rating);

-- ----------------------------------------------------------------------------
-- 2.6) HISTÓRICO DE STATUS DAS CONTAS META
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.contas_meta_historico (
  id               TEXT         PRIMARY KEY,
  status_anterior  TEXT         NOT NULL,
  status_novo      TEXT         NOT NULL,
  motivo           TEXT,
  conta_meta_id    TEXT         NOT NULL,
  criado_por_id    TEXT,
  created_at       TIMESTAMPTZ  NOT NULL DEFAULT now()
);

DO $$ BEGIN
  ALTER TABLE public.contas_meta_historico
    ADD CONSTRAINT contas_meta_historico_conta_fk
    FOREIGN KEY (conta_meta_id) REFERENCES public.contas_meta(id)
    ON UPDATE CASCADE ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
         WHEN invalid_foreign_key THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.contas_meta_historico
    ADD CONSTRAINT contas_meta_historico_user_fk
    FOREIGN KEY (criado_por_id) REFERENCES public.users(id)
    ON UPDATE CASCADE ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL;
         WHEN invalid_foreign_key THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS conta_historico_conta_idx    ON public.contas_meta_historico(conta_meta_id);
CREATE INDEX IF NOT EXISTS conta_historico_created_idx  ON public.contas_meta_historico(created_at);

-- ----------------------------------------------------------------------------
-- 2.7) SITES DE VERIFICAÇÃO
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.sites_verificacao (
  id                  TEXT         PRIMARY KEY,
  dominio             TEXT,
  template            TEXT         NOT NULL DEFAULT 'institucional',
  segmento            TEXT         NOT NULL,
  nome_empresa        TEXT         NOT NULL,
  descricao           TEXT,
  cor_primaria        TEXT         NOT NULL DEFAULT '#1877F2',
  cor_secundaria      TEXT         NOT NULL DEFAULT '#42B72A',
  incluir_termos      BOOLEAN      NOT NULL DEFAULT true,
  incluir_privacidade BOOLEAN      NOT NULL DEFAULT true,
  incluir_lgpd        BOOLEAN      NOT NULL DEFAULT true,
  conteudo_gerado     TEXT,
  status              TEXT         NOT NULL DEFAULT 'rascunho',
  empresa_id          TEXT         NOT NULL,
  created_at          TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ  NOT NULL DEFAULT now()
);

DO $$ BEGIN
  ALTER TABLE public.sites_verificacao
    ADD CONSTRAINT sites_verificacao_empresa_fk
    FOREIGN KEY (empresa_id) REFERENCES public.empresas(id)
    ON UPDATE CASCADE ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
         WHEN invalid_foreign_key THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS sites_empresa_idx ON public.sites_verificacao(empresa_id);
CREATE INDEX IF NOT EXISTS sites_status_idx  ON public.sites_verificacao(status);

-- ----------------------------------------------------------------------------
-- 2.8) HISTÓRICO DE TRUST SCORE
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.trust_score_historico (
  id         TEXT         PRIMARY KEY,
  score      INTEGER      NOT NULL,
  detalhes   TEXT,
  empresa_id TEXT         NOT NULL,
  created_at TIMESTAMPTZ  NOT NULL DEFAULT now()
);

DO $$ BEGIN
  ALTER TABLE public.trust_score_historico
    ADD CONSTRAINT trust_score_historico_empresa_fk
    FOREIGN KEY (empresa_id) REFERENCES public.empresas(id)
    ON UPDATE CASCADE ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
         WHEN invalid_foreign_key THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS trust_score_empresa_idx ON public.trust_score_historico(empresa_id);
CREATE INDEX IF NOT EXISTS trust_score_created_idx ON public.trust_score_historico(created_at);

-- ----------------------------------------------------------------------------
-- 2.9) META API CONFIG
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.meta_api_config (
  id                 TEXT         PRIMARY KEY,
  app_id             TEXT         NOT NULL,
  app_secret         TEXT,
  access_token       TEXT,
  webhook_token      TEXT,
  graph_api_version  TEXT         NOT NULL DEFAULT 'v21.0',
  ativo              BOOLEAN      NOT NULL DEFAULT true,
  descricao          TEXT,
  created_at         TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ  NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS meta_api_config_ativo_idx ON public.meta_api_config(ativo);

-- ----------------------------------------------------------------------------
-- 2.10) DOMÍNIOS DE VERIFICAÇÃO
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.dominios_verificacao (
  id                 TEXT         PRIMARY KEY,
  dominio            TEXT         NOT NULL,
  domain_id          TEXT,
  verificado         BOOLEAN      NOT NULL DEFAULT false,
  metodo             TEXT,
  token_verificacao  TEXT,
  ultimo_check       TIMESTAMPTZ,
  empresa_id         TEXT         NOT NULL,
  created_at         TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ  NOT NULL DEFAULT now()
);

DO $$ BEGIN
  ALTER TABLE public.dominios_verificacao
    ADD CONSTRAINT dominios_verificacao_empresa_fk
    FOREIGN KEY (empresa_id) REFERENCES public.empresas(id)
    ON UPDATE CASCADE ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
         WHEN invalid_foreign_key THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.dominios_verificacao
    ADD CONSTRAINT dominios_verificacao_unique
    UNIQUE (empresa_id, dominio);
EXCEPTION WHEN duplicate_object THEN NULL;
         WHEN duplicate_table THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS dominios_empresa_idx    ON public.dominios_verificacao(empresa_id);
CREATE INDEX IF NOT EXISTS dominios_verificado_idx ON public.dominios_verificacao(verificado);

-- ----------------------------------------------------------------------------
-- 2.11) MESSAGE TEMPLATES
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.message_templates (
  id                TEXT         PRIMARY KEY,
  name              TEXT         NOT NULL,
  template_id       TEXT,
  status            TEXT         NOT NULL DEFAULT 'PENDING',
  category          TEXT         NOT NULL DEFAULT 'UTILITY',
  language          TEXT         NOT NULL DEFAULT 'pt_BR',
  components        TEXT,
  rejection_reason  TEXT,
  quality_score     TEXT,
  conta_meta_id     TEXT         NOT NULL,
  created_at        TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ  NOT NULL DEFAULT now()
);

DO $$ BEGIN
  ALTER TABLE public.message_templates
    ADD CONSTRAINT message_templates_conta_fk
    FOREIGN KEY (conta_meta_id) REFERENCES public.contas_meta(id)
    ON UPDATE CASCADE ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
         WHEN invalid_foreign_key THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS templates_conta_idx    ON public.message_templates(conta_meta_id);
CREATE INDEX IF NOT EXISTS templates_status_idx   ON public.message_templates(status);
CREATE INDEX IF NOT EXISTS templates_category_idx ON public.message_templates(category);

-- ----------------------------------------------------------------------------
-- 2.12) WEBHOOK EVENTS
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.webhook_events (
  id            TEXT         PRIMARY KEY,
  event         TEXT         NOT NULL,
  payload       TEXT         NOT NULL,
  signature_ok  BOOLEAN      NOT NULL DEFAULT false,
  processed     BOOLEAN      NOT NULL DEFAULT false,
  error_msg     TEXT,
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS webhook_event_idx     ON public.webhook_events(event);
CREATE INDEX IF NOT EXISTS webhook_processed_idx ON public.webhook_events(processed);
CREATE INDEX IF NOT EXISTS webhook_created_idx   ON public.webhook_events(created_at);
CREATE INDEX IF NOT EXISTS webhook_signature_idx ON public.webhook_events(signature_ok);

-- ----------------------------------------------------------------------------
-- 2.13) AUDIT LOGS
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id           TEXT         PRIMARY KEY,
  acao         TEXT         NOT NULL,
  descricao    TEXT         NOT NULL,
  entidade     TEXT         NOT NULL,
  entidade_id  TEXT,
  user_id      TEXT,
  empresa_id   TEXT,
  metadata     TEXT,
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT now()
);

DO $$ BEGIN
  ALTER TABLE public.audit_logs
    ADD CONSTRAINT audit_logs_user_fk
    FOREIGN KEY (user_id) REFERENCES public.users(id)
    ON UPDATE CASCADE ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL;
         WHEN invalid_foreign_key THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.audit_logs
    ADD CONSTRAINT audit_logs_empresa_fk
    FOREIGN KEY (empresa_id) REFERENCES public.empresas(id)
    ON UPDATE CASCADE ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL;
         WHEN invalid_foreign_key THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS audit_user_idx      ON public.audit_logs(user_id);
CREATE INDEX IF NOT EXISTS audit_empresa_idx   ON public.audit_logs(empresa_id);
CREATE INDEX IF NOT EXISTS audit_created_idx   ON public.audit_logs(created_at);
CREATE INDEX IF NOT EXISTS audit_entidade_idx  ON public.audit_logs(entidade);
CREATE INDEX IF NOT EXISTS audit_acao_idx      ON public.audit_logs(acao);

-- ============================================================================
-- 3) TRIGGER updated_at AUTOMÁTICO
-- ============================================================================
CREATE OR REPLACE FUNCTION public.tg_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Aplica o trigger em todas as tabelas do schema public que possuem updated_at
DO $$
DECLARE t TEXT;
BEGIN
  FOR t IN
    SELECT c.table_name
    FROM information_schema.columns c
    WHERE c.table_schema = 'public'
      AND c.column_name  = 'updated_at'
      AND c.table_name IN (
        'users','empresas','documentos','contas_meta','numeros_whatsapp',
        'sites_verificacao','meta_api_config','dominios_verificacao',
        'message_templates'
      )
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS set_updated_at ON public.%I;', t);
    EXECUTE format(
      'CREATE TRIGGER set_updated_at
         BEFORE UPDATE ON public.%I
         FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();',
      t
    );
  END LOOP;
END $$;

-- ============================================================================
-- 4) STORAGE — bucket "documentos" (privado)
-- ============================================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('documentos', 'documentos', false)
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- 5) ROW LEVEL SECURITY (RLS) + POLÍTICAS BÁSICAS
--
-- Modelo de acesso:
--  • A aplicação Next.js usa a SERVICE_ROLE_KEY no backend,
--    que IGNORA RLS por padrão — então a app continua funcionando.
--  • Clientes anônimos (anon) NÃO conseguem ler/escrever em nada
--    sensível mesmo se ganharem acesso à anon key.
--  • Para futura migração para Supabase Auth, basta trocar a role
--    "authenticated" pelas políticas aqui já preparadas.
-- ============================================================================

-- Habilita RLS em todas as tabelas (idempotente — não dá erro se já estiver)
ALTER TABLE public.users                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.empresas               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documentos             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contas_meta            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.numeros_whatsapp       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contas_meta_historico  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sites_verificacao      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trust_score_historico  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meta_api_config        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dominios_verificacao   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.message_templates      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.webhook_events         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs             ENABLE ROW LEVEL SECURITY;

-- ----------------------------------------------------------------------------
-- 5.1) Política BLOQUEIO TOTAL para usuários anônimos
--      (apenas service_role consegue acessar — comportamento default seguro)
-- ----------------------------------------------------------------------------
DO $$
DECLARE
  t TEXT;
  tables TEXT[] := ARRAY[
    'users','empresas','documentos','contas_meta','numeros_whatsapp',
    'contas_meta_historico','sites_verificacao','trust_score_historico',
    'meta_api_config','dominios_verificacao','message_templates',
    'webhook_events','audit_logs'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    -- bloqueio para anon
    EXECUTE format('DROP POLICY IF EXISTS anon_no_access ON public.%I;', t);
    EXECUTE format(
      'CREATE POLICY anon_no_access ON public.%I
         FOR ALL TO anon
         USING (false) WITH CHECK (false);',
      t
    );
  END LOOP;
END $$;

-- ----------------------------------------------------------------------------
-- 5.2) Políticas de LEITURA para usuários autenticados
--      (caso você passe a usar Supabase Auth no futuro)
-- ----------------------------------------------------------------------------
-- Empresas: usuário autenticado pode ler todas
DROP POLICY IF EXISTS authenticated_read_empresas ON public.empresas;
CREATE POLICY authenticated_read_empresas ON public.empresas
  FOR SELECT TO authenticated USING (true);

-- Documentos
DROP POLICY IF EXISTS authenticated_read_documentos ON public.documentos;
CREATE POLICY authenticated_read_documentos ON public.documentos
  FOR SELECT TO authenticated USING (true);

-- Contas Meta
DROP POLICY IF EXISTS authenticated_read_contas_meta ON public.contas_meta;
CREATE POLICY authenticated_read_contas_meta ON public.contas_meta
  FOR SELECT TO authenticated USING (true);

-- Números WhatsApp
DROP POLICY IF EXISTS authenticated_read_numeros ON public.numeros_whatsapp;
CREATE POLICY authenticated_read_numeros ON public.numeros_whatsapp
  FOR SELECT TO authenticated USING (true);

-- Histórico de contas Meta
DROP POLICY IF EXISTS authenticated_read_historico ON public.contas_meta_historico;
CREATE POLICY authenticated_read_historico ON public.contas_meta_historico
  FOR SELECT TO authenticated USING (true);

-- Sites
DROP POLICY IF EXISTS authenticated_read_sites ON public.sites_verificacao;
CREATE POLICY authenticated_read_sites ON public.sites_verificacao
  FOR SELECT TO authenticated USING (true);

-- Trust Score
DROP POLICY IF EXISTS authenticated_read_trust ON public.trust_score_historico;
CREATE POLICY authenticated_read_trust ON public.trust_score_historico
  FOR SELECT TO authenticated USING (true);

-- Domínios
DROP POLICY IF EXISTS authenticated_read_dominios ON public.dominios_verificacao;
CREATE POLICY authenticated_read_dominios ON public.dominios_verificacao
  FOR SELECT TO authenticated USING (true);

-- Templates
DROP POLICY IF EXISTS authenticated_read_templates ON public.message_templates;
CREATE POLICY authenticated_read_templates ON public.message_templates
  FOR SELECT TO authenticated USING (true);

-- Audit logs (apenas leitura)
DROP POLICY IF EXISTS authenticated_read_audit ON public.audit_logs;
CREATE POLICY authenticated_read_audit ON public.audit_logs
  FOR SELECT TO authenticated USING (true);

-- ----------------------------------------------------------------------------
-- 5.3) Tabelas SENSÍVEIS — somente service_role
--      (RLS habilitado + sem policy para outras roles = ninguém acessa)
-- ----------------------------------------------------------------------------
-- users.password, meta_api_config (tokens), webhook_events: ficam sem
-- policy para authenticated/anon → apenas service_role (Next.js backend) lê.

-- ----------------------------------------------------------------------------
-- 5.4) Policies do STORAGE BUCKET "documentos"
--      Bucket privado: somente service_role acessa.
--      Anon bloqueado explicitamente.
-- ----------------------------------------------------------------------------
DO $$ BEGIN
  -- Bloqueia anon no bucket "documentos"
  DROP POLICY IF EXISTS anon_no_access_documentos
    ON storage.objects;
  CREATE POLICY anon_no_access_documentos
    ON storage.objects
    FOR ALL TO anon
    USING (bucket_id = 'documentos' AND false)
    WITH CHECK (bucket_id = 'documentos' AND false);

  -- Permite authenticated ler objetos do bucket "documentos"
  DROP POLICY IF EXISTS authenticated_read_documentos_storage
    ON storage.objects;
  CREATE POLICY authenticated_read_documentos_storage
    ON storage.objects
    FOR SELECT TO authenticated
    USING (bucket_id = 'documentos');
END $$;

-- ============================================================================
-- 6) GRANTS — garantir que service_role tem acesso total
-- ============================================================================
GRANT USAGE ON SCHEMA public TO service_role;
GRANT ALL ON ALL TABLES    IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO service_role;

-- Para que novos objetos (criados depois) já entrem com permissão
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT ALL ON TABLES TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT ALL ON SEQUENCES TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT ALL ON FUNCTIONS TO service_role;

-- Grants mínimos para roles públicas (sem dar leitura — RLS controla)
GRANT USAGE ON SCHEMA public TO anon, authenticated;

-- ============================================================================
-- 7) COMENTÁRIOS (documentação inline no banco)
-- ============================================================================
COMMENT ON TABLE public.users                  IS 'Operadores do sistema (admin/funcionário).';
COMMENT ON TABLE public.empresas               IS 'Empresas clientes a serem validadas no Meta.';
COMMENT ON TABLE public.documentos             IS 'Documentos (CNPJ, contrato, etc.) das empresas.';
COMMENT ON TABLE public.contas_meta            IS 'Business Managers vinculados às empresas.';
COMMENT ON TABLE public.numeros_whatsapp       IS 'Números WhatsApp Business cadastrados.';
COMMENT ON TABLE public.contas_meta_historico  IS 'Histórico de mudanças de status das contas Meta.';
COMMENT ON TABLE public.sites_verificacao      IS 'Sites gerados para verificação da empresa no Meta.';
COMMENT ON TABLE public.trust_score_historico  IS 'Histórico do Trust Score por empresa.';
COMMENT ON TABLE public.meta_api_config        IS 'Configuração global da Meta Graph API (App ID, tokens).';
COMMENT ON TABLE public.dominios_verificacao   IS 'Domínios cadastrados/verificados na Meta por empresa.';
COMMENT ON TABLE public.message_templates      IS 'Templates de mensagem WhatsApp por WABA.';
COMMENT ON TABLE public.webhook_events         IS 'Eventos brutos recebidos do webhook do Meta.';
COMMENT ON TABLE public.audit_logs             IS 'Log de auditoria de todas as ações do sistema.';

-- ============================================================================
-- FIM DA MIGRATION 0002_full_schema_with_policies.sql
-- ============================================================================
