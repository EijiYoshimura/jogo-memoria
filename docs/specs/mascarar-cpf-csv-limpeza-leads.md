# Spec: Mascarar CPF no CSV de export (HUB-149) + Limpeza de Leads no Admin (HUB-150)

> Issues no Linear: **HUB-149** (Story 1) bloqueia **HUB-150** (Story 2, épico) — o export automático que
> antecede a exclusão de leads precisa nascer já mascarado; não implementar HUB-150 antes de HUB-149 estar
> mergeada. HUB-150 está fatiada em **HUB-151** (migração Supabase), **HUB-152** (client libs, bloqueada por
> HUB-151) e **HUB-153** (UI, bloqueada por HUB-151, HUB-152 e HUB-149).

## Contexto

A ADR-013 (2026-07-03) havia decidido manter o CPF completo no CSV de export do `AdminPanel`. O stakeholder
reverteu essa decisão: uma vez baixado, o arquivo sai da custódia do app e é entregue ao cliente do evento —
não há razão de negócio para reter o identificador mais sensível do sistema num artefato que o app não
controla mais depois do download. A reversão está formalizada em **`docs/adr/ADR-014-mascarar-cpf-csv-supera-adr013.md`**,
que também corrige uma inconsistência da ADR-013 (o argumento "mascarar quebra a apuração" não se sustenta: a
apuração antifraude já roda inteiramente sobre o CPF completo dentro do sistema — RPC `check_cpf_participation`
e `findParticipationOverages` — nunca a partir do arquivo exportado).

A Story 2 é um pedido novo do PO: um botão "Limpeza de Leads" no Admin online, que gera um export completo
(já mascarado pela Story 1) e então apaga os leads do evento corrente, tanto no Supabase quanto no IndexedDB
local do dispositivo. Introduz a **primeira operação de exclusão definitiva (`DELETE`)** do projeto — decisão
de arquitetura registrada em **`docs/adr/ADR-015-admin-purge-leads-rpc-atomica.md`** (status **Proposto**,
pendente de aceite do stakeholder antes da implementação).

Arquivos relevantes: `src/standalone/lib/leadsCsv.ts`, `src/standalone/AdminPanel.tsx`,
`src/standalone/lib/adminLeads.ts`, `src/standalone/lib/leadsDb.ts`, `src/lead-capture/mask/cpfMask.ts` (não
tocado — é a máscara de **digitação**, `000.000.000-00`; a máscara desta spec é de **exibição/redação parcial**,
`123.***.**9-00`, função diferente e já existente em `AdminPanel.tsx` como `maskCpfForDisplay`).

## User Story 1 (HUB-149)

**Como** operador responsável por exportar leads de um evento,
**quero** que todo CSV gerado pelo sistema saia com o CPF mascarado,
**para que** o arquivo que sai da custódia do app não carregue o identificador mais sensível do sistema em
texto completo, sem perder a capacidade de apuração antifraude (que continua rodando dentro do app).

## User Story 2 (HUB-150) — depende de HUB-149

**Como** operador do Admin online,
**quero** um botão para apagar definitivamente os leads do evento carregado, com um export automático e
irreversível de segurança antes da exclusão,
**para que** eu possa reduzir a retenção de dados pessoais depois de concluída a apuração do sorteio, sem
risco de apagar sem ter um backup do que existia.

## Critérios de Aceite

### Story 1 — Mascarar CPF no CSV

1. Given um lead com `cpf` de 11 dígitos válidos, when qualquer CSV é gerado (export online, export offline
   via `offlineExportPin`, ou o export automático da Story 2), then a célula `cpf` sai no formato
   `123.***.**9-00` (3 primeiros + 3 últimos dígitos visíveis, miolo com `*`) — mesma regra já usada na tela
   de Reconciliação.
2. Given um lead com `cpf` nulo ou string vazia, when o CSV é gerado, then a célula correspondente permanece
   vazia, sem lançar erro.
3. Given um lead cujo `cpf` é o código sentinela `11111111111` (estrangeiro, HUB-109), when o CSV é gerado,
   then a célula é mascarada pela mesma regra dos demais — nenhum tratamento especial.
4. Given o cabeçalho atual do CSV (`FIXED_HEADERS` em `leadsCsv.ts`), when a máscara é aplicada, then nenhum
   nome de coluna muda — apenas o valor da célula `cpf`.
