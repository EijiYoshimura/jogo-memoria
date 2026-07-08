# Spec: Formatar CPF no CSV de export (HUB-149) + Limpeza de Leads no Admin (HUB-150)

> **Nota de nomenclatura (correção de 2026-07-07):** o arquivo mantém o nome original
> (`mascarar-cpf-csv-limpeza-leads.md`) por estabilidade de link/histórico, mas o stakeholder corrigiu a
> premissa: HUB-149 **não** mascara/oculta dígitos do CPF — aplica apenas **formatação com pontuação padrão**
> (`123.456.789-00`). Os 11 dígitos permanecem 100% visíveis e completos em todo CSV. Ver
> `docs/adr/ADR-014-mascarar-cpf-csv-supera-adr013.md` (corrigida) e o status atualizado de
> `docs/adr/ADR-013-cpf-completo-csv-export.md`.

> Issues no Linear: **HUB-149** (Story 1) bloqueia **HUB-150** (Story 2, épico) — o export automático que
> antecede a exclusão de leads precisa nascer já formatado; não implementar HUB-150 antes de HUB-149 estar
> mergeada. HUB-150 está fatiada em **HUB-151** (migração Supabase), **HUB-152** (client libs, bloqueada por
> HUB-151) e **HUB-153** (UI, bloqueada por HUB-151, HUB-152 e HUB-149).

## Contexto

A ADR-013 (2026-07-03) decidiu manter o CPF **completo** (11 dígitos) no CSV de export do `AdminPanel` — essa
decisão **permanece vigente e não é revertida** por esta entrega. Uma primeira versão desta spec havia
interpretado o pedido do stakeholder ("mascarar o CPF no CSV") como redação parcial (o mesmo padrão da tela de
Reconciliação, `123.***.**9-00`), o que teria de fato revertido a ADR-013. **O stakeholder corrigiu essa
leitura explicitamente:** o pedido sempre foi apenas aplicar ao CSV a **formatação com pontuação padrão**
(`123.456.789-00`) — a mesma que a máscara de digitação do formulário (`applyCpfMask`,
`src/lead-capture/mask/cpfMask.ts`) já produz. Nenhum dígito é ocultado, substituído ou removido.

Essa correção está formalizada em **`docs/adr/ADR-014-mascarar-cpf-csv-supera-adr013.md`** (reescrita), que
deixa de ser uma reversão da ADR-013 e passa a ser um **complemento** dela — o nome do arquivo é mantido por
estabilidade de link, mas o conteúdo já reflete a decisão corrigida.

**Isso não reduz exposição de PII nem risco de LGPD** — o CPF completo continua saindo do arquivo, só que
formatado; a alegação anterior de "risco reduzido" estava incorreta e foi removida da ADR-014. A justificativa
real de negócio é **legibilidade/usabilidade**: quem confere o CSV manualmente durante a apuração do sorteio
lê e digita com mais confiabilidade um CPF pontuado do que 11 dígitos corridos.

A Story 2 é um pedido novo do PO: um botão "Limpeza de Leads" no Admin online, que gera um export completo
(já formatado pela Story 1, CPF completo) e então apaga os leads do evento corrente, tanto no Supabase quanto
no IndexedDB local do dispositivo. Introduz a **primeira operação de exclusão definitiva (`DELETE`)** do
projeto — decisão de arquitetura registrada em **`docs/adr/ADR-015-admin-purge-leads-rpc-atomica.md`** (status
**Aceita** — o stakeholder optou explicitamente pela alternativa de duas chamadas sequenciais, ciente do risco
de janela de corrida que isso reabre; ver ADR-015 para o racional completo).

Arquivos relevantes: `src/standalone/lib/leadsCsv.ts`, `src/standalone/AdminPanel.tsx` (tela de Reconciliação
**inalterada** — continua usando sua função interna `maskCpfForDisplay`, redação parcial,
`123.***.**9-00`), `src/standalone/lib/adminLeads.ts`, `src/standalone/lib/leadsDb.ts`,
`src/lead-capture/mask/cpfMask.ts` (**reaproveitado nesta entrega** — `applyCpfMask`, a máscara de digitação já
existente, `000.000.000-00`, é a mesma função usada por HUB-149 para formatar a célula `cpf` do CSV; nenhuma
lógica nova de máscara é criada, nenhum módulo novo).

## User Story 1 (HUB-149)

