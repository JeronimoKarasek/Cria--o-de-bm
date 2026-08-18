-- E1 — campos de publish/Hostinger + fila ProvisionJob (somente aditivo)
-- Proibido: DROP / TRUNCATE / DELETE em massa

-- SiteVerificacao: publish + estratégia de domínio híbrido
ALTER TABLE public.sites_verificacao
  ADD COLUMN IF NOT EXISTS published_url TEXT;

ALTER TABLE public.sites_verificacao
  ADD COLUMN IF NOT EXISTS hostinger_domain TEXT;

ALTER TABLE public.sites_verificacao
  ADD COLUMN IF NOT EXISTS deploy_provider TEXT;

ALTER TABLE public.sites_verificacao
  ADD COLUMN IF NOT EXISTS last_publish_error TEXT;

ALTER TABLE public.sites_verificacao
  ADD COLUMN IF NOT EXISTS dominio_strategy TEXT;

ALTER TABLE public.sites_verificacao
  ADD COLUMN IF NOT EXISTS parent_domain TEXT;

ALTER TABLE public.sites_verificacao
  ADD COLUMN IF NOT EXISTS hostinger_ref TEXT;

ALTER TABLE public.sites_verificacao
  ADD COLUMN IF NOT EXISTS published_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS sites_status_idx ON public.sites_verificacao(status);

-- ProvisionJob: fila assíncrona (n8n/worker/cron)
CREATE TABLE IF NOT EXISTS public.provision_jobs (
  id            TEXT PRIMARY KEY,
  type          TEXT NOT NULL,
  status        TEXT NOT NULL DEFAULT 'pending',
  payload       TEXT NOT NULL,
  result        TEXT,
  attempts      INTEGER NOT NULL DEFAULT 0,
  max_attempts  INTEGER NOT NULL DEFAULT 5,
  last_error    TEXT,
  empresa_id    TEXT,
  site_id       TEXT,
  scheduled_at  TIMESTAMPTZ,
  started_at    TIMESTAMPTZ,
  finished_at   TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS provision_jobs_status_idx ON public.provision_jobs(status);
CREATE INDEX IF NOT EXISTS provision_jobs_type_idx ON public.provision_jobs(type);
CREATE INDEX IF NOT EXISTS provision_jobs_empresa_idx ON public.provision_jobs(empresa_id);
CREATE INDEX IF NOT EXISTS provision_jobs_site_idx ON public.provision_jobs(site_id);
CREATE INDEX IF NOT EXISTS provision_jobs_created_idx ON public.provision_jobs(created_at);