5. Given a tela de Reconciliação do Admin já mascarava o CPF antes desta entrega, when a função de máscara é
   extraída para um módulo compartilhado, then o comportamento visual da Reconciliação permanece idêntico
   (mesmo texto, mesma formatação — nenhuma regressão).
6. Given a apuração antifraude (`check_cpf_participation`, `findParticipationOverages`), when o CSV passa a
   sair mascarado, then essas rotinas continuam operando sobre o CPF completo, sem nenhuma mudança de
   comportamento ou regressão de detecção de excedentes.

### Story 2 — Limpeza de Leads

1. Given o Admin está autenticado **online** (segredo do evento verificado via `admin_list_leads`), when o
   dashboard é exibido, then o botão "Limpeza de Leads" aparece; given o Admin está em modo **offline**, then
   o botão não é renderizado.
2. Given o operador clica em "Limpeza de Leads", when o modal de confirmação abre, then ele exibe: nome e id
   do evento afetado (`config.event.name`/`config.event.id`), aviso de irreversibilidade, aviso de que a
   trilha de auditoria não identifica um usuário nomeado (acesso por segredo compartilhado, ADR-012), e um
   código de confirmação gerado aleatoriamente no momento em que o modal abre — nunca igual a
   `config.event.name`, `config.event.id` nem qualquer valor visível em tela ou em `config.json`.
3. Given o texto digitado não bate exatamente com o código exibido, when o operador tenta confirmar, then o
   botão de confirmação permanece desabilitado.
4. Given o texto digitado bate exatamente (comparação case-insensitive) com o código exibido, when o operador
   confirma, then o app chama a RPC `admin_purge_leads` (autorizada pelo mesmo segredo já usado para entrar no
   Admin) e, só em caso de resposta autorizada, monta e dispara o download do CSV mascarado (Story 1) a partir
   das linhas retornadas pela própria RPC — sem nenhuma nova consulta de leitura.
5. Given a RPC responde com sucesso, when o download é disparado, then o app remove do IndexedDB **deste
   dispositivo** todos os leads daquele `event_id` (sincronizados e pendentes) e zera os cards do dashboard
   (Total, Sincronizados, Pendentes, Estrangeiros).
6. Given a RPC responde `unauthorized` (segredo inválido/expirado), offline, ou erro inesperado, when isso
   ocorre, then nenhuma linha é apagada (nem remota, nem local) e uma mensagem de erro explícita é exibida —
   nunca falha silenciosa/best-effort.
7. Given múltiplos eventos no mesmo projeto Supabase, when a limpeza roda para o evento X, then somente linhas
   com `event_id = X` são afetadas — nenhum outro evento é tocado, mesmo em caso de erro.
8. Given um segundo totem do mesmo evento com leads locais ainda não sincronizados, when a limpeza roda a
   partir de outro dispositivo, then esses leads locais do segundo totem **não** são apagados por esta
   operação (o escopo do IndexedDB é por dispositivo) — o `guia-operador.md` deve orientar sincronizar
   (Forçar Sync) todos os totens do evento antes de rodar a limpeza.

## Design (Story 2 — modal de confirmação da Limpeza de Leads)

Fluxo com 5 estados: **(A) Confirmação → (B) Processando → (C) Erro (export falhou, nada apagado) / (D)
Sucesso / (E) Erro parcial (export ok, exclusão falhou)**. Reaproveita 100% do Design System já existente do
Admin — nenhum componente visual novo além de uma variante de botão destrutivo (`bg-red-600`, extensão natural
da paleta semântica já usada em `purple-600`/`blue-600`) e do `useModalA11y` (já usado por `CpfLimitModal`/
`TermsModal`).

- **(A) Confirmação:** identifica o evento afetado, aviso de irreversibilidade (banner vermelho), aviso da
  limitação da trilha de auditoria — só device/sessão, não pessoa nomeada (banner amarelo), e campo de texto
  que precisa bater exatamente com um código de confirmação gerado ao abrir o modal (nunca previsível a partir
  de `config.event.name`/`event.id`/config público). Botão "Apagar leads deste evento" fica desabilitado até o
  match exato (case-insensitive, trim). Enter não submete — exige clique explícito, ação física separada da
  digitação. Sem paste bloqueado (modelo de ameaça é descuido, não ataque).
