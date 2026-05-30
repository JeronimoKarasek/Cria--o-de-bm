-- ============================================================================
-- MIGRATION: 0003_warming_system.sql
-- Sistema: Warming gradual de números WhatsApp Business
-- Objetivo: Evitar banimentos do Meta via aquecimento progressivo
-- 
-- ⚠️ GARANTIAS DE SEGURANÇA
--   • Apenas ADD — não modifica tabelas/colunas existentes
--   • IF NOT EXISTS em tudo
--   • NENHUM DROP TABLE, TRUNCATE ou DELETE
--   • Idempotente — pode rodar múltiplas vezes
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1) ENUM: WarmingStage
-- ----------------------------------------------------------------------------
DO $$ BEGIN
  CREATE TYPE "WarmingStage" AS ENUM (
    'COLD',           -- Recém-criado, 0 msgs enviadas
    'WARMING_1_3',    -- Dia 1-3: 10-20 msg/dia (conversas manuais/baixo volume)
    'WARMING_4_7',    -- Dia 4-7: 30-50 msg/dia
    'WARMING_8_14',   -- Dia 8-14: 80-150 msg/dia
    'WARMING_15_21',  -- Dia 15-21: 200-500 msg/dia
    'ACTIVE',         -- Aquecido, liberado para disparo normal
    'BLOCKED',        -- Bloqueado por violação ou banimento
    'PAUSED'          -- Pausado manualmente (férias, manutenção)
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ----------------------------------------------------------------------------
-- 2) COLUNAS NA TABELA numeros_whatsapp (adicionais, não destrutivas)
-- ----------------------------------------------------------------------------
ALTER TABLE public.numeros_whatsapp
  ADD COLUMN IF NOT EXISTS warming_stage      "WarmingStage" NOT NULL DEFAULT 'COLD',
  ADD COLUMN IF NOT EXISTS warming_started_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS warming_day        INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS daily_msg_count    INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS daily_msg_limit    INTEGER NOT NULL DEFAULT 10,
  ADD COLUMN IF NOT EXISTS msg_total_sent     INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_msg_at        TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS quality_history    JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS warming_notes      TEXT;

CREATE INDEX IF NOT EXISTS numeros_warming_stage_idx ON public.numeros_whatsapp(warming_stage);
CREATE INDEX IF NOT EXISTS numeros_warming_day_idx   ON public.numeros_whatsapp(warming_day);

-- ----------------------------------------------------------------------------
-- 3) TABELA: warming_log (histórico diário de aquecimento)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.warming_log (
  id                TEXT         PRIMARY KEY,
  numero_id         TEXT         NOT NULL,
  warming_day       INTEGER      NOT NULL,
  stage             "WarmingStage" NOT NULL,
  msg_sent_today    INTEGER      NOT NULL DEFAULT 0,
  msg_limit_today   INTEGER      NOT NULL,
  quality_rating    TEXT,
  meta_events       JSONB        DEFAULT '[]'::jsonb,
  notes             TEXT,
  created_at        TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS warming_log_numero_idx  ON public.warming_log(numero_id);
CREATE INDEX IF NOT EXISTS warming_log_day_idx     ON public.warming_log(warming_day);
CREATE INDEX IF NOT EXISTS warming_log_created_idx ON public.warming_log(created_at);

-- ----------------------------------------------------------------------------
-- 4) FUNÇÃO: calcular estágio de warming baseado no dia
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.calc_warming_stage(p_warming_day INTEGER)
RETURNS "WarmingStage" AS $$
BEGIN
  IF p_warming_day <= 0 THEN RETURN 'COLD'; END IF;
  IF p_warming_day <= 3 THEN RETURN 'WARMING_1_3'; END IF;
  IF p_warming_day <= 7 THEN RETURN 'WARMING_4_7'; END IF;
  IF p_warming_day <= 14 THEN RETURN 'WARMING_8_14'; END IF;
  IF p_warming_day <= 21 THEN RETURN 'WARMING_15_21'; END IF;
  RETURN 'ACTIVE';
