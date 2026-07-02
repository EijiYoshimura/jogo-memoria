# Spec: HUB-88 — Fechar `SELECT` anônimo em `leads` e autorizar o Admin no servidor

**Status:** Spec técnica preenchida pelo Tech Lead em 2026-07-02. Decisão de arquitetura em ADR-012
(Proposto). Pendente **uma** decisão do stakeholder (natureza do segredo do Admin — ver §7) e aprovação
formal (PO + PM + Tech Lead) antes do início do desenvolvimento, conforme SDD.

**Tipo:** tech-debt de segurança (label `tech-debt`, prioridade Alta). Priorizada pelo stakeholder para ser
resolvida **antes** de HUB-87 (CPF), porque HUB-87 coloca um identificador único de pessoa física na mesma
tabela hoje vazável.

---

## Contexto

Duas exposições reais coexistem hoje em produção e esta issue fecha ambas:

1. **`SELECT *` anônimo em `leads`.** A policy ativa —
   `CREATE POLICY "anon select" ON leads FOR SELECT TO anon USING (true)` — concede leitura irrestrita da
   tabela inteira para qualquer portador da `anon key`, que já está no bundle público do totem (ADR-001).
   Qualquer pessoa com DevTools no totem (ou que extraia a `anon key` do bundle) baixa nome/e-mail/telefone
   de **todos** os participantes de **todos** os eventos daquele projeto Supabase, sem passar pelo PIN — o PIN
   protege só a UI (`AdminPanel.tsx`), não a rede.

2. **`adminPin` em arquivo público.** `public/config.json` traz `"adminPin": "3314"` — arquivo git-tracked
   **e** servido estaticamente. Qualquer um faz `GET /config.json` e lê o PIN. A validação do PIN é 100%
   client-side (`pin === config.adminPin`), então o "segredo" nunca protegeu nada contra quem inspeciona a
   rede.

**Esclarecimento de escopo (para não perseguir o fix errado — ver ADR-012, "Não-objetivos"):** o que está no
bundle é apenas `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` (JWT `role: anon`). **Não há** `service_role`
nem connection string vazada (grep confirmou; `.env` no `.gitignore`, nunca commitado). A `anon key` é pública
por design e **não deve ser escondida/ofuscada** — isso é impossível num SPA estático e dá falsa segurança. A
mitigação correta é **RLS + grants + leitura privilegiada atrás de `SECURITY DEFINER`/auth**. Rotação da
`anon key` é opcional/cosmética aqui (só seria obrigatória se um `service_role` tivesse vazado — não é o caso).

A decisão de arquitetura está em **`docs/adr/ADR-012-rls-leads-admin-authz.md`**. Esta spec detalha a
implementação.

---

## Critérios de Aceite

(Definidos pelo Orchestrator; reproduzidos como contrato de verificação do QA.)

1. **Given** um visitante com DevTools e a `anon key`, **when** ele tenta `SELECT` direto em `leads`,
   **then** a RLS bloqueia — não retorna dados. (Fecha a exposição 1.)
2. **Given** o operador com o segredo correto, **when** ele abre o AdminPanel online, **then** consegue
   listar e exportar o CSV dos leads pelo mecanismo de autorização redesenhado.
3. **Given** uma chamada à RPC/função de listagem **sem** o segredo correto, **when** ela é invocada,
   **then** retorna erro de autorização, não os dados.
4. **Given** o fluxo de captura de lead, **when** um participante joga (online ou offline), **then** o INSERT
   continua funcionando para `anon`, sem exigir autenticação do participante — **zero regressão** na captura.

Critério adicional derivado do requisito firme do stakeholder (§ Contexto, exposição 2), rastreado nesta
spec:

5. **Given** qualquer artefato que o cliente baixa (`config.json`, bundle JS), **when** inspecionado,
   **then** **não** contém o segredo do Admin em texto puro; a validação do segredo ocorre no servidor e o
   cliente nunca recebe o valor correto para comparar.

---

## Spec Técnica

### 1. Arquitetura Envolvida

- **Camadas impactadas:** Infrastructure (Supabase: policies, tabela de segredo, RPC, grants) e
  Presentation/Interface Adapters (`AdminPanel.tsx` — troca de leitura remota + branch offline). Domain e
  Application não mudam.