- **(B) Processando:** checklist "1. Exportando... 2. Excluindo..."; sem affordance de saída (sem Cancelar/Esc/
  backdrop) enquanto a operação está em voo.
- **(C) Erro de export:** deixa explícito que nada foi apagado; oferece "Tentar novamente" (refaz o fluxo
  completo).
- **(D) Sucesso:** confirma quantidade apagada e nome do evento; contagem é capturada no momento da confirmação
  (não recalculada depois, senão mostraria 0).
- **(E) Erro parcial (export ok, exclusão falhou):** tranquiliza que o CSV já foi salvo; oferece "Tentar excluir
  novamente" sem reexportar (evita confundir o operador com um segundo download).

**Acessibilidade:** foco inicial no campo de texto (não no botão destrutivo, que está desabilitado); foco movido
explicitamente a cada transição de estado; `aria-live="assertive"` para o aviso de irreversibilidade na
abertura (mais forte que o `polite` já usado em `CpfLimitModal`, dado o risco maior); contraste checado ≥ AA em
todos os pares texto/fundo; alvos de toque ≥56px (padrão totem/tablet do projeto).

**Nota para o Tech Lead/dev-front:** incorporar no copy do estado (A) um aviso sobre sincronizar todos os
totens do evento antes de confirmar (risco de consistência entre dispositivos, ver ADR-015 "Não-objetivos") —
o `guia-operador.md` sozinho não é suficiente para esse aviso.

## Spec Técnica — Story 1 (HUB-149)

### Arquitetura Envolvida

- **Camadas impactadas:** nenhuma camada nova. Mudança dentro de Interface Adapters/Infra já existentes
  (construção do CSV) + extração de uma função pura de domínio de CPF para um módulo compartilhado.
- **Componentes/módulos afetados:**
  - `src/standalone/lib/leadsCsv.ts` — `buildLeadsCsv` passa a mascarar a célula `cpf` de cada linha (remota e
    local) antes de escrevê-la.
  - `src/standalone/AdminPanel.tsx` — remove a implementação local de `maskCpfForDisplay` (e as constantes
    `CPF_DIGITS`/`CPF_VISIBLE_EDGE`) e passa a importar do módulo compartilhado. Comportamento da seção de
    Reconciliação **inalterado**.
- **Novo componente necessário:** `src/lead-capture/mask/cpfRedaction.ts` — função pura
  `maskCpfForDisplay(cpf: string): string`, movida de `AdminPanel.tsx` sem mudança de lógica. Local escolhido
  por coerência de domínio: `src/lead-capture/mask/` já hospeda `cpfMask.ts` (máscara de digitação) e
  `phoneMask.ts` — este módulo cuida da mesma família de responsabilidade (formatação/transformação de string
  de CPF), sem depender de React/DOM/Supabase. Respeita ADR-007 (`src/lead-capture` é importável por
  `src/standalone`, nunca o contrário).

### Contratos de API / RPC

**Nenhuma mudança de contrato de rede.** `admin_list_leads` e `check_cpf_participation` continuam retornando
o CPF **completo** — isso é intencional e necessário: a máscara é aplicada só no último passo, ao escrever a
célula do CSV (`buildLeadsCsv`) ou ao renderizar a tela de Reconciliação (`AdminPanel.tsx`), nunca antes disso.
Mascarar mais cedo (ex.: no `RemoteLead`/`LocalLead` já mascarado) quebraria a apuração de excedentes
(`findParticipationOverages` precisa do CPF completo para agrupar corretamente).

### Modelo de Dados

Nenhuma mudança de schema. Migrações necessárias: **Não**. A coluna `leads.cpf` continua armazenando o CPF
completo — a máscara é puramente uma transformação de apresentação/exportação, nunca de armazenamento.

### Considerações Técnicas

- **Performance:** custo adicional é uma operação de slicing de string por linha (`O(1)` por lead) — 100%
  desprezível mesmo para milhares de leads.
- **Segurança:** reduz a sensibilidade do artefato que sai do perímetro controlado pelo app no momento do
  download, sem reduzir a capacidade de apuração antifraude dentro do sistema (ver ADR-014). Fecha uma
  inconsistência pré-existente entre o tratamento do CPF na tela (já mascarado) e no arquivo (antes,
  completo).
- **Escalabilidade:** não aplicável — função pura sem estado, sem I/O.
- **Dependências externas:** nenhuma nova.

### Estimativa Técnica