**Como** operador responsável por exportar leads de um evento,
**quero** que todo CSV gerado pelo sistema traga o CPF formatado com pontuação padrão (`123.456.789-00`),
**para que** o arquivo seja mais legível e fácil de conferir manualmente durante a apuração do sorteio — sem
ocultar nenhum dígito e sem nenhum impacto na capacidade de apuração antifraude (que já roda hoje sobre o CPF
completo, com ou sem pontuação).

## User Story 2 (HUB-150) — depende de HUB-149

**Como** operador do Admin online,
**quero** um botão para apagar definitivamente os leads do evento carregado, com um export automático e
irreversível de segurança antes da exclusão,
**para que** eu possa reduzir a retenção de dados pessoais depois de concluída a apuração do sorteio, sem
risco de apagar sem ter um backup do que existia.

## Critérios de Aceite

### Story 1 — Formatar CPF no CSV

1. Given um lead com `cpf` de 11 dígitos válidos, when qualquer CSV é gerado (export online, export offline
   via `offlineExportPin`, ou o export automático da Story 2), then a célula `cpf` sai **formatada com
   pontuação padrão** `123.456.789-00` — os 11 dígitos originais permanecem 100% visíveis e completos, nenhum
   caractere é ocultado ou substituído por `*`. Mesma função de máscara de digitação já usada no formulário de
   captura (`applyCpfMask`, `src/lead-capture/mask/cpfMask.ts`).
2. Given um lead com `cpf` nulo ou string vazia, when o CSV é gerado, then a célula correspondente permanece
   vazia, sem lançar erro.
3. Given um lead cujo `cpf` é o código sentinela `11111111111` (estrangeiro, HUB-109), when o CSV é gerado,
   then a célula recebe a mesma formatação dos demais (`111.111.111-11`) — nenhum tratamento especial.
4. Given o cabeçalho atual do CSV (`FIXED_HEADERS` em `leadsCsv.ts`), when a formatação é aplicada, then
   nenhum nome de coluna muda — apenas o valor da célula `cpf`.
5. Given a tela de Reconciliação do Admin já mascarava (redação parcial, `123.***.**9-00`) o CPF antes desta
   entrega, when a Story 1 é implementada, then essa tela permanece **100% inalterada** — continua usando sua
   função interna `maskCpfForDisplay` sem nenhuma mudança de comportamento, arquivo ou import; a formatação
   desta spec aplica-se exclusivamente à célula `cpf` do CSV, nunca à UI de Reconciliação.
6. Given a apuração antifraude (`check_cpf_participation`, `findParticipationOverages`), when o CSV passa a
   sair formatado com pontuação, then essas rotinas continuam operando sobre o CPF completo, sem nenhuma
   mudança de comportamento ou regressão de detecção de excedentes.

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
   confirma, then o app primeiro lê os leads do evento via `admin_list_leads`/`listAdminLeads` (a mesma RPC/
   função já usada para o dashboard, sem nenhuma modificação), monta e dispara o download do CSV já formatado
   (Story 1) e, **só em caso de sucesso desse download**, chama a RPC `admin_purge_leads` (autorizada pelo
   mesmo segredo já usado para entrar no Admin), agora **só de exclusão** — duas chamadas de rede sequenciais,
   não uma RPC atômica única (decisão do stakeholder, ver ADR-015).
5. Given a chamada de exclusão (`admin_purge_leads`) responde com sucesso (depois do download já disparado),
   when isso ocorre, then o app remove do IndexedDB **deste dispositivo** todos os leads daquele `event_id`
   (sincronizados e pendentes) e zera os cards do dashboard (Total, Sincronizados, Pendentes, Estrangeiros).
6. Given a leitura inicial (`admin_list_leads`/`listAdminLeads`) falha — offline, `unauthorized`, ou erro
   inesperado — when isso ocorre, then nenhum download é disparado e nenhuma linha é apagada (nem remota, nem
   local). Given, em vez disso, a chamada de exclusão (`admin_purge_leads`) falha nas mesmas condições **depois**
   que o download já ocorreu, when isso ocorre, then o CSV já baixado permanece válido, mas nenhuma linha é
   apagada (nem remota, nem local) — o app exibe mensagem de erro explícita orientando "tentar excluir
   novamente" sem reexportar. Em nenhum dos dois casos há falha silenciosa/best-effort.
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

- **Camadas impactadas:** nenhuma camada nova, nenhum módulo novo. Mudança pontual dentro de Interface
  Adapters/Infra já existentes (construção do CSV), reaproveitando uma função pura já existente em
  `src/lead-capture`.
- **Componentes/módulos afetados:**
  - `src/standalone/lib/leadsCsv.ts` — `buildLeadsCsv` passa a formatar a célula `cpf` de cada linha (remota e
    local) com `applyCpfMask` antes de escrevê-la.