- **Componentes/módulos afetados:**
  - `docs/services-checklist.md` — novo bloco de migração SQL (drop da policy, `pgcrypto`, `admin_secrets`,
    RPC, grants) + passo operacional de semear/rotacionar o segredo por evento.
  - `src/standalone/AdminPanel.tsx` — as duas únicas leituras remotas do projeto (`loadStats` count +
    `handleExportCsv` select) passam a usar `supabase.rpc('admin_list_leads', ...)`; captura do segredo na
    tela de entrada; branch online/offline.
  - `src/game/types.ts` — semântica de `adminPin` revista (ver §4): deixa de ser o segredo remoto; vira, no
    máximo, gate offline de UI (ou é removido, conforme decisão do stakeholder).
  - `src/standalone/ConfigLoader.tsx` — validação de `adminPin` ajustada à nova semântica.
  - `public/config.json` e `public/config.example.jsonc` — **remover** `"adminPin"` do artefato público (ou
    manter apenas o gate offline de baixo valor, conforme decisão) e documentar que o segredo remoto vive no
    servidor.
  - `docs/guia-operador.md` / `docs/referencia-config.md` — documentar o novo passo de semear o segredo no
    Supabase e a aposentadoria do PIN `3314`.
- **Novos componentes necessários:**
  - `src/standalone/lib/adminLeads.ts` — orquestra a chamada `admin_list_leads` (RPC + tratamento de erro de
    autorização), isolando o `AdminPanel.tsx` do detalhe do Supabase (mesma separação de `cpfLookup.ts` na
    HUB-87). Mapeia o resultado para um tipo discriminado (`authorized` / `unauthorized` / `offline`).
  - **Nenhuma biblioteca nova** — `pgcrypto` já é disponível no Supabase; o cliente só ganha uma chamada RPC.

### 2. Modelo de Dados (Supabase / Postgres)

Migração manual, documentada em `docs/services-checklist.md` (o projeto não versiona `supabase/migrations`).
SQL na variante **b-TOKEN / b-PIN** (segredo verificado no servidor). A variante **a-AUTH** dispensa a tabela
de segredo e a RPC (ver §7).

```sql
-- Pré-requisito: pgcrypto para hash bcrypt (no Supabase vive no schema `extensions`)
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- Tabela privada do segredo do Admin, por evento.
-- RLS habilitado e SEM policies => nenhum papel (anon/authenticated) lê ou escreve por acesso direto.
-- Só funções SECURITY DEFINER (owner) enxergam o conteúdo.
CREATE TABLE IF NOT EXISTS admin_secrets (
  event_id     text        PRIMARY KEY,
  secret_hash  text        NOT NULL,   -- bcrypt do segredo do Admin; NUNCA o texto puro
  created_at   timestamptz DEFAULT now(),
  updated_at   timestamptz DEFAULT now()
);
ALTER TABLE admin_secrets ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON admin_secrets FROM anon, authenticated;

-- Semear/rotacionar o segredo (operador executa 1x por evento no SQL Editor).
-- O texto puro NUNCA é commitado nem colocado em config.json.
INSERT INTO admin_secrets (event_id, secret_hash)
VALUES ('evento-demo-2026', extensions.crypt('SEGREDO_DO_ADMIN_AQUI', extensions.gen_salt('bf', 10)))
ON CONFLICT (event_id) DO UPDATE
  SET secret_hash = EXCLUDED.secret_hash, updated_at = now();
```

**Decisões de modelagem:**
- Segredo **por evento** (mesmo escopo do `event_id` já usado em `leads`) — cada ativação tem seu segredo,
  espelhando o modelo "um PIN por evento" que existia no `config.json`.
- Hash **bcrypt** (`extensions.crypt` + `gen_salt('bf', 10)`), não SHA plano: bcrypt é salgado e lento por
  design, o que também eleva o custo de força-bruta na RPC (importante na variante b-PIN).
- A tabela **não** tem policy alguma — a ausência de policy sob RLS habilitado nega tudo a `anon`/
  `authenticated`; apenas o `SECURITY DEFINER` (owner) lê. Defesa em profundidade contra a própria RPC ser
  contornada.

### 3. Segurança / RLS — policy e RPC