- **Story points: 2 — confirmado, estimativa do PO validada.** Escopo contido: 1 módulo novo (função movida,
  não nova lógica), 2 pontos de chamada ajustados (`leadsCsv.ts` ganha o guard de nulo/vazio antes de delegar
  para a função compartilhada — a função em si continua assumindo entrada não-nula, seu contrato atual), testes
  atualizados (`leadsCsv.test.ts`, `AdminPanel.test.tsx`, novo `cpfRedaction.test.ts`), sem migração de banco,
  sem novo componente visual. Cabe em "até meio dia" (tabela Fibonacci do CLAUDE.md).
- **Riscos técnicos:** baixo. Único ponto de atenção: `maskCpfForDisplay` hoje assume `cpf` não-nulo/não-vazio
  (usa `padStart` sem guard) — o novo call site em `leadsCsv.ts` **precisa** checar nulo/vazio **antes** de
  chamar a função compartilhada (`if (!cpf) return ''`), em vez de alterar o contrato da função (que continua
  sendo chamada hoje só com CPF garantidamente presente, em `overages`, cujo filtro já exclui `cpf === null`).

## Spec Técnica — Story 2 (HUB-150)

### Arquitetura Envolvida

- **Camadas impactadas:** Presentation (`AdminPanel.tsx` + novo `PurgeLeadsModal.tsx`), Infra/gateway
  (`src/standalone/lib/adminLeads.ts`, `src/standalone/lib/leadsDb.ts`, novo `src/standalone/lib/deviceId.ts`),
  Database (nova tabela `leads_purge_audit` + nova RPC `admin_purge_leads`, ambas aditivas — ver ADR-015).
- **Componentes/módulos afetados:**
  - `src/standalone/AdminPanel.tsx` — novo botão "Limpeza de Leads" (só `mode === 'online'`, mesmo padrão do
    botão "Forçar Sync"), orquestração do fluxo (chama a RPC, monta o CSV, limpa o IndexedDB local, zera os
    cards).
  - `src/standalone/lib/adminLeads.ts` — nova função `purgeAdminLeads`.
  - `src/standalone/lib/leadsDb.ts` — nova função `deleteLeadsForEvent`.
- **Novos componentes necessários:**
  - `src/standalone/PurgeLeadsModal.tsx` — modal de confirmação, reaproveitando `useModalA11y` (já extraído no
    HUB-91 para `CpfLimitModal`/`TermsModal`) — DRY, sem reimplementar foco/Escape/overlay.
  - `src/standalone/lib/deviceId.ts` — `getOrCreateDeviceId(): string`, identificador estável por dispositivo
    (`localStorage`, UUID v4), usado **apenas** para popular `device_id` na trilha de auditoria (não é
    identidade de usuário — ADR-012 já registra que não há usuário nomeado neste modelo de acesso).
  - Migração SQL: tabela `leads_purge_audit` + RPC `admin_purge_leads` (ver ADR-015 para o racional completo
    da atomicidade; contrato replicado abaixo por completude da spec).

### Contratos de API / RPC

**Novo RPC** (Postgres, `SECURITY DEFINER`, ver ADR-015 para o racional completo):

```
RPC admin_purge_leads(p_event_id text, p_secret text, p_device_id text, p_export_filename text DEFAULT NULL)
Retorna: SETOF leads  -- as linhas efetivamente deletadas (mesmo shape de RemoteLead)

Erros:
  - 'unauthorized'        (errcode 28000) — segredo ausente ou incorreto para p_event_id
  - 'invalid device id'   (errcode 22023) — p_device_id nulo/vazio (defesa em profundidade;
                                             nunca deveria ocorrer a partir do cliente real)
```

SQL da função (aditivo, mesmo padrão de migração manual documentado em `docs/services-checklist.md`):