- **Nenhum componente novo necessário.** Uma versão anterior desta spec previa extrair `maskCpfForDisplay`
  para um módulo compartilhado (`cpfRedaction.ts`) — **descartado**: CSV e tela de Reconciliação passam a usar
  **funções diferentes**, cada uma já existente e com seu próprio propósito:
  - `src/standalone/AdminPanel.tsx` — **não muda em nada**. Continua com sua função interna
    `maskCpfForDisplay` (e as constantes `CPF_DIGITS`/`CPF_VISIBLE_EDGE`), redação parcial, exclusiva da tela de
    Reconciliação. Nenhuma linha deste arquivo é tocada por esta entrega.
  - `src/lead-capture/mask/cpfMask.ts` — já existe, já é testado, não muda nenhuma lógica. `leadsCsv.ts` passa
    a importar `applyCpfMask` de lá (`applyCpfMask(lead.cpf ?? '')`). Respeita ADR-007 (`src/lead-capture` é
    importável por `src/standalone`, nunca o contrário) — mesmo padrão de import já usado por
    `LeadForm.tsx`/`reconciliation.ts` para outros módulos de `src/lead-capture`.

### Contratos de API / RPC

**Nenhuma mudança de contrato de rede.** `admin_list_leads` e `check_cpf_participation` continuam retornando
o CPF **completo** — isso é intencional e necessário: a formatação é aplicada só no último passo, ao escrever a
célula do CSV (`buildLeadsCsv`), nunca antes disso. Formatar mais cedo (ex.: no `RemoteLead`/`LocalLead` já
transformado) quebraria a apuração de excedentes (`findParticipationOverages` precisa do CPF completo, sem
pontuação, para agrupar corretamente).

### Modelo de Dados

Nenhuma mudança de schema. Migrações necessárias: **Não**. A coluna `leads.cpf` continua armazenando o CPF
completo, sem pontuação — a formatação é puramente uma transformação de apresentação/exportação, nunca de
armazenamento.

### Considerações Técnicas

- **Performance:** custo adicional é uma operação de slicing de string por linha (`O(1)` por lead) — 100%
  desprezível mesmo para milhares de leads.
- **Segurança:** **nenhuma redução de exposição de PII ou de risco de LGPD** — o CPF completo continua saindo
  do CSV, apenas formatado com pontuação; a única mudança é de legibilidade (ver ADR-014, corrigida). Esta
  entrega não fecha nem abre nenhuma lacuna de segurança/compliance.
- **Escalabilidade:** não aplicável — função pura sem estado, sem I/O.
- **Dependências externas:** nenhuma nova.

### Estimativa Técnica

- **Story points: revisado de 2 para 1 — recomendação do Tech Lead, sinalizar ao PO.** O design ficou mais
  simples do que o estimado originalmente: não há mais extração de módulo novo (`cpfRedaction.ts` foi
  descartado, ver correção do stakeholder acima) e nenhum arquivo além de `leadsCsv.ts` é tocado. A mudança se
  resume a `buildLeadsCsv` passar a chamar `applyCpfMask(lead.cpf ?? '')` (função já existente, já testada) na
  composição da célula `cpf`. Ainda cabe atualizar `leadsCsv.test.ts` (casos: CPF válido formatado, nulo/vazio,
  sentinela estrangeiro), mas sem nenhum novo arquivo de produção nem mudança em `AdminPanel.tsx`. Cabe em
  "trivial, menos de 1h" (tabela Fibonacci do CLAUDE.md).
- **Riscos técnicos: baixíssimo, praticamente nenhum.** `applyCpfMask` já tolera string vazia por design (é
  usada para digitação progressiva — aceita de 0 a 11 dígitos sem lançar erro); o único cuidado é coagir
  `null` para `''` antes da chamada (`lead.cpf ?? ''`), sem nenhum branch condicional adicional e sem alterar o
  contrato da função existente.

## Spec Técnica — Story 2 (HUB-150)

### Arquitetura Envolvida

- **Camadas impactadas:** Presentation (`AdminPanel.tsx` + novo `PurgeLeadsModal.tsx`), Infra/gateway
  (`src/standalone/lib/adminLeads.ts`, `src/standalone/lib/leadsDb.ts`, novo `src/standalone/lib/deviceId.ts`),
  Database (nova tabela `leads_purge_audit` + nova RPC `admin_purge_leads`, agora **só de exclusão** — retorna
  a contagem apagada, não as linhas; ambas aditivas — ver ADR-015, decisão pela alternativa de duas chamadas
  sequenciais).
