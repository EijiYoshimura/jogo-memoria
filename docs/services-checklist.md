# Checklist de Serviços — Jogo de Memória

> Ações que você (operador/dono do projeto) precisa executar nos serviços externos para que a aplicação esteja pronta para produção.
> Última atualização: 2026-06-24

---

## 1. Supabase — Banco de Dados

**Por quê:** Armazenamento dos leads em PostgreSQL gerenciado. Free tier suficiente para MVP.

### Passos

- [ ] **Criar conta** em [supabase.com](https://supabase.com) (gratuito)
- [ ] **Criar projeto**
  - Nome sugerido: `jogo-memoria`
  - Região: `South America (São Paulo)` — menor latência
  - Guardar a senha do banco gerada pelo Supabase (você precisará dela se for migrar)
- [ ] **Criar a tabela `leads`** — executar no SQL Editor do Supabase:

```sql
CREATE TABLE leads (
  id               uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id         text        NOT NULL,
  data             jsonb       NOT NULL,
  score            integer,
  time_taken       integer,
  played_at        timestamptz DEFAULT now(),
  synced_from      text        DEFAULT 'online',
  created_at       timestamptz DEFAULT now(),
  consented_at     timestamptz,
  consent_version  text
);

-- Habilitar Row Level Security
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;

-- Permitir INSERT para usuários anônimos (captura de lead durante o jogo)
CREATE POLICY "anon insert only"
  ON leads
  FOR INSERT
  TO anon
  WITH CHECK (true);

-- ATENÇÃO (HUB-88 / ADR-012): NÃO crie mais a policy ampla "anon select".
-- A leitura dos leads passou a ser autorizada no servidor pela RPC
-- `admin_list_leads` (segredo verificado com bcrypt). Ver a seção
-- "Segurança de leitura do Admin (HUB-88)" abaixo. Em instalações novas,
-- `anon` deve manter APENAS o INSERT.
```

> **Se a tabela já existir** e você só precisar adicionar as colunas de LGPD, execute:
> ```sql
> -- Migração para LGPD (execute se a tabela já existir)
> ALTER TABLE leads
>   ADD COLUMN IF NOT EXISTS consented_at   timestamptz,
>   ADD COLUMN IF NOT EXISTS consent_version text;
> ```

- [ ] **Copiar as credenciais** em Project Settings → API:
  - `Project URL` → valor de `VITE_SUPABASE_URL`
  - `anon public key` → valor de `VITE_SUPABASE_ANON_KEY`
  - **Nunca expor a `service_role` key no frontend**

- [ ] **Verificar RLS ativo:** Table Editor → leads → RLS badge deve estar verde

### Segurança de leitura do Admin (HUB-88 / ADR-012)

**Por quê:** a `anon key` está no bundle público. Com a antiga policy `anon select`,
qualquer um com DevTools baixava nome/e-mail/telefone (e agora CPF) de todos os leads.
Esta migração fecha isso: a leitura passa por uma RPC `SECURITY DEFINER` que **verifica
um segredo no servidor** (bcrypt) antes de retornar qualquer linha. O segredo (a senha do
Admin) **nunca** entra no `config.json` nem em qualquer artefato baixado pelo cliente.

> ⚠️ **Ordem de rollout obrigatória (não inverter).** Derrubar a policy antes de o cliente
> usar a RPC quebraria o Admin. Execute os passos **1 → 2 → 3 → 4** nesta ordem, e só rode o
> passo 4 (`DROP POLICY`) depois de validar o Admin online no cliente já publicado.

**Passo 1 — Extensão de criptografia (aditivo):**

```sql
-- pgcrypto fornece crypt()/gen_salt() para hash bcrypt. No Supabase vive no schema `extensions`.
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;
```

**Passo 2 — Tabela privada do segredo (aditivo):**

```sql
-- RLS habilitado e SEM policies => nenhum papel (anon/authenticated) lê/escreve
-- por acesso direto. Só funções SECURITY DEFINER (owner) enxergam o conteúdo.
CREATE TABLE IF NOT EXISTS admin_secrets (
  event_id     text        PRIMARY KEY,
  secret_hash  text        NOT NULL,   -- bcrypt da senha do Admin; NUNCA o texto puro
  created_at   timestamptz DEFAULT now(),
  updated_at   timestamptz DEFAULT now()
);
ALTER TABLE admin_secrets ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON admin_secrets FROM anon, authenticated;
```

**Semear/rotacionar a senha do Admin (1x por evento, no SQL Editor):**

```sql
-- Troque 'SUA_PASSPHRASE_LONGA_AQUI' pela passphrase real (>= 12 caracteres, alta entropia).
-- O texto puro NUNCA é commitado nem colocado no config.json. Guarde-o em cofre/gerenciador.
INSERT INTO admin_secrets (event_id, secret_hash)
VALUES ('evento-demo-2026', extensions.crypt('SUA_PASSPHRASE_LONGA_AQUI', extensions.gen_salt('bf', 10)))
ON CONFLICT (event_id) DO UPDATE
  SET secret_hash = EXCLUDED.secret_hash, updated_at = now();
```

**Passo 3 — RPC de leitura autorizada (aditivo):**

```sql
-- Verifica o segredo ANTES de retornar linhas. search_path fixo (ADR-011) e
-- pgcrypto schema-qualificado (extensions.crypt).
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

  -- A verificação PRECEDE qualquer retorno de linha. Nunca retornar leads antes deste ponto.
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

**Passo 4 — Fechar o SELECT anônimo amplo (SÓ após validar o Admin online no cliente):**

```sql
-- anon mantém APENAS o INSERT (captura de lead). A leitura agora só via RPC autorizada.
DROP POLICY IF EXISTS "anon select" ON leads;
```

**Validação (evidência para o PR/QA):**

- [ ] Com apenas a `anon key`, `select * from leads` (REST/DevTools) retorna vazio/erro de RLS.
- [ ] `admin_list_leads(event_id, '<senha errada>')` retorna erro `unauthorized`, nunca linhas.
- [ ] `admin_list_leads(event_id, '<senha correta>')` retorna as linhas do evento.
- [ ] A captura de lead (INSERT anônimo) continua funcionando online e offline.

**Rotação da senha:** rode novamente o bloco de semear (`ON CONFLICT ... DO UPDATE`) com a nova
passphrase. O valor antigo `3314` do PIN público está **queimado** e não deve ser reutilizado.

### Acesso admin aos leads (após o evento)

Para visualizar/exportar leads via Supabase dashboard:
- Table Editor → leads → filtrar por `event_id`
- Ou usar o painel Admin do próprio jogo (export CSV)

---

## 2. Deploy — Cloudflare Pages (recomendado)

**Por quê:** Bandwidth ilimitado no free tier — crítico se múltiplos totens recarregarem o app simultaneamente. Proteção DDoS automática da rede Cloudflare.

### Passos

- [ ] **Criar conta** em [pages.cloudflare.com](https://pages.cloudflare.com) (gratuito)
- [ ] **Criar projeto Pages**
  - Conectar ao repositório GitHub do `jogo-memoria`
  - Build command: `npm run build`
  - Build output directory: `dist`
  - Framework preset: `Vite`
- [ ] **Configurar variáveis de ambiente** (Settings → Environment Variables):

| Variável | Valor | Ambiente |
|---|---|---|
| `VITE_SUPABASE_URL` | URL do seu projeto Supabase | Production + Preview |
| `VITE_SUPABASE_ANON_KEY` | anon key do Supabase | Production + Preview |

- [ ] **Verificar deploy:** Cloudflare gera uma URL `*.pages.dev` automáticamente
- [ ] **Testar a URL no totem** antes do evento

### Alternativa: Vercel

Se preferir Vercel (mais familiar):
- Mesmo processo de conexão ao GitHub
- Build command: `npm run build`, output: `dist`
- Adicionar as mesmas variáveis de ambiente
- **Atenção:** Vercel tem limite de 100 GB/mês no free tier — pode ser atingido em eventos grandes

---

## 3. GitHub — Repositório

- [ ] **Confirmar que o repositório existe** e está conectado ao Cloudflare Pages/Vercel
- [ ] **Configurar branch de produção:** `main` (ou `master`) faz deploy automático ao fazer push
- [ ] **Adicionar `.env.example`** ao repo com as variáveis sem valores reais:

```
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGc...
```

- [ ] **Garantir que `.env.local` está no `.gitignore`** (nunca commitar credenciais)

---

## 4. Preparação por Evento (checklist operacional)

A cada novo evento, o operador precisa:

- [ ] **Criar/editar `public/config.json`** com dados do evento:
  - `event.id` único (ex: `"evento-abc-jun2026"`)
  - `event.name`, `event.logo`, cores
  - `game.pairs` e `game.cardImages` com os assets do cliente
  - `leadForm.fields` com os campos desejados
  - `offlineExportPin` (gate **offline-only** do export local; trocar a cada evento!)

- [ ] **Semear a senha do Admin online** no SQL Editor (bloco de semear em
  "Segurança de leitura do Admin (HUB-88)"): a senha online **não** vai no
  `config.json` — ela é verificada no servidor. Sem semear, o Admin online não autoriza.

- [ ] **Adicionar imagens** em `public/images/`:
  - Logo do evento
  - Imagens das cartas (mínimo `game.pairs` imagens)
  - Imagem do verso das cartas (`cardBack`)

- [ ] **Fazer push para o GitHub** → deploy automático

- [ ] **Testar a URL de produção** no dispositivo que será usado no evento

- [ ] **Anotar a senha do Admin online e o `offlineExportPin`** em local seguro (cofre/
  gerenciador de senhas, nunca no dispositivo). São **valores distintos**: a senha online
  destrava a leitura remota (via RPC); o `offlineExportPin` destrava só o export local offline.

---

## 5. Configuração do Dispositivo (totem/tablet)

- [ ] **Abrir no Chrome** (melhor suporte a PWA e modo quiosque)
- [ ] **Modo quiosque** (totem): iniciar Chrome com flags:
  ```
  google-chrome --kiosk --disable-pinch --overscroll-history-navigation=0 https://sua-url.pages.dev
  ```
- [ ] **Desabilitar sleep/screensaver** do sistema operacional
- [ ] **Fixar brilho da tela** (evitar auto-ajuste durante o evento)
- [ ] **Testar conectividade WiFi** do local antes do evento
- [ ] **Testar cenário offline:** desligar WiFi, jogar uma rodada, religar — verificar sync no Supabase

---

## 6. Monitoramento (opcional, recomendado)

Para acompanhar leads em tempo real durante o evento:

- [ ] **Supabase Realtime** (zero config): abrir Table Editor → leads no dashboard do Supabase — atualiza automaticamente
- [ ] **BetterStack** (uptime monitor gratuito): cadastrar a URL do app para alerta se cair
  - [betterstack.com](https://betterstack.com) → free tier: 10 monitores, verificação a cada 3 min

---

## 7. Migração Futura para o Hub

Quando o Hub de Ativações estiver pronto:

| Item | Ação | Esforço |
|---|---|---|
| Código do jogo | `src/game/` já é um Module Federation remote — expor via `vite.config.ts` | Horas |
| Leads históricos | `pg_dump` do Supabase → restore no Neon (Hub) | Minutos |
| Config do evento | Migrar `config.json` para `activation_config` JSONB no Manager API | Horas |
| Deploy | Desativar o deploy standalone — Hub passa a servir o plugin | — |

---

## Resumo de Custos

| Serviço | Plano | Custo |
|---|---|---|
| Supabase | Free (500 MB, projetos sem pausa) | R$ 0 |
| Cloudflare Pages | Free (bandwidth ilimitado) | R$ 0 |
| GitHub | Free | R$ 0 |
| BetterStack | Free (10 monitores) | R$ 0 |
| **Total** | | **R$ 0** |