```sql
CREATE OR REPLACE FUNCTION public.admin_purge_leads(
  p_event_id        text,
  p_secret          text,
  p_device_id       text,
  p_export_filename text DEFAULT NULL
)
RETURNS SETOF leads
LANGUAGE plpgsql
VOLATILE
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

  IF p_device_id IS NULL OR length(trim(p_device_id)) = 0 THEN
    RAISE EXCEPTION 'invalid device id' USING errcode = '22023';
  END IF;

  RETURN QUERY
  WITH deleted AS (
    DELETE FROM leads
    WHERE event_id = p_event_id
    RETURNING *
  ),
  logged AS (
    INSERT INTO leads_purge_audit (event_id, purged_count, device_id, export_filename)
    SELECT p_event_id, count(*), p_device_id, p_export_filename FROM deleted
    RETURNING 1
  )
  SELECT * FROM deleted;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_purge_leads(text, text, text, text) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.admin_purge_leads(text, text, text, text) TO anon;

-- Nice-to-have, baixo custo, mesma migração: índice não-parcial acelera tanto este DELETE
-- quanto o SELECT de admin_list_leads (que hoje não tem índice dedicado em event_id sozinho).
CREATE INDEX IF NOT EXISTS idx_leads_event_id ON leads (event_id);
```

Ao implementar, adicionar ao `docs/services-checklist.md` uma seção "Limpeza de Leads (HUB-150 / ADR-015)"
seguindo o mesmo padrão aditivo das seções anteriores (RLS/RPC do HUB-88, CPF do HUB-87), incluindo bloco de
validação (evidência para PR/QA).

**Contratos de cliente (TypeScript):**

```ts
// src/standalone/lib/adminLeads.ts
export type AdminPurgeResult =
  | { status: 'purged'; leads: RemoteLead[] }
  | { status: 'unauthorized' }
  | { status: 'offline' }

export async function purgeAdminLeads(
  eventId: string,
  secret: string,
  deviceId: string,
  exportFilename: string,
): Promise<AdminPurgeResult>
// Mesmo padrão de listAdminLeads: checa navigator.onLine antes de chamar; mapeia o erro
// 'unauthorized' (SQLSTATE 28000) para o status tratável; qualquer outro erro é propagado
// (nunca silenciado — Regra Inviolável 7/8).
```

```ts
// src/standalone/lib/leadsDb.ts
export async function deleteLeadsForEvent(eventId: string): Promise<number>
// Remove do IndexedDB (STORE_NAME) todos os LocalLead cujo eventId === eventId (sincronizados
// e pendentes, deste dispositivo). Retorna a quantidade removida, para exibição/telemetria.
```

```ts
// src/standalone/lib/deviceId.ts
export function getOrCreateDeviceId(): string
// localStorage['jogo-memoria:device-id']; gera crypto.randomUUID() na 1ª chamada e persiste.
// Puro quanto a rede — não é enviado a lugar nenhum além do parâmetro p_device_id desta RPC.
```

**Sequenciamento client-side (`AdminPanel.tsx`, orquestração do botão "Limpeza de Leads"):**

1. Operador confirma no `PurgeLeadsModal` (código de confirmação bateu).
2. `computeFilename()` — mesmo padrão de `handleExportCsv` (`leads-${eventId}-${today}.csv`), calculado
   **antes** da chamada à RPC (determinístico, não depende da resposta).
3. `purgeAdminLeads(eventId, authSecret, getOrCreateDeviceId(), filename)`.
   - `offline` → erro explícito, nada é tocado.
   - `unauthorized` → mesma mensagem já usada em `handleForceSync` ("Sessão expirou..."), nada é tocado.
   - erro inesperado → propagado/exibido, nada é tocado (a função lança; o `catch` do handler exibe a
     mensagem, nunca engole).
   - `purged` → segue para o passo 4 com `result.leads` (linhas remotas deletadas).
4. Buscar os leads locais **pendentes** deste evento neste dispositivo (`getAllLeads()` filtrado por
   `eventId` e `!synced`) e montar o CSV com `buildLeadsCsv(config, result.leads, pendingLocalForEvent)` — CPF
   já sai mascarado (Story 1) sem branch condicional adicional.
5. Disparar o download (mesmo código de `handleExportCsv`: `Blob` → `URL.createObjectURL` → `<a>.click()`).
   Se esta etapa lançar (raríssimo — falha de `Blob`/DOM), **não** prosseguir para o passo 6; manter
   `result.leads` em estado do componente e oferecer "tentar exportar novamente" a partir do payload já
   recebido (sem nova chamada de rede) — ver ADR-015, "Não-objetivos", sobre por que o `DELETE` remoto já
   ocorreu neste ponto e não pode ser desfeito no cliente.
6. `deleteLeadsForEvent(eventId)` — apaga do IndexedDB deste dispositivo todos os leads (sincronizados e
   pendentes) daquele evento.