```sql
-- (3) Autorização de leitura do Admin: verifica o segredo no servidor, então retorna as linhas.
CREATE OR REPLACE FUNCTION public.admin_list_leads(
  p_event_id text,
  p_secret   text
)
RETURNS SETOF leads
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public          -- ADR-011: search_path fixo mitiga hijacking em SECURITY DEFINER
AS $$
DECLARE
  v_hash text;
BEGIN
  SELECT secret_hash INTO v_hash FROM admin_secrets WHERE event_id = p_event_id;

  -- A verificação PRECEDE qualquer retorno de linha. Nunca retornar leads antes deste ponto.
  IF v_hash IS NULL OR extensions.crypt(p_secret, v_hash) <> v_hash THEN
    RAISE EXCEPTION 'unauthorized' USING errcode = '28000';   -- Critério 3
  END IF;

  RETURN QUERY
  SELECT * FROM leads WHERE event_id = p_event_id ORDER BY played_at DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_list_leads(text, text) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.admin_list_leads(text, text) TO anon;

-- (4) Fechar o SELECT anônimo amplo. anon mantém APENAS o INSERT (captura de lead).
DROP POLICY IF EXISTS "anon select" ON leads;
```

**Notas de segurança:**
- `RETURNS SETOF leads` devolve linhas completas (com CPF, após HUB-87) — é intencional e **gated**: só ocorre
  depois do `crypt(...)` bater. É o oposto do vazamento: em ADR-011 o alerta era não devolver `SELECT *` num
  `SECURITY DEFINER` **sem** gate; aqui o gate é o segredo. **Regra de review inegociável:** a verificação do
  segredo tem de preceder o `RETURN QUERY`; qualquer caminho que retorne linhas antes é rejeitado.
- `pgcrypto` está schema-qualificado (`extensions.crypt`/`gen_salt`) para manter `search_path = public` fixo
  (padrão ADR-011) sem depender do `extensions` estar no path.
- A RPC é executável por `anon` (o cliente é `anon`), mas **só retorna** com o segredo correto — a `anon key`
  sozinha deixa de bastar para ler `leads` (Critério 1).
- **Contagem sem SELECT HEAD:** o card "Sincronizados" e o CSV derivam do **mesmo** retorno de
  `admin_list_leads` — uma única chamada autorizada. Remove-se o `select('*', {count, head})` de hoje.

**Addendum obrigatório APENAS na variante b-PIN (§7):** como um PIN de 4-6 dígitos é força-bruta-vel via RPC
por quem tem a `anon key`, a b-PIN exige rate-limiting server-side. Esboço:

```sql
-- Só se o stakeholder escolher manter PIN curto:
CREATE TABLE IF NOT EXISTS admin_auth_attempts (
  event_id     text PRIMARY KEY,
  window_start timestamptz NOT NULL DEFAULT now(),
  fail_count   integer     NOT NULL DEFAULT 0
);
-- Dentro de admin_list_leads, antes/depois do check: se fail_count no window corrente >= N, RAISE 'locked';
-- em falha, incrementa; em sucesso, zera. Janela ex.: 15 min, N ex.: 10.
```

Trade-off honesto: sem IP por chamada na RPC, o lockout é **por evento** (global) — um atacante poderia travar
o operador real (tensão DoS vs. lockout). bcrypt cost 10 já limita a ~10-20 tentativas/s, mas não basta
sozinho. **É o motivo de a recomendação ser b-TOKEN** (§7), que dispensa esse mecanismo.

### 4. Impacto no `AdminPanel.tsx`

Hoje (a remover):
- `loadStats()` → `supabase.from('leads').select('*', { count: 'exact', head: true }).eq('event_id', …)`.
- `handleExportCsv()` → `supabase.from('leads').select('*').eq('event_id', …)`.
- PIN validado com `next === config.adminPin` e **descartado**.

Depois:
- **Tela de entrada (segredo):** o valor digitado deixa de ser só um gate de UI descartável — vira a
  credencial passada à RPC. O `AdminPanel` guarda o segredo em `state` (em memória, nunca persistido no
  bundle) para as chamadas subsequentes. O layout do teclado (ADR-005) é preservado na variante b-PIN; na
  b-TOKEN o campo aceita uma passphrase mais longa (input controlado, mesmo componente de teclado virtual do
  projeto se aplicável, ou campo texto).
- **Ao autenticar:**
  - `navigator.onLine === true` → `adminLeads.list(eventId, secret)` (wrapper sobre
    `supabase.rpc('admin_list_leads', { p_event_id, p_secret })`):
    - sucesso → entra no dashboard; `syncedLeads` = `rows.length`; CSV = `rows` (merge com pendentes locais do
      IndexedDB, como hoje). Critério 2.
    - erro `unauthorized` → mensagem "PIN/senha incorreta", incrementa o contador de tentativas/lockout de UI
      já existente (`MAX_ATTEMPTS`/`LOCKOUT_SECONDS`). Critério 3 percebido no cliente.
  - `navigator.onLine === false` → **modo offline** (ver §5): abre o export local do IndexedDB; cards remotos
    exibem "indisponível offline".