- **Componentes/módulos afetados:**
  - `src/standalone/AdminPanel.tsx` — novo botão "Limpeza de Leads" (só `mode === 'online'`, mesmo padrão do
    botão "Forçar Sync"), orquestração do fluxo em **duas chamadas de rede sequenciais**: lê os leads
    (`listAdminLeads`), monta e dispara o CSV e, só em caso de sucesso, chama a exclusão (`purgeAdminLeads`),
    limpa o IndexedDB local e zera os cards.
  - `src/standalone/lib/adminLeads.ts` — a leitura para export **reaproveita `listAdminLeads`, já existente,
    sem nenhuma mudança de assinatura ou comportamento**; nova função `purgeAdminLeads`, agora **só de
    exclusão** (não retorna linhas — o cliente já as tem da chamada de leitura anterior).
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

**A leitura para export não precisa de RPC nova** — reaproveita `admin_list_leads`/`listAdminLeads`, já
existente e sem nenhuma modificação (ver ADR-015, decisão pela alternativa (a): duas chamadas sequenciais).

**Novo RPC**, agora **só de exclusão** (Postgres, `SECURITY DEFINER`, ver ADR-015 para o racional completo):

```
RPC admin_purge_leads(p_event_id text, p_secret text, p_device_id text, p_export_filename text DEFAULT NULL)
Retorna: integer  -- purged_count, a quantidade de linhas apagadas (não as linhas em si —
                  -- o export já ocorreu antes, via admin_list_leads/listAdminLeads)

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
RETURNS integer  -- purged_count; sem RETURNING de linhas (o export já ocorreu antes desta chamada)
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_hash text;
  v_purged_count integer;
BEGIN
  SELECT secret_hash INTO v_hash FROM admin_secrets WHERE event_id = p_event_id;
  IF v_hash IS NULL OR extensions.crypt(p_secret, v_hash) <> v_hash THEN
    RAISE EXCEPTION 'unauthorized' USING errcode = '28000';
  END IF;

  IF p_device_id IS NULL OR length(trim(p_device_id)) = 0 THEN
    RAISE EXCEPTION 'invalid device id' USING errcode = '22023';
  END IF;

  WITH deleted AS (
    DELETE FROM leads
    WHERE event_id = p_event_id
    RETURNING 1
  )
  SELECT count(*) INTO v_purged_count FROM deleted;

  INSERT INTO leads_purge_audit (event_id, purged_count, device_id, export_filename)
  VALUES (p_event_id, v_purged_count, p_device_id, p_export_filename);

  RETURN v_purged_count;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_purge_leads(text, text, text, text) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.admin_purge_leads(text, text, text, text) TO anon;

-- Nice-to-have, baixo custo, mesma migração: índice não-parcial acelera tanto este DELETE
-- quanto o SELECT de admin_list_leads (que hoje não tem índice dedicado em event_id sozinho).
CREATE INDEX IF NOT EXISTS idx_leads_event_id ON leads (event_id);
```

**Nota — a contagem nunca vem do cliente:** `purged_count` é sempre calculado dentro da própria função, a
partir do seu próprio `DELETE ... RETURNING` — nunca é um parâmetro vindo do cliente (evita depender de uma
contagem client-side potencialmente dessincronizada da linha efetivamente apagada no servidor, especialmente
relevante dado o risco residual de janela de corrida descrito em ADR-015). O `DELETE` e o `INSERT` de
auditoria continuam na mesma chamada/transação — atômicos entre si; o que deixou de ser atômico é apenas a
relação entre a chamada de leitura (export) e esta chamada de exclusão.

Ao implementar, adicionar ao `docs/services-checklist.md` uma seção "Limpeza de Leads (HUB-150 / ADR-015)"
seguindo o mesmo padrão aditivo das seções anteriores (RLS/RPC do HUB-88, CPF do HUB-87), incluindo bloco de
validação (evidência para PR/QA).

**Contratos de cliente (TypeScript):**