7. Zerar estado local do dashboard para este evento: `remoteLeads=[]`, `syncedLeads=0`, `pendingLeads=0`,
   `totalLeads=0`, `foreignLeads=0`; exibir mensagem de sucesso com a contagem apagada.

### Modelo de Dados

```sql
-- Independente de `leads` — sobrevive à exclusão (é o próprio ponto da tabela).
CREATE TABLE IF NOT EXISTS leads_purge_audit (
  id               uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id         text        NOT NULL,
  purged_count     integer     NOT NULL,
  device_id        text        NOT NULL,   -- identificador de dispositivo, NÃO de usuário (ADR-012)
  export_filename  text,                   -- nome do CSV gerado no mesmo fluxo, para correlação manual
  purged_at        timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE leads_purge_audit ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON leads_purge_audit FROM anon, authenticated;
-- Sem policies: só a função SECURITY DEFINER (dono do schema) escreve. Leitura, se necessária no
-- futuro, via Supabase Table Editor (privilégio de dono) ou uma RPC de leitura dedicada — fora de
-- escopo desta entrega (YAGNI: não há requisito de exibir a trilha dentro do app hoje).
```

**Migrações necessárias:** Sim — 100% aditiva e idempotente (mesma classificação das migrações do HUB-87/88:
não altera nem remove nada de `leads` ou `admin_secrets`; cria uma tabela nova, uma função nova e um índice
novo).

### Considerações Técnicas

- **Performance:** desprezível no volume esperado (dezenas a milhares de leads por evento, free tier do
  Supabase). Um único `DELETE ... RETURNING` filtrado por `event_id` é eficiente; o índice não-parcial
  recomendado (`idx_leads_event_id`) é opcional/nice-to-have neste volume, mas de custo tão baixo que
  recomendo incluí-lo na mesma migração (beneficia também `admin_list_leads`, hoje sem índice dedicado só por
  `event_id` — o índice existente `idx_leads_event_cpf` é parcial, `WHERE cpf IS NOT NULL`, e não cobre linhas
  legadas sem CPF).
- **Segurança:**
  - **Autorização:** reaproveita integralmente o padrão já aceito em ADR-011/012 — `SECURITY DEFINER`,
    verificação do segredo bcrypt **antes** de qualquer `DELETE`, `search_path` fixo, `EXECUTE` restrito
    (`REVOKE ALL ... GRANT ... TO anon`, nunca acesso direto de tabela). Nenhum novo tipo de credencial.
  - **CSRF:** não aplicável. O app não usa sessão ambiente (cookie) para autorizar a RPC — o segredo é passado
    explicitamente como parâmetro, digitado pelo operador e mantido em estado do componente (não em cookie
    que o browser anexaria automaticamente a uma requisição cross-origin forjada). Um site malicioso não
    consegue disparar esta RPC "em nome" do operador sem já conhecer o segredo — mesma análise já implícita em
    ADR-012 para `admin_list_leads`.
  - **Replay:** a RPC não usa nonce/timestamp — quem possui o segredo pode chamá-la repetidamente. Aceito por
    construção (modelo b-TOKEN da ADR-012): a operação é idempotente no resultado (uma segunda chamada após
    novas capturas apenas apura e apaga essas novas linhas, registrando nova entrada de auditoria) — não é uma
    superfície de ataque nova, é a mesma superfície de privilégio já aceita para leitura.
  - **Código de confirmação do modal (Story 2, UX):** é uma barreira de **usabilidade** (evita clique
    acidental do operador legítimo), **não** um controle de segurança — quem já possui o segredo do Admin
    controla o DOM/JS e pode contornar trivialmente qualquer gate client-side. Documentar isso explicitamente
    no código (comentário) para que um futuro dev não confunda o gate de UX com autorização real.
  - **Escopo por evento:** o contrato da função só aceita um `p_event_id` — não existe (e não deve ser criada)
    nenhuma variante "apagar tudo"/sem filtro.
  - **Risco residual — consistência entre dispositivos:** a exclusão do IndexedDB é local ao dispositivo que
    executa a limpeza. Outro totem do mesmo evento com leads pendentes não sincronizados **vai sincronizá-los
    normalmente depois da limpeza remota**, reintroduzindo dados que o operador acreditava apagados. Mitigação
    adotada é **operacional, não técnica**: o modal deve avisar isso explicitamente (copy a definir com
    PO/Designer) e o `guia-operador.md` deve orientar "Forçar Sync" em todos os totens do evento antes de
    rodar a limpeza. Uma solução 100% técnica (lock distribuído por evento) é fora de escopo/YAGNI dado o
    padrão de uso atual (poucos totens por evento) — ver ADR-015.
