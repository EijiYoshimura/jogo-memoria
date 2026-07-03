# Runbook — Rollout HUB-88 (fechar o SELECT anônimo em `leads`)

> Objetivo: mover a leitura de leads para uma RPC autorizada por passphrase (validada no
> servidor) e **derrubar** a policy `anon select` que hoje deixa qualquer um baixar todos os
> leads via DevTools. Ver `docs/adr/ADR-012-rls-leads-admin-authz.md`.

- **Projeto Supabase:** `jogo-memória` (`pzttneqjkgbuflmbwtyx`)
- **`event_id`:** use o `event.id` do `config.json` que está publicado. No demo é `evento-demo-2026`.

> ⚠️ **Ordem obrigatória — não inverta.** Derrubar a policy antes de o cliente novo usar a RPC
> quebraria o Admin. Rode **Fase 1 → seed → (merge/deploy) → validar → Fase 4 → validar**.
> Rode **um bloco de cada vez** no **SQL Editor** do Supabase.

---

## ✅ Fase 1 — Migração aditiva (rode AGORA)

Não quebra nada: a policy antiga continua ativa; isto só **adiciona** a extensão, a tabela do
segredo e a RPC.

```sql
-- Passo 1: extensão de hash (bcrypt via crypt()/gen_salt())
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- Passo 2: tabela privada do segredo do Admin (RLS on, SEM policies => ninguém lê por acesso direto)
CREATE TABLE IF NOT EXISTS admin_secrets (
  event_id     text        PRIMARY KEY,
  secret_hash  text        NOT NULL,
  created_at   timestamptz DEFAULT now(),
  updated_at   timestamptz DEFAULT now()
);
ALTER TABLE admin_secrets ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON admin_secrets FROM anon, authenticated;

-- Passo 3: RPC de leitura autorizada — verifica o segredo ANTES de retornar qualquer linha
CREATE OR REPLACE FUNCTION public.admin_list_leads(
  p_event_id text,
  p_secret   text
)
RETURNS SETOF leads
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_hash text;
BEGIN
  SELECT secret_hash INTO v_hash FROM admin_secrets WHERE event_id = p_event_id;

  IF v_hash IS NULL OR extensions.crypt(p_secret, v_hash) <> v_hash THEN
    RAISE EXCEPTION 'unauthorized' USING errcode = '28000';
  END IF;

  RETURN QUERY
  SELECT * FROM leads WHERE event_id = p_event_id ORDER BY played_at DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_list_leads(text, text) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.admin_list_leads(text, text) TO anon;
```

---

## 🔑 Seed da passphrase (rode AGORA, logo após a Fase 1)

- Troque `SUA_PASSPHRASE_LONGA_AQUI` por uma **passphrase longa** (≥ 12 caracteres, alta entropia).
- O texto puro **nunca** vai para o `config.json` nem para o repositório — guarde num gerenciador de senhas.
- Se usar outro `event_id`, ajuste o valor.

```sql
INSERT INTO admin_secrets (event_id, secret_hash)
VALUES ('evento-demo-2026', extensions.crypt('SUA_PASSPHRASE_LONGA_AQUI', extensions.gen_salt('bf', 10)))
ON CONFLICT (event_id) DO UPDATE
  SET secret_hash = EXCLUDED.secret_hash, updated_at = now();
```

Confira que semeou (deve retornar 1 linha, **sem** mostrar o texto puro):

```sql
SELECT event_id, left(secret_hash, 7) AS hash_prefix, updated_at FROM admin_secrets;
```

---

## ⛔ PARE AQUI

Depois da Fase 1 + seed, **me avise**. Eu sigo com:

- **Fase 2 — Merge do PR #33 → deploy.** O cliente novo passa a usar a RPC. A policy antiga
  ainda existe (inofensiva). O deploy sai no push para `master` (Cloudflare Pages).
- **Fase 3 — Validar o Admin online.** Abrir o painel Admin no app publicado, digitar a
  passphrase e conferir que a contagem e o export CSV funcionam.

**Só quando a Fase 3 estiver validada** seguimos para a Fase 4 abaixo.

---

## 🚨 Fase 4 — Fechar o buraco (rode SÓ depois da Fase 3 OK)

```sql
-- anon mantém APENAS o INSERT (captura de lead). Leitura agora só via RPC autorizada.
DROP POLICY IF EXISTS "anon select" ON leads;
```

---

## 🧪 Fase 5 — Validação final (rode após a Fase 4)

**1) A anon key não lê mais `leads`** (deve retornar **0 linhas**):

```sql
SET ROLE anon;
SELECT count(*) FROM leads;   -- esperado: 0 (RLS bloqueia)
RESET ROLE;
```

**2) RPC com senha errada → erro `unauthorized`** (nunca retorna linhas):

```sql
SELECT * FROM admin_list_leads('evento-demo-2026', 'senha-errada');
```

**3) RPC com a senha correta → retorna os leads do evento:**

```sql
SELECT count(*) FROM admin_list_leads('evento-demo-2026', 'SUA_PASSPHRASE_LONGA_AQUI');
```

**4) Captura de lead (INSERT anônimo) continua funcionando** — testar jogando uma rodada no
app (online e offline) e conferir o registro no Supabase.

---

## Rotação futura da passphrase

Rode de novo o bloco de **seed** com a nova passphrase (o `ON CONFLICT ... DO UPDATE` troca o
hash). O PIN antigo `3314` do `config.json` público está **queimado** e não deve ser reutilizado.

---

## Rollback de emergência (se algo quebrar antes da Fase 4)

Enquanto a policy `anon select` **não** foi derrubada, o cliente antigo ainda funciona. Se
precisar reverter os objetos aditivos:

```sql
DROP FUNCTION IF EXISTS public.admin_list_leads(text, text);
DROP TABLE IF EXISTS admin_secrets;
-- (pgcrypto pode ficar; é inofensiva)
```

Depois da Fase 4, para reverter o fechamento (reabrir o acesso — só em emergência real):

```sql
CREATE POLICY "anon select" ON leads FOR SELECT TO anon USING (true);
```