- **`adminLeads.ts`** (novo) isola o Supabase do componente:

```ts
export type AdminLeadsResult =
  | { status: 'authorized'; leads: RemoteLead[] }
  | { status: 'unauthorized' }
  | { status: 'offline' }

export async function listAdminLeads(eventId: string, secret: string): Promise<AdminLeadsResult> {
  if (!navigator.onLine) return { status: 'offline' }
  const { data, error } = await supabase.rpc('admin_list_leads', {
    p_event_id: eventId,
    p_secret: secret,
  })
  if (error) {
    // '28000' (RAISE unauthorized) => credencial errada; demais erros propagam para tratamento explícito
    if (isUnauthorized(error)) return { status: 'unauthorized' }
    throw error   // erro de rede/inesperado NÃO é silenciado (Regra Inviolável 7/8)
  }
  return { status: 'authorized', leads: (data ?? []) as RemoteLead[] }
}
```

- **`config.adminPin`** deixa de ser o segredo remoto. Conforme decisão do stakeholder (§7), ele é
  **removido** do `config.json` público **ou** mantido apenas como gate offline de baixo valor, explicitamente
  documentado como controle de UI (não de rede). O valor `3314` é **aposentado** de qualquer forma — o novo
  segredo server-side não tem relação com ele.

### 5. Compatibilidade offline (ADR-002 / ADR-006) — não regredir o export local

Fato do código atual: `handleExportCsv()` já compõe o CSV de **duas** fontes — pendentes locais
(`getAllLeads().filter(!synced)`, IndexedDB) + sincronizados remotos (Supabase). O trecho remoto já é
guardado por `if (remoteLeads)`, então **offline hoje o export já entrega apenas os leads locais** (o remoto
falha/retorna nulo). Ou seja: a leitura remota **sempre** exigiu rede — em nenhuma das opções isso muda.

Garantias desta mudança:
- O **export local (IndexedDB) não depende da RPC nem de rede** — permanece via `getAllLeads()`, intacto
  (ADR-006). Offline, o AdminPanel abre em modo offline e exporta o que está no IndexedDB do dispositivo,
  exibindo os cards remotos como "indisponível offline". Sem regressão do fluxo offline local.
- A **captura de lead** (INSERT anônimo, `leadsSync.ts`) **não é tocada** — a policy `anon insert only`
  permanece; offline continua gravando no IndexedDB e drenando ao reconectar (ADR-002). Critério 4.
- O único acesso que passa a exigir autorização server-side é a **leitura remota** do Admin, que já era
  online-only. Nenhuma capacidade offline é perdida.

### 6. Ordem de rollout (sem janela de quebra)

Derrubar a policy antes de o cliente usar a RPC quebraria o Admin. Sequência obrigatória (ADR-012):
1. **Banco (aditivo):** `pgcrypto` + `admin_secrets` + semear o hash do novo segredo + criar
   `admin_list_leads`. Nada quebra (a policy antiga ainda existe).
2. **Cliente:** deploy do `AdminPanel` já consumindo `admin_list_leads` + remoção do `adminPin` do
   `config.json`.
3. **Fechar:** `DROP POLICY "anon select"`. Só aqui a exposição fecha; o Admin já não depende mais dela.

Por essa coordenação, a issue é entregue como **uma unidade** (ver §8) — quebrar em sub-issues
independentemente mergeáveis arriscaria deploy fora de ordem e um estado intermediário quebrado.

### 7. Decisão do stakeholder (natureza do segredo do Admin)

A arquitetura está fixada (ADR-012). Resta **um** parâmetro que muda a experiência do operador — decisão do
stakeholder, não do Tech Lead:

| Variante | Segredo | UX do operador | Custo de segurança | Precisa da tabela/RPC? |
|---|---|---|---|---|
| **b-TOKEN** (recomendada) | Passphrase longa (≥ 12 chars), digitada 1x por dispositivo | +1 digitação inicial por totem | Força-bruta inviável, **sem** rate-limiting | Sim |
| **b-PIN** | PIN de 4-6 dígitos (como hoje) | Idêntica à atual | **Exige** rate-limiting server-side (§3 addendum) | Sim |
| **a-AUTH** | Login Supabase Auth (e-mail+senha) | Tela de login; exige rede no 1º acesso | Mais forte; colide c/ offline-first | Não (RLS por `authenticated`) |