- **Escalabilidade:** adequada ao volume atual do projeto (eventos pontuais, um totem ou poucos). Se o volume
  de leads por evento crescer para dezenas de milhares, um `DELETE` único poderia exigir chunking — fora de
  escopo agora (YAGNI), registrar como nota para revisão futura se o padrão de uso mudar.
- **Dependências externas:** nenhuma nova — reaproveita `pgcrypto` já instalado (ADR-012).

### Estimativa Técnica

- **Story points do PO: 5. Avaliação do Tech Lead: subestimado — recomendo 8, ou o fatiamento abaixo (soma
  ~6-7, mais realista que 5).** Justificativa: esta é a primeira operação destrutiva/irreversível do projeto
  (nenhum precedente de `DELETE` via RPC), exige uma tabela nova + RPC nova com disciplina de atomicidade
  (ADR-015), um componente de UI novo (modal com geração de código aleatório + gate de confirmação), uma
  cascata de limpeza em duas camadas de armazenamento (Supabase + IndexedDB), e uma bateria de testes bem mais
  exigente do que o padrão do projeto para uma feature não-destrutiva (caminhos: sucesso, unauthorized,
  offline, erro de rede, falha client-side pós-delete, idempotência, contagem de auditoria, escopo por
  evento). Comparável em complexidade ao HUB-88 (RLS/RPC redesign, 5 pts) **mais** a superfície de UI/UX nova
  e a cascata de duas camadas de storage — por isso a recomendação de elevar para 8, condizente com "muito
  complexo, semana" da tabela Fibonacci do CLAUDE.md.
- **CLAUDE.md exige fatiar issues ≥ 5 pts antes de abrir worktree.** Recomendo 3 sub-issues, no mesmo padrão já
  usado para a HUB-87 (fatiada em HUB-89..93):
  - **HUB-151 — Migração Supabase: tabela `leads_purge_audit` + RPC `admin_purge_leads` atômica** (2 pts).
    100% backend/SQL, sem UI — documentar em `docs/services-checklist.md` seguindo o padrão do HUB-87/88.
  - **HUB-152 — Client libs: `purgeAdminLeads`, `deleteLeadsForEvent`, `getOrCreateDeviceId` + testes**
    (2 pts). Sem UI ainda — só a camada de infra/gateway, testável isoladamente com mocks do Supabase/IndexedDB
    (mesmo padrão de `adminLeads.test.ts`).
  - **HUB-153 — UI: `PurgeLeadsModal` + botão "Limpeza de Leads" + wiring do fluxo completo + reset do
    dashboard + testes de integração** (2-3 pts). Depende de HUB-151 e HUB-152 mergeados.
  - Total ~6-7 pts, dentro do razoável para um épico estimado em 5-8 (mesmo padrão de imprecisão já observado
    no fatiamento da HUB-87: soma das sub-issues não bate exatamente com o épico, e está registrado como
    aceitável nesse histórico).
- **Riscos técnicos:**
  1. Primeira operação `DELETE` do projeto — exige code review extra-rigoroso do Tech Lead (vetar qualquer
     versão que separe `SELECT`/export e `DELETE` em dois statements, reabrindo a janela de corrida fechada
     pela ADR-015).
  2. Risco residual de consistência entre dispositivos (ver Segurança acima) — mitigação é documental/
     operacional, não elimina o risco tecnicamente.
  3. `ADR-015` está em status **Proposto** — não pode haver worktree de implementação da Story 2 antes do
     stakeholder aceitá-la formalmente (mesma regra de qualquer mudança de arquitetura do CLAUDE.md).
  4. A Story 1 (HUB-149) é bloqueante: o export automático da Story 2 depende de `buildLeadsCsv` já mascarar o
     CPF — não implementar HUB-153 antes de HUB-149 estar mergeada.

## Riscos Técnicos Transversais / Ajustes Necessários (para PO/Orchestrator)

