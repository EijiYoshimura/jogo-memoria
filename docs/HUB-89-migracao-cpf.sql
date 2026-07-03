-- ═══════════════════════════════════════════════════════════════════════════
-- HUB-89 / HUB-87 / ADR-011 — Migração Antifraude de CPF
-- Rodar no SQL Editor do Supabase (projeto pzttneqjkgbuflmbwtyx / "Jogo de Memória").
-- 100% ADITIVO e IDEMPOTENTE — pode reexecutar sem efeito colateral.
-- Não altera o INSERT existente e NÃO reabre o SELECT anônimo fechado no HUB-88.
-- Aprovado por Tech Lead + QA (PR #34).
-- ═══════════════════════════════════════════════════════════════════════════

-- 1) Colunas dedicadas de CPF na tabela leads.
ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS cpf                          text,
  ADD COLUMN IF NOT EXISTS cpf_check_skipped            boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS max_participations_at_submit integer;

-- 2) CHECK de formato (11 dígitos ou NULL). Guarda idempotente por pg_constraint.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'leads_cpf_format_chk'
  ) THEN
    ALTER TABLE leads
      ADD CONSTRAINT leads_cpf_format_chk
      CHECK (cpf IS NULL OR cpf ~ '^[0-9]{11}$');
  END IF;
END$$;

-- 3) Índice composto parcial (event_id, cpf).
CREATE INDEX IF NOT EXISTS idx_leads_event_cpf
  ON leads (event_id, cpf)
  WHERE cpf IS NOT NULL;

-- 4) RPC de dedup/contagem — SECURITY DEFINER, search_path fixo, retorno mínimo.
CREATE OR REPLACE FUNCTION public.check_cpf_participation(
  p_event_id text,
  p_cpf      text
)
RETURNS TABLE (
  participation_count integer,
  last_lead_data      jsonb
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_cpf !~ '^[0-9]{11}$' THEN
    RAISE EXCEPTION 'invalid cpf format';
  END IF;

  RETURN QUERY
  SELECT
    count(*)::integer,
    (array_agg(l.data ORDER BY l.played_at DESC NULLS LAST))[1]
  FROM leads l
  WHERE l.event_id = p_event_id AND l.cpf = p_cpf;
END;
$$;

REVOKE ALL ON FUNCTION public.check_cpf_participation(text, text) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.check_cpf_participation(text, text) TO anon;


-- ═══════════════════════════════════════════════════════════════════════════
-- VALIDAÇÃO (rodar depois — cada bloco separadamente, se quiser)
-- ═══════════════════════════════════════════════════════════════════════════

-- 5a) Colunas criadas?
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'leads'
  AND column_name IN ('cpf', 'cpf_check_skipped', 'max_participations_at_submit');

-- 5b) Constraint e índice criados?
SELECT conname FROM pg_constraint WHERE conname = 'leads_cpf_format_chk';
SELECT indexname FROM pg_indexes WHERE indexname = 'idx_leads_event_cpf';

-- 5c) RPC com CPF válido novo → participation_count = 0, last_lead_data = NULL.
SELECT * FROM check_cpf_participation('evento-demo-2026', '39053344705');

-- 5d) RPC com CPF malformado → deve dar: ERROR: invalid cpf format
SELECT * FROM check_cpf_participation('evento-demo-2026', '123');
