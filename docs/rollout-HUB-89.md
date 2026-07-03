# Runbook — Rollout HUB-89 (CPF antifraude: coluna + índice + RPC)

> Objetivo: adicionar à tabela `leads` as colunas de CPF, a constraint de formato, o índice
> composto `(event_id, cpf)` e a RPC `check_cpf_participation` (dedup/contagem por evento).
> Ver `docs/specs/HUB-87-cpf-antifraude.md` (seções 1 e 2) e `docs/adr/ADR-011-cpf-antifraude-rpc-dedup.md`.

- **Projeto Supabase:** `jogo-memória` (`pzttneqjkgbuflmbwtyx`)
- **`event_id`:** use o `event.id` do `config.json` publicado. No demo é `evento-demo-2026`.

> ✅ **Migração 100% aditiva e idempotente — sem ordem de rollout obrigatória.**
> Diferente do HUB-88 (que derrubava a policy `anon select` e exigia ordem estrita), aqui **nada é
> removido** e o fluxo de INSERT existente **não** muda. Rodar antes ou depois do deploy do cliente
> é indiferente: enquanto o frontend (HUB-91/HUB-92) não estiver publicado, as colunas ficam vazias e
> a RPC simplesmente não é chamada. Pode re-executar o bloco sem efeito colateral.
>
> A RPC é `SECURITY DEFINER`: roda com o privilégio do owner e **independe** da policy de `SELECT` do
> `anon`. Continua funcionando mesmo com o SELECT anônimo já fechado pela Fase 4 do HUB-88.

---

## ✅ Fase única — Migração aditiva (rode AGORA)

Rode o bloco inteiro no **SQL Editor** do Supabase.

```sql
-- ── HUB-87 / ADR-011 — Antifraude de CPF (aditivo, idempotente) ───────────────

-- 1) Colunas dedicadas de CPF na tabela leads.
--    cpf                          : 11 dígitos normalizados (só números), SEM UNIQUE
--                                   (cada jogada continua gerando uma linha; a contagem é por COUNT).
--    cpf_check_skipped            : true quando a checagem online não concluiu em 3s (fallback offline).
--    max_participations_at_submit : snapshot do limite vigente naquela jogada (para a reconciliação).
ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS cpf                          text,
  ADD COLUMN IF NOT EXISTS cpf_check_skipped            boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS max_participations_at_submit integer;

-- 2) CHECK de formato — defesa em profundidade: 11 dígitos numéricos, ou NULL (leads legados).
--    Postgres não tem "ADD CONSTRAINT IF NOT EXISTS"; a guarda por pg_constraint mantém a
--    re-execução idempotente sem alterar o nome nem o predicado da constraint.
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

-- 3) Índice composto (event_id, cpf) — toda contagem de participação filtra pelos dois.
--    Parcial (WHERE cpf IS NOT NULL): não indexa linhas antigas sem CPF.
CREATE INDEX IF NOT EXISTS idx_leads_event_cpf
  ON leads (event_id, cpf)
  WHERE cpf IS NOT NULL;

-- 4) RPC de dedup/contagem — SECURITY DEFINER, retorno mínimo, search_path fixo (mitiga
--    search_path hijacking). O cliente chama via supabase.rpc('check_cpf_participation', ...).
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
  -- Defesa em profundidade: a função não confia cegamente na entrada do cliente.
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

-- Contrato de rede mínimo: anon só pode EXECUTAR a função (nunca ler a tabela inteira).
REVOKE ALL ON FUNCTION public.check_cpf_participation(text, text) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.check_cpf_participation(text, text) TO anon;
```

---

## 🧪 Validação (rode após a Fase única)

**1) As 3 colunas existem:**

```sql
SELECT column_name, data_type FROM information_schema.columns
WHERE table_name = 'leads'
  AND column_name IN ('cpf', 'cpf_check_skipped', 'max_participations_at_submit');
-- esperado: 3 linhas (cpf=text, cpf_check_skipped=boolean, max_participations_at_submit=integer)
```

**2) Constraint de formato e índice criados:**

```sql
SELECT conname   FROM pg_constraint WHERE conname   = 'leads_cpf_format_chk';   -- 1 linha
SELECT indexname FROM pg_indexes    WHERE indexname = 'idx_leads_event_cpf';    -- 1 linha
```

**3) RPC responde 0 para um CPF nunca visto** (troque pelo `event.id` publicado; a RPC valida só o
FORMATO de 11 dígitos — o dígito verificador é validado no cliente):

```sql
SELECT * FROM check_cpf_participation('evento-demo-2026', '39053344705');
-- esperado: participation_count = 0, last_lead_data = NULL
```

**4) RPC rejeita CPF malformado:**

```sql
SELECT * FROM check_cpf_participation('evento-demo-2026', '123');
-- esperado: ERROR: invalid cpf format
```

**5) A constraint rejeita formato inválido no banco** (defesa em profundidade — opcional, faça rollback):

```sql
BEGIN;
  INSERT INTO leads (event_id, data, cpf) VALUES ('evento-demo-2026', '{}'::jsonb, 'abc');
  -- esperado: ERROR ... viola a restrição "leads_cpf_format_chk"
ROLLBACK;
```

---

## Rollback (se precisar reverter os objetos aditivos)

Como é 100% aditivo, o rollback é simétrico e sem risco para o fluxo atual (nenhum cliente depende
das colunas/RPC até o wiring de HUB-91/HUB-92 ir para produção):

```sql
DROP FUNCTION  IF EXISTS public.check_cpf_participation(text, text);
DROP INDEX     IF EXISTS idx_leads_event_cpf;
ALTER TABLE leads DROP CONSTRAINT IF EXISTS leads_cpf_format_chk;
-- As colunas podem ficar (inofensivas). Para removê-las de fato:
-- ALTER TABLE leads
--   DROP COLUMN IF EXISTS cpf,
--   DROP COLUMN IF EXISTS cpf_check_skipped,
--   DROP COLUMN IF EXISTS max_participations_at_submit;
```