1. **Sequenciamento "export antes do delete" implementado como RPC atômica única, não como duas chamadas de
   rede sequenciais.** Fortalece a intenção original do PO (elimina a janela de corrida que poderia perder
   dado sem exportar) mas muda a redação literal do pedido — pedir confirmação explícita do PO/stakeholder
   antes de implementar (ver ADR-015, "Decisão do stakeholder — PENDENTE").
2. **Estimativa da Story 2 revisada de 5 para ~8 pts (ou fatiamento em 3 sub-issues somando ~6-7)** — sinalizar
   ao PO antes do planning; não é um ajuste cosmético, muda o dimensionamento do sprint.
3. **Lacuna operacional criada pela reversão da ADR-013:** casos pontuais de desclassificação por CPF exato
   passam a exigir acesso ao Supabase Table Editor (fora do app). Precisa de decisão do PO/stakeholder sobre
   quem detém esse acesso durante um evento ao vivo — não é bloqueante para o desenvolvimento, mas é
   bloqueante para o **processo operacional** do primeiro evento que rodar sob esta política.
4. **Risco de consistência entre múltiplos totens do mesmo evento na Limpeza de Leads** — mitigação apenas
   operacional (orientar sincronizar todos os totens antes de limpar). Recomendo que o texto do modal de
   confirmação (copy a definir com PO/Designer) inclua esse aviso explicitamente, não só o `guia-operador.md`.
5. **"Sucesso do export" é definido como pipeline client-side completar sem exceção (RPC ok → Blob → download
   disparado), não como confirmação de gravação em disco** — isso é uma limitação de browser, não uma escolha
   de projeto. Os critérios de aceite e o plano de teste do QA não devem exigir uma verificação impossível de
   "arquivo salvo com sucesso".
6. **ADR-015 está Proposta, não Aceita** — precisa de aprovação explícita do stakeholder antes de qualquer
   worktree de HUB-150 ser aberto, por tratar-se da primeira operação destrutiva do projeto.

## Fora de Escopo

- Tela ou RPC de leitura da trilha de auditoria (`leads_purge_audit`) dentro do app — consulta fica restrita
  ao Supabase Table Editor/SQL Editor por ora.
- Qualquer confirmação dupla por dois operadores distintos (four-eyes) — não pedido pelo PO; o modelo de
  acesso do projeto (ADR-012) não tem usuários nomeados para suportar isso hoje.
- Resolver a lacuna "quem acessa o Supabase Table Editor durante o evento" — decisão de processo do
  PO/stakeholder, não desta entrega técnica (só identificada aqui).
- Chunking/paginação do `DELETE` para volumes muito grandes (dezenas de milhares de leads) — YAGNI no volume
  atual do projeto.
- Lock distribuído entre totens para impedir o risco de reconsistência pós-limpeza — mitigação fica só
  documental/operacional nesta entrega.
- Qualquer flag de configuração por evento para desabilitar/habilitar a Limpeza de Leads — não pedido.
- Reabrir/"desfazer" uma limpeza já concluída — não há requisito de recuperação (é o próprio objetivo da
  feature: reduzir retenção).

## Definition of Done

- [ ] Critérios de aceite (Story 1 e Story 2) validados pelo QA contra esta spec.
- [ ] `ADR-014` (Aceito) e `ADR-015` (aprovada pelo stakeholder antes da implementação da Story 2).
- [ ] `docs/adr/ADR-013-cpf-completo-csv-export.md` com status `Substituído por ADR-014` (já aplicado nesta
      entrega da spec).
- [ ] `docs/guia-operador.md`, seção "LGPD — o arquivo de leads exportado", reescrita conforme ADR-014.
- [ ] `docs/guia-operador.md` com orientação de sincronizar todos os totens antes de rodar a Limpeza de Leads.
- [ ] `docs/services-checklist.md` com a nova seção de migração (tabela + RPC da Story 2), incluindo bloco de
      validação (evidência para PR/QA), mesmo padrão das seções HUB-87/88.
- [ ] Gate completo (lint + type-check + testes) verde antes e depois de cada sub-issue, evidência no PR.
- [ ] Code review aprovado pelo Tech Lead (Clean Architecture, Clean Code, cobertura de testes, ausência de
      código morto, disciplina de `SECURITY DEFINER`).
- [ ] PO aprova explicitamente cada PR contra os critérios de aceite.
- [ ] Issues atualizadas no Linear (Story 1 + as 3 sub-issues da Story 2, com a dependência HUB-149 → HUB-150
      registrada).