**Recomendação: b-TOKEN.** Neutraliza a força-bruta por construção, mantém o modelo sem backend e o export
offline, e o atrito extra é uma digitação inicial por dispositivo. **b-PIN** se o stakeholder priorizar a
conveniência do PIN curto (ao custo do lockout server-side). **a-AUTH** só se quiser operadores nomeados/
trilha de auditoria.

**Sub-decisão do gate offline:** o `config.adminPin` público **não** pode ser igual ao segredo online (senão
o segredo estaria público e a RPC seria chamável por qualquer um — anularia o fix). Duas saídas, ambas
compatíveis com o Critério 1: (i) manter um `config.adminPin` **separado e de baixo valor** só para gate
offline do export local; ou (ii) remover o `adminPin` e, offline, abrir o export local direto (aceitando
acesso físico ao totem). Recomendo (i) por consistência com o comportamento atual, documentado como gate de
UI, não de rede.

### Considerações Técnicas

- **Performance:** `admin_list_leads` faz um `SELECT` filtrado por `event_id` (já indexável) uma vez por
  abertura de painel/export — não é caminho quente. Carregar as linhas para derivar a contagem (em vez do
  `count HEAD`) é aceitável no volume prático do projeto (< 10k leads/evento, ADR-006).
- **Segurança:** RLS fecha o `SELECT` anônimo; segredo verificado no servidor com bcrypt salgado; segredo fora
  de todo artefato público; `SECURITY DEFINER` com `search_path` fixo e gate-antes-do-retorno. A `anon key`
  permanece pública **por design** e não é ofuscada (não-objetivo, ADR-012).
- **Escalabilidade:** sem impacto — mesmo volume de escrita; a leitura autorizada é esporádica (uso de
  operador), não por participante.
- **Dependências externas:** nenhuma nova lib no cliente; `pgcrypto` já disponível no Supabase.
- **Erros explícitos:** o wrapper `adminLeads.ts` distingue `unauthorized` (tratado: mensagem + lockout de UI)
  de erro inesperado (propagado, não silenciado) — Regras Invioláveis 7 e 8.

---

## Considerações de Segurança (resumo para o QA)

- Após a entrega, **com apenas a `anon key`** (extraída do bundle), tentar `supabase.from('leads').select()`
  deve retornar vazio/erro de RLS (Critério 1). Testar explicitamente.
- `supabase.rpc('admin_list_leads', { p_event_id, p_secret: '<errado>' })` deve retornar erro de autorização,
  nunca linhas (Critério 3).
- `GET /config.json` (e o bundle JS) **não** deve conter o segredo do Admin em texto puro (Critério 5).
- A captura de lead (INSERT anônimo) deve continuar funcionando online e offline (Critério 4).
- O valor `3314` está queimado (público + histórico git) e **não** pode ser reutilizado como novo segredo.

---

## Fora de Escopo

- **Scrub do histórico git** para apagar o antigo `"adminPin": "3314"` — cosmético (o valor é aposentado no
  rollout, sem relação com o novo segredo). Se o stakeholder quiser por higiene, vira tarefa própria
  (`git filter-repo`/BFG + force-push coordenado); **não bloqueia** HUB-88.
- **Rotação da `anon key`** — opcional/cosmética; só seria obrigatória se um `service_role` tivesse vazado
  (não é o caso). Não faz parte do fix.
- **Autenticação do participante final** — só o acesso do operador/Admin muda; o participante segue anônimo.
- **Mudanças no INSERT de captura** — `leadsSync.ts` e a policy `anon insert only` permanecem intactos.
- **Mascaramento de PII no CSV/tela** — herdado da discussão de HUB-87; fora do escopo desta issue.
- **Multi-operador nomeado / trilha de auditoria** — só entram se o stakeholder escolher a variante a-AUTH.

---

## Estimativa Técnica