```ts
// src/standalone/lib/adminLeads.ts
// listAdminLeads (já existente, sem nenhuma mudança) é reaproveitada para a leitura/export —
// ver assinatura já documentada na Story 1/contexto e no código atual do arquivo.

export type AdminPurgeResult =
  | { status: 'purged'; purgedCount: number }
  | { status: 'unauthorized' }
  | { status: 'offline' }

export async function purgeAdminLeads(
  eventId: string,
  secret: string,
  deviceId: string,
  exportFilename: string,
): Promise<AdminPurgeResult>
// Chama a RPC admin_purge_leads — agora só-delete (não retorna linhas; o export já ocorreu
// antes, via listAdminLeads). Mesmo padrão de tratamento de erro de listAdminLeads: checa
// navigator.onLine antes de chamar; mapeia 'unauthorized' (SQLSTATE 28000) para o status
// tratável; qualquer outro erro é propagado (nunca silenciado — Regra Inviolável 7/8).
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

**Sequenciamento client-side (`AdminPanel.tsx`, orquestração do botão "Limpeza de Leads") — duas chamadas de
rede sequenciais, não uma RPC atômica única (decisão do stakeholder, ver ADR-015):**

1. Operador confirma no `PurgeLeadsModal` (código de confirmação bateu).
2. `computeFilename()` — mesmo padrão de `handleExportCsv` (`leads-${eventId}-${today}.csv`), calculado
   **antes** de qualquer chamada de rede (determinístico, não depende de nenhuma resposta).
3. **Chamada 1 (leitura/export):** `listAdminLeads(eventId, authSecret)` — a mesma função já existente e
   testada, reaproveitada sem nenhuma mudança.
   - `offline` → erro explícito, nada é tocado (nem export nem delete).
   - `unauthorized` → mesma mensagem já usada em `handleForceSync` ("Sessão expirou..."), nada é tocado.
   - erro inesperado → propagado/exibido, nada é tocado.
   - `authorized` → segue para o passo 4 com `result.leads`.
4. Buscar os leads locais **pendentes** deste evento neste dispositivo (`getAllLeads()` filtrado por
   `eventId` e `!synced`) e montar o CSV com `buildLeadsCsv(config, result.leads, pendingLocalForEvent)` — CPF
   já sai formatado (Story 1) sem branch condicional adicional.
5. Disparar o download (mesmo código de `handleExportCsv`: `Blob` → `URL.createObjectURL` → `<a>.click()`).
   Se esta etapa lançar (raríssimo — falha de `Blob`/DOM), **não** prosseguir para o passo 6 — **nenhuma linha
   foi apagada ainda**, porque a chamada de exclusão só acontece depois deste ponto (diferente do design
   atômico cogitado anteriormente, onde o `DELETE` já teria ocorrido antes). Oferecer "tentar exportar
   novamente" a partir do payload já recebido no passo 3 (sem repetir a chamada 1).
6. **Só em caso de sucesso do passo 5, chamada 2 (exclusão):** `purgeAdminLeads(eventId, authSecret,
   getOrCreateDeviceId(), filename)` — RPC `admin_purge_leads`, agora só-delete.
   - `offline` / `unauthorized` / erro inesperado → estado (E) do modal, "Erro parcial": o export já ocorreu
     (CSV já baixado), a exclusão não — oferecer "tentar excluir novamente" **sem** reexportar (sem repetir a
     chamada 1).
   - `purged` → segue para o passo 7 com `result.purgedCount` (contagem confirmada pelo servidor).
7. `deleteLeadsForEvent(eventId)` — apaga do IndexedDB deste dispositivo todos os leads (sincronizados e
   pendentes) daquele evento.
8. Zerar estado local do dashboard para este evento: `remoteLeads=[]`, `syncedLeads=0`, `pendingLeads=0`,
   `totalLeads=0`, `foreignLeads=0`; exibir mensagem de sucesso com `result.purgedCount` (a contagem
   confirmada pelo servidor na chamada 2 — não o `result.leads.length` da chamada 1, que pode divergir por
   causa da janela de corrida residual entre as duas chamadas, ver ADR-015).

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

**Nota — o schema da tabela não muda com o design de duas chamadas.** `purged_count` continua sendo calculado
**dentro da própria função** `admin_purge_leads`, a partir do seu próprio `DELETE ... RETURNING` (nunca um
parâmetro vindo do cliente) — não há coluna nova nem parâmetro adicional de contagem. O que muda é só o
`RETURN` da função (integer em vez de `SETOF leads`), porque o export já ocorreu antes, numa chamada separada
(ver ADR-015).

### Considerações Técnicas

- **Performance:** desprezível no volume esperado (dezenas a milhares de leads por evento, free tier do
  Supabase). O design de duas chamadas sequenciais soma dois round-trips de rede em vez de um — irrelevante em
  termos absolutos para uma ação manual e pontual do operador (dezenas a centenas de ms a mais, imperceptível).
  Um único `DELETE ... RETURNING` filtrado por `event_id`, dentro da segunda chamada, é eficiente; o índice
  não-parcial recomendado (`idx_leads_event_id`) é opcional/nice-to-have neste volume, mas de custo tão baixo
  que recomendo incluí-lo na mesma migração (beneficia também `admin_list_leads`, hoje sem índice dedicado só
  por `event_id` — o índice existente `idx_leads_event_cpf` é parcial, `WHERE cpf IS NOT NULL`, e não cobre
  linhas legadas sem CPF).
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
  - **Risco residual aceito pelo stakeholder — janela de corrida entre exportar e apagar:** o design usa duas
    chamadas de rede sequenciais (`listAdminLeads` → `admin_purge_leads`), não uma RPC atômica única. Existe
    uma janela de tempo real entre as duas chamadas em que uma nova captura de lead pode ser inserida (o app
    permite captura contínua/concorrente). Uma linha inserida nessa janela **não aparece** no CSV já gerado mas
    **é apagada** pela segunda chamada (que reavalia `WHERE event_id = ...` no momento da própria execução) —
    perda de dado sem exportação. O Tech Lead apresentou esse risco ao stakeholder com o mesmo nível de
    detalhe registrado aqui, junto com uma alternativa que o eliminaria por construção (RPC atômica); **o
    stakeholder optou conscientemente por manter o design de duas chamadas** (ver ADR-015, "Decisão do
    stakeholder"). **Não há mitigação técnica nesta entrega** — é risco residual aceito, não risco esquecido,
    e deve permanecer documentado no código, nesta spec e no `guia-operador.md`/copy do modal.
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

- **Story points do PO: 5. Avaliação do Tech Lead: mantenho a recomendação do fatiamento abaixo (soma ~6-7,
  mais realista que 5) — não elevo mais para 8.** Justificativa: esta continua sendo a primeira operação
  destrutiva/irreversível do projeto (nenhum precedente de `DELETE` via RPC), exige uma tabela nova + RPC nova,
  um componente de UI novo (modal com geração de código aleatório + gate de confirmação), uma cascata de
  limpeza em duas camadas de armazenamento (Supabase + IndexedDB), e uma bateria de testes exigente (caminhos:
  sucesso, unauthorized, offline, erro de rede na chamada 1, erro de rede na chamada 2, idempotência, contagem
  de auditoria, escopo por evento). **O que mudou com a decisão do stakeholder pela alternativa (a) (ADR-015):**
  o backend fica mais simples (sem CTE dupla retornando `SETOF leads`, sem disciplina de atomicidade
  multi-tabela — é um `DELETE` + contagem + `INSERT` de auditoria direto) e a leitura para export reaproveita
  100% `listAdminLeads` já existente (zero código novo nessa perna). Em compensação, a UI ganha um estado de
  falha genuinamente adicional (a chamada 2 pode falhar isoladamente depois da chamada 1 já ter tido sucesso —
  estado (E), já previsto no design). Esses dois efeitos se compensam aproximadamente — não vejo motivo para
  elevar o total além do fatiamento abaixo.
- **CLAUDE.md exige fatiar issues ≥ 5 pts antes de abrir worktree.** Mantenho as 3 sub-issues já criadas no
  Linear, no mesmo padrão já usado para a HUB-87 (fatiada em HUB-89..93):
  - **HUB-151 — Migração Supabase: tabela `leads_purge_audit` + RPC `admin_purge_leads` (só-delete)** (2 pts).
    100% backend/SQL, sem UI — documentar em `docs/services-checklist.md` seguindo o padrão do HUB-87/88.
  - **HUB-152 — Client libs: `purgeAdminLeads`, `deleteLeadsForEvent`, `getOrCreateDeviceId` + testes**
    (2 pts). Sem UI ainda — só a camada de infra/gateway, testável isoladamente com mocks do Supabase/IndexedDB
    (mesmo padrão de `adminLeads.test.ts`). `listAdminLeads` não muda — nenhum teste novo nela.
  - **HUB-153 — UI: `PurgeLeadsModal` + botão "Limpeza de Leads" + wiring das duas chamadas sequenciais + reset
    do dashboard + testes de integração** (2-3 pts). Depende de HUB-151 e HUB-152 mergeados.
  - Total ~6-7 pts, dentro do razoável para um épico estimado em 5-8 (mesmo padrão de imprecisão já observado
    no fatiamento da HUB-87: soma das sub-issues não bate exatamente com o épico, e está registrado como
    aceitável nesse histórico).
- **Riscos técnicos:**
  1. Primeira operação `DELETE` do projeto — exige code review extra-rigoroso do Tech Lead, mas o foco do veto
     **muda de direção**: a versão aceita (ADR-015, alternativa (a)) já **é** a separação entre `SELECT`/export
     e `DELETE` em duas chamadas — isso não é mais vetado, é o design. O Tech Lead deve, em vez disso, garantir
     que (i) a chamada de exclusão nunca é disparada sem uma chamada de export bem-sucedida imediatamente
     antes, e (ii) o risco de janela de corrida está documentado no código/spec/copy do modal, nunca escondido.
  2. Risco residual aceito — janela de corrida entre exportar e apagar (ver Segurança acima e ADR-015). Não é
     mitigado tecnicamente nesta entrega; é aceito conscientemente pelo stakeholder.
  3. Risco residual de consistência entre dispositivos (ver Segurança acima) — mitigação é documental/
     operacional, não elimina o risco tecnicamente.
  4. `ADR-015` está **Aceita** (o stakeholder escolheu explicitamente a alternativa (a)) — não há mais
     bloqueio de aceite pendente; HUB-151 pode ter worktree aberto assim que a Story 1 (item 5 abaixo) estiver
     resolvida na ordem de dependência do épico.
  5. A Story 1 (HUB-149) é bloqueante: o export automático da Story 2 depende de `buildLeadsCsv` já formatar o
     CPF — não implementar HUB-153 antes de HUB-149 estar mergeada.

## Riscos Técnicos Transversais / Ajustes Necessários (para PO/Orchestrator)

1. **RESOLVIDO (2026-07-07) — sequenciamento export/delete não é mais uma decisão em aberto.** O stakeholder
   avaliou as duas alternativas (RPC atômica única vs. duas chamadas sequenciais) e escolheu explicitamente a
   segunda (ADR-015, alternativa (a)), mesmo ciente da janela de corrida que ela reabre. Não é mais necessário
   pedir confirmação antes de implementar — a decisão está tomada e documentada.
2. **RESOLVIDO (2026-07-07) — lacuna operacional do Supabase Table Editor dissolvida.** A correção do
   stakeholder sobre o que "mascarar" significa (Correção 1) eliminou a lacuna antes registrada aqui. A ADR-013
   (CPF completo no CSV) **não foi revertida** — o CPF continua 100% completo e visível em todo CSV, com ou
   sem a formatação da ADR-014. Não existe, portanto, nenhuma necessidade de um canal alternativo (Supabase
   Table Editor) para casos de desclassificação por CPF exato: o CSV sozinho já sustenta essa conferência,
   como sempre sustentou.
3. **RESOLVIDO (2026-07-07) — risco de perda de trilha auditável após a Limpeza de Leads.** O risco
   anteriormente identificado — de que a Story 2 resultaria em perda permanente da capacidade de consultar o
   CPF completo depois de apagados os leads do banco, porque o único artefato remanescente (o export
   automático pré-deleção) sairia mascarado — **não se aplica mais**. O export automático (HUB-153) usa a
   mesma formatação da Story 1 (não redação), então o CPF completo permanece presente e recuperável no arquivo
   de arquivamento gerado no momento da limpeza, para sempre. A capacidade de apuração/desclassificação por CPF
   exato não é perdida em nenhum momento do ciclo de vida do dado, mesmo depois da exclusão remota.
4. **Estimativa da Story 1 revisada de 2 para 1 ponto** — o design simplificado (reaproveitar `applyCpfMask`
   diretamente, sem extrair módulo novo, sem tocar `AdminPanel.tsx`) reduziu o escopo real da sub-issue.
   Sinalizar ao PO.
5. **Estimativa da Story 2 mantida em ~6-7 pts (fatiamento HUB-151/152/153)** — o design de duas chamadas
   simplifica o backend (sem CTE dupla, sem `SETOF leads`, reaproveita `listAdminLeads` sem mudança) mas
   mantém a complexidade total aproximadamente igual por adicionar um estado de erro explícito na UI (falha
   isolada da 2ª chamada) e por manter uma cobertura de teste exigente (idempotência, unauthorized, offline,
   janela de corrida documentada). Não recomendo mais elevar para 8 — o fatiamento já reflete o tamanho real.
6. **Risco residual ACEITO (não resolvido, e não deveria ser "resolvido" sem nova ADR) — janela de corrida
   entre exportar e apagar.** Decisão consciente do stakeholder (ADR-015, alternativa (a)): entre a chamada de
   leitura/export e a chamada de exclusão, uma nova captura de lead pode ser inserida e será apagada sem ter
   sido exportada. Deve permanecer visível no código, nesta spec e no `guia-operador.md`/copy do modal — não
   deve ser silenciosamente "otimizado" no futuro sem uma nova decisão explícita de arquitetura.
7. **Risco de consistência entre múltiplos totens do mesmo evento na Limpeza de Leads** — mitigação apenas
   operacional (orientar sincronizar todos os totens antes de limpar), inalterado por estas correções.
   Recomendo que o texto do modal de confirmação (copy a definir com PO/Designer) inclua esse aviso
   explicitamente, não só o `guia-operador.md`.
8. **"Sucesso do export" é definido como pipeline client-side completar sem exceção (chamada de leitura ok →
   Blob → download disparado), não como confirmação de gravação em disco** — isso é uma limitação de browser,
   não uma escolha de projeto. Os critérios de aceite e o plano de teste do QA não devem exigir uma verificação
   impossível de "arquivo salvo com sucesso".
9. **ADR-015 está Aceita, não mais Proposta** — o stakeholder já decidiu explicitamente pela alternativa (a).
   Pode haver worktree de HUB-151 assim que aberto; a Story 2 completa (HUB-153) continua bloqueada pela Story
   1 (HUB-149).

## Fora de Escopo

- Tela ou RPC de leitura da trilha de auditoria (`leads_purge_audit`) dentro do app — consulta fica restrita
  ao Supabase Table Editor/SQL Editor por ora.
- Qualquer confirmação dupla por dois operadores distintos (four-eyes) — não pedido pelo PO; o modelo de
  acesso do projeto (ADR-012) não tem usuários nomeados para suportar isso hoje.
- ~~Resolver a lacuna "quem acessa o Supabase Table Editor durante o evento"~~ — **não existe mais** (correção
  do stakeholder, 2026-07-07): como o CPF nunca é ocultado no CSV (só formatado, ADR-014), não há nenhuma
  lacuna de acesso a resolver; o canal já é o próprio CSV, como sempre foi.
- Chunking/paginação do `DELETE` para volumes muito grandes (dezenas de milhares de leads) — YAGNI no volume
  atual do projeto.
- Lock distribuído entre totens para impedir o risco de reconsistência pós-limpeza — mitigação fica só
  documental/operacional nesta entrega.
- Qualquer mitigação técnica para a janela de corrida entre exportar e apagar (Story 2) — risco residual
  aceito pelo stakeholder (ver "Riscos Técnicos Transversais", item 6, e ADR-015); não há lock, retry
  automático ou segunda verificação nesta entrega.
- Qualquer flag de configuração por evento para desabilitar/habilitar a Limpeza de Leads — não pedido.
- Reabrir/"desfazer" uma limpeza já concluída — não há requisito de recuperação (é o próprio objetivo da
  feature: reduzir retenção).

## Definition of Done

- [ ] Critérios de aceite (Story 1 e Story 2) validados pelo QA contra esta spec.
- [ ] `ADR-014` (Aceito — complementa a ADR-013, não a reverte) e `ADR-015` (Aceita — stakeholder escolheu
      explicitamente a alternativa (a), duas chamadas sequenciais, ciente do risco residual de janela de
      corrida).
- [ ] `docs/adr/ADR-013-cpf-completo-csv-export.md` com status `Aceito — decisão vigente, complementada por
      ADR-014` (já aplicado nesta correção da spec).
- [ ] `docs/guia-operador.md`, seção "LGPD — o arquivo de leads exportado", com **nota mínima** de que o CPF
      agora sai formatado com pontuação (mesmos 11 dígitos) — **sem** reescrita de fundo: a ADR-014 não reduz
      exposição de PII nem cria nenhum canal alternativo de acesso (o Table Editor não passa a ser necessário
      para consulta de CPF exato — o CSV já o contém completo, como sempre conteve).
- [ ] `docs/guia-operador.md` com orientação de sincronizar todos os totens antes de rodar a Limpeza de Leads,
      e com aviso explícito sobre a janela de corrida aceita (risco residual, ADR-015).
- [ ] `docs/services-checklist.md` com a nova seção de migração (tabela + RPC `admin_purge_leads`, agora
      só-delete, retorna `purged_count` integer), incluindo bloco de validação (evidência para PR/QA), mesmo
      padrão das seções HUB-87/88.
- [ ] Gate completo (lint + type-check + testes) verde antes e depois de cada sub-issue, evidência no PR.
- [ ] Code review aprovado pelo Tech Lead (Clean Architecture, Clean Code, cobertura de testes, ausência de
      código morto, disciplina de `SECURITY DEFINER`, risco de janela de corrida documentado e não mascarado).
- [ ] PO aprova explicitamente cada PR contra os critérios de aceite.
- [ ] Issues atualizadas no Linear (Story 1 + as 3 sub-issues da Story 2, com a dependência HUB-149 → HUB-150
      registrada).