END;
$$ LANGUAGE plpgsql;

-- ----------------------------------------------------------------------------
-- 5) FUNÇÃO: limite diário de mensagens baseado no estágio
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.calc_daily_limit(p_stage "WarmingStage")
RETURNS INTEGER AS $$
BEGIN
  CASE p_stage
    WHEN 'COLD'         THEN RETURN 10;
    WHEN 'WARMING_1_3'  THEN RETURN 20;
    WHEN 'WARMING_4_7'  THEN RETURN 50;
    WHEN 'WARMING_8_14' THEN RETURN 150;
    WHEN 'WARMING_15_21'THEN RETURN 500;
    WHEN 'ACTIVE'       THEN RETURN 2000;
    ELSE RETURN 0; -- BLOCKED/PAUSED = 0
  END CASE;
END;
$$ LANGUAGE plpgsql;

-- ----------------------------------------------------------------------------
-- 6) FUNÇÃO: avançar dia de warming (roda via cronjob diário)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.advance_warming_day()
RETURNS SETOF public.numeros_whatsapp AS $$
DECLARE
  r public.numeros_whatsapp%ROWTYPE;
BEGIN
  FOR r IN
    UPDATE public.numeros_whatsapp
    SET 
      warming_day      = warming_day + 1,
      daily_msg_count  = 0,
      warming_stage    = public.calc_warming_stage(warming_day + 1),
      daily_msg_limit  = public.calc_daily_limit(public.calc_warming_stage(warming_day + 1)),
      updated_at       = now()
    WHERE warming_stage NOT IN ('ACTIVE', 'BLOCKED', 'PAUSED')
      AND warming_started_at IS NOT NULL
    RETURNING *
  LOOP
    -- Log do avanço
    INSERT INTO public.warming_log (id, numero_id, warming_day, stage, msg_sent_today, msg_limit_today, notes)
    VALUES (
      gen_random_uuid()::text,
      r.id,
      r.warming_day,
      r.warming_stage,
      r.daily_msg_count,
      r.daily_msg_limit,
      CASE 
        WHEN r.warming_stage = 'ACTIVE' THEN '✅ Aquecimento concluído — número liberado para disparo normal'
        ELSE '⏳ Aquecimento em progresso'
      END
    );
    RETURN NEXT r;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- ----------------------------------------------------------------------------
-- 7) FUNÇÃO: verificar se número pode enviar mensagem (rate limiting)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.can_send_message(p_numero_id TEXT)
RETURNS BOOLEAN AS $$
DECLARE
  v_numero public.numeros_whatsapp%ROWTYPE;
BEGIN
  SELECT * INTO v_numero FROM public.numeros_whatsapp WHERE id = p_numero_id;
  
  IF NOT FOUND THEN RETURN FALSE; END IF;
  IF v_numero.warming_stage IN ('BLOCKED', 'PAUSED') THEN RETURN FALSE; END IF;
  IF v_numero.daily_msg_count >= v_numero.daily_msg_limit THEN RETURN FALSE; END IF;
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- ----------------------------------------------------------------------------
-- 8) COMENTÁRIOS
-- ----------------------------------------------------------------------------
COMMENT ON TABLE public.warming_log IS 'Histórico diário de aquecimento dos números WhatsApp.';
COMMENT ON COLUMN public.numeros_whatsapp.warming_stage IS 'Estágio atual de aquecimento (COLD → WARMING_1_3 → ... → ACTIVE).';
COMMENT ON COLUMN public.numeros_whatsapp.warming_day IS 'Dia atual de aquecimento (0 = não iniciado).';
COMMENT ON COLUMN public.numeros_whatsapp.daily_msg_count IS 'Contador de mensagens enviadas hoje.';
COMMENT ON COLUMN public.numeros_whatsapp.daily_msg_limit IS 'Limite máximo de mensagens para hoje.';
COMMENT ON COLUMN public.numeros_whatsapp.quality_history IS 'Histórico de quality_rating do Meta (GREEN/YELLOW/RED).';

-- FIM DA MIGRATION