- **Story points: 5** (complexo, 2-3 dias). É uma mudança coesa de fronteira de segurança; **não deve ser
  quebrada em sub-issues** — a coordenação de rollout (§6) exige que banco + cliente + drop da policy sejam
  entregues como unidade, senão há estado intermediário quebrado. Se o stakeholder escolher **b-PIN**, somar
  o rate-limiting server-side eleva para **8**.

  | Frente | Escopo | Peso |
  |---|---|---|
  | Banco | `pgcrypto` + `admin_secrets` + `admin_list_leads` + grants + `DROP POLICY` + doc em `services-checklist.md` | ~2 |
  | Cliente | `adminLeads.ts` + rewire das 2 leituras remotas do `AdminPanel` + captura do segredo + branch online/offline + remoção do `adminPin` do `config.json`/`config.example` | ~2 |
  | Testes + docs | testes do `AdminPanel`/`adminLeads` (autorizado/unauthorized/offline) — **hoje não há teste dedicado do AdminPanel**, então isso também sobe cobertura — + `guia-operador.md`/`referencia-config.md` (semear/rotacionar segredo, aposentar `3314`) | ~1 |

- **Riscos técnicos:**
  1. **Ordem de rollout (§6)** — derrubar a policy antes do deploy do cliente quebra o Admin. Mitigação:
     sequência documentada e executada nessa ordem; validar o Admin online **antes** do `DROP POLICY`.
  2. **Disciplina de `SECURITY DEFINER`** — o gate do segredo tem de preceder o retorno de linhas; code review
     do Tech Lead veta qualquer caminho que retorne `leads` antes do check.
  3. **b-PIN e força-bruta** — se escolhida, o lockout por evento tem tensão DoS/lockout; reforça a
     recomendação por b-TOKEN.
  4. **Testar RPC** — a função de banco não é testável em `vitest`/jsdom; a validação é (a) unit no cliente
     mockando `supabase.rpc` (autorizado/unauthorized/offline) e (b) verificação manual/QA no Supabase real
     (SELECT anônimo bloqueado, RPC com segredo errado nega). Documentar a evidência manual no PR/Issue.
  5. **Semeadura do segredo** — passo operacional novo (SQL Editor); risco de o operador esquecer de semear
     ⇒ Admin não autoriza. Mitigar com passo explícito em `guia-operador.md` e `services-checklist.md`.

---

## Definition of Done

- [ ] Decisão do stakeholder registrada (§7: b-TOKEN / b-PIN / a-AUTH) e ADR-012 movido de Proposto → Aceito
- [ ] Policy `anon select` derrubada; `anon` mantém **apenas** INSERT (verificado no Supabase)
- [ ] Com apenas a `anon key`, `SELECT` direto em `leads` retorna vazio/erro de RLS (Critério 1) — evidência
- [ ] `admin_secrets` criada (RLS on, sem policies) + hash do **novo** segredo semeado; `3314` aposentado
- [ ] RPC `admin_list_leads` `SECURITY DEFINER`, `search_path` fixo, gate-antes-do-retorno, `EXECUTE` só p/
      `anon`; segredo errado ⇒ erro de autorização (Critério 3) — evidência
- [ ] `AdminPanel` lê via RPC (contagem + CSV do mesmo retorno autorizado); operador com segredo correto
      lista e exporta (Critério 2)
- [ ] `adminPin` **removido** do `config.json`/`config.example.jsonc` (ou mantido só como gate offline de UI,
      documentado); segredo do Admin **não** aparece em nenhum artefato baixado pelo cliente (Critério 5)
- [ ] Export offline via IndexedDB intacto; captura de lead (INSERT anônimo) funciona online e offline sem
      regressão (Critério 4)
- [ ] Rollout executado na ordem §6 (banco → cliente → drop policy), Admin validado online antes do drop
- [ ] `docs/services-checklist.md`, `docs/guia-operador.md` e `docs/referencia-config.md` atualizados (semear/
      rotacionar segredo por evento; aposentadoria do `3314`)
- [ ] Testes do `AdminPanel`/`adminLeads` cobrindo autorizado/unauthorized/offline (≥ 80% na lógica nova)
- [ ] Gate completo verde no PR: `eslint` + `tsc` + `vitest` — evidência dos **três** checks; nenhum comando
      exigiu aprovação manual de sandbox
- [ ] Sem código morto (as 2 chamadas `.from('leads').select` antigas removidas)
- [ ] Critérios de aceite 1-5 validados pelo QA contra esta spec
- [ ] Code review aprovado pelo Tech Lead (disciplina de `SECURITY DEFINER` verificada)
- [ ] PR aprovado pelo PO (critérios de aceite atendidos)
- [ ] Issue HUB-88 atualizada no Linear
