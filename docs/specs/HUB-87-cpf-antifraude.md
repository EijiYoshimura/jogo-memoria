# Spec: HUB-87 — CPF antifraude no formulário de lead

**Status:** User Story e Critérios de Aceite aprovados pelo PO (Linear HUB-87) · Spec Técnica preenchida pelo Tech Lead em 2026-07-02, pendente aprovação formal (PO + PM + Tech Lead) antes do início do desenvolvimento, conforme SDD.

---

## Contexto

O jogo-memoria é usado como ativação vinculada a sorteio/prêmio. Sem controle de CPF, nada impede que o
mesmo participante jogue múltiplas vezes além do permitido, distorcendo a apuração do sorteio e a
confiabilidade da base de leads. Esta feature é tratada como **antifraude**, prioridade **Alta**: o
formulário passa a exigir CPF válido, verificar online quantas vezes aquele CPF já participou daquela
ativação, e bloquear (ou liberar, conforme configuração) de acordo com um limite de participações definido
por evento.

## User Story

Como operador do evento, quero que o formulário de lead exija e valide o CPF do participante, verifique
online se ele já participou e aplique o limite de participações configurado, para que nenhum CPF jogue além
do permitido e a base fique confiável para apuração de sorteio/prêmio vinculado à ativação.

## Critérios de Aceite

1. CPF inválido (dígito verificador) bloqueia envio; CPF é o primeiro campo do formulário.
2. CPF novo — consulta online sem match — formulário vazio, nova participação registrada.
3. CPF já cadastrado com limite disponível — autopreenchimento dos demais campos, sem duplicar cadastro.
4. CPF já cadastrado com limite atingido — modal de bloqueio (sem caminho para jogar), botão "Próximo
   participante" volta ao formulário vazio.
5. Limite `0` (ilimitado) — nunca bloqueia.
6. Timeout/falha na consulta online (3 segundos) — fallback offline trata como novo cadastro e libera o
   jogo, salvando no IndexedDB para sync posterior.
7. Reconciliação pós-sync de CPF que excedeu o limite offline — apenas informativa/relatório; nenhuma
   participação já ocorrida é revertida ou invalidada.
8. CPF persistido como campo identificador no Supabase (não apenas dentro do `data jsonb` genérico atual),
   habilitando dedup e contagem.

## Design

Ver `docs/specs/HUB-87-design.md` (Product Designer, 2026-07-02) — spec de design já produzida e usada como
insumo desta spec técnica. Reaproveita integralmente o tema HUB-65/HUB-59 (`#0333BD`/`#FCFC30`/branco,
fonte BB), o teclado numérico existente e a estrutura de acessibilidade do `TermsModal`. Os pontos da spec
de design com implicação técnica direta (gatilho automático da consulta, autopreenchimento por campo sem
sobrescrever digitação em andamento, invalidação do autopreenchimento ao editar o CPF) estão incorporados
nas seções 4 e 6 abaixo — não são deixados como TODO.

---

## Spec Técnica

### Arquitetura Envolvida

- **Camadas impactadas:** Domain (algoritmo de validação de CPF — lógica pura), Application (orquestração
  do fluxo de checagem online/timeout/fallback, persistência), Interface Adapters/Presentation
  (`LeadForm`, novo modal), Infrastructure (Supabase: coluna nova + RPC).
- **Componentes/módulos afetados:**
  - `src/game/types.ts` — `GameConfig.leadForm.maxParticipations?: number`.
  - `src/standalone/ConfigLoader.tsx` — validação do novo campo em `isValidConfig`.
  - `src/standalone/LeadForm.tsx` — CPF passa a ser campo fixo/embutido (não faz parte de
    `config.leadForm.fields`), primeiro do formulário, com gating assíncrono dos demais campos.
  - `src/standalone/App.tsx` — contrato de `onSubmit` do `LeadForm` ganha um segundo argumento (`cpfMeta`);
    `handleGameComplete` passa os novos campos para `saveLead`.
  - `src/standalone/hooks/useLeadPersistence.ts` — `SaveLeadParams` ganha `cpf`, `cpfCheckSkipped`,
    `maxParticipationsAtSubmit`.
  - `src/standalone/lib/leadsDb.ts` — `LocalLead` ganha os mesmos três campos.
  - `src/standalone/lib/leadsSync.ts` — inclui os três campos no INSERT (`syncLead` e `syncOnlineLead`).
  - `src/standalone/AdminPanel.tsx` — CSV export ganha coluna CPF; nova seção de reconciliação
    (informativa).
  - `docs/services-checklist.md` — novo bloco de migração SQL (coluna + índice + RPC), mesmo padrão já
    usado para as colunas de LGPD.
  - `public/config.json` — exemplo com `leadForm.maxParticipations`.
  - `docs/specs/lgpd-consentimento.md` — **pré-requisito** (ver seção "Nota de dependência" abaixo).
- **Novos componentes necessários:**
  - `src/lead-capture/cpf/cpfValidation.ts` — função pura: dígito verificador + rejeição de sequências
    repetidas.
  - `src/lead-capture/mask/cpfMask.ts` — máscara `000.000.000-00`, espelhando `phoneMask.ts` (mesmo padrão
    já existente no projeto: núcleo puro, sem DOM).
  - `src/standalone/lib/cpfLookup.ts` — orquestra a chamada RPC com timeout de 3s e mapeia para um
    resultado discriminado (found/not-found/offline-fallback).
  - `src/standalone/hooks/useCpfGate.ts` — hook de estado (máquina de estados) consumido pelo `LeadForm`,
    incluindo autofill granular por campo e invalidação ao editar o CPF (ver seção 4).
  - `src/standalone/hooks/useModalA11y.ts` — extração da lógica de acessibilidade hoje só em `TermsModal`
    (focus-trap, `Esc`/backdrop, scroll-lock), reutilizada por `CpfLimitModal` e refatorada de volta no
    `TermsModal` (DRY, decisão desta spec — ver nota de arquitetura na seção 4).
  - `src/standalone/CpfLimitModal.tsx` — modal de bloqueio (conteúdo enxuto, ação única, conforme Design §3.3).
  - `src/standalone/lib/reconciliation.ts` — função pura: dado um array de leads remotos + o limite
    configurado, retorna a lista de CPFs que excederam o limite (para o relatório do Admin).
  - `docs/adr/ADR-011-cpf-antifraude-rpc-dedup.md` — **já criado** nesta entrega de spec (decisão de
    arquitetura: coluna dedicada + RPC `SECURITY DEFINER`), pré-requisito para o início do desenvolvimento.

---

### 1. Modelo de Dados

**Entidade:** `leads` (Supabase/Postgres) — alteração de tabela existente, sem nova tabela.

```sql
-- Migração 1: novas colunas
ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS cpf                          text,
  ADD COLUMN IF NOT EXISTS cpf_check_skipped             boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS max_participations_at_submit  integer;

-- Defesa em profundidade: garante formato mesmo se algum INSERT pular a validação client-side
ALTER TABLE leads
  ADD CONSTRAINT leads_cpf_format_chk
  CHECK (cpf IS NULL OR cpf ~ '^[0-9]{11}$');

-- Índice composto: toda contagem de participação é sempre filtrada por (event_id, cpf)
CREATE INDEX IF NOT EXISTS idx_leads_event_cpf
  ON leads (event_id, cpf)
  WHERE cpf IS NOT NULL;
```

**Decisões de modelagem:**

- **`cpf` NÃO é `UNIQUE`.** Cada jogada continua gerando uma linha nova em `leads` (o schema atual já
  mistura "lead" e "sessão de jogo" numa única linha — `score`/`time_taken`/`played_at` são por jogada).
  Uma constraint `UNIQUE(event_id, cpf)` impediria fisicamente a 2ª jogada do mesmo CPF, o que quebraria o
  caso de "limite > 1" e o caso "limite 0 (ilimitado)". A contagem de participações é feita por `COUNT`
  filtrado por `(event_id, cpf)`, não por uma coluna de contador redundante (evita problema de
  sincronização entre um contador e a contagem real de linhas — fonte única de verdade é a própria tabela).
- **`cpf` é escopado por `event_id`.** O mesmo CPF pode jogar em ativações diferentes sem herdar o contador
  de outra. Todo `COUNT` e todo índice inclui `event_id`.
- **`cpf_check_skipped`** (default `false`): `true` quando a checagem online de dedup não pôde ser
  concluída dentro dos 3s (Cenário 6) — a linha foi persistida sem confirmação online de que o limite não
  havia sido excedido. É o campo que a reconciliação usa para focar sua varredura (toda linha com
  `cpf_check_skipped = true` é candidata a ter furado o limite).
- **`max_participations_at_submit`** (nullable): snapshot do `config.leadForm.maxParticipations` vigente no
  momento daquela jogada. Sem isso, a reconciliação teria que assumir que o limite configurado nunca mudou
  durante o evento — frágil. Com o snapshot, o relatório é preciso mesmo que o operador altere
  `maxParticipations` no meio do evento.
- **`cpf` não é duplicado dentro de `data jsonb`.** Fica só na coluna dedicada (Critério de Aceite 8). O
  `LeadForm` trata CPF como campo separado dos `config.leadForm.fields` (ver seção 4) — nunca entra no
  `Record<string,string>` genérico.
- **Migrações necessárias:** Sim — ver SQL acima, a documentar em `docs/services-checklist.md` (mesmo local
  onde já vive a migração de `consented_at`/`consent_version`, mantendo o padrão do projeto de não ter
  `supabase/migrations` versionado em código, e sim documentação executável manualmente pelo operador).

---

### 2. Segurança / RLS — RPC em vez de SELECT direto

Ver `docs/adr/ADR-011-cpf-antifraude-rpc-dedup.md` para o racional completo. Resumo executável:

```sql
CREATE OR REPLACE FUNCTION public.check_cpf_participation(
  p_event_id text,
  p_cpf      text
)
RETURNS TABLE (
  participation_count integer,
  last_lead_data       jsonb
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
GRANT EXECUTE ON FUNCTION public.check_cpf_participation(text, text) TO anon;
```

**Por que RPC e não `SELECT` direto do cliente:**
- `SECURITY DEFINER` roda com o privilégio do dono da função — pode ler `leads` **internamente** mesmo que a
  RLS de `SELECT` para `anon` fosse restrita (hoje não é — ver achado crítico abaixo), mas o ponto central é
  que o **contrato de rede devolvido ao cliente é mínimo**: `{participation_count, last_lead_data}`. O
  cliente nunca recebe a linha completa, nunca recebe outros CPFs, nunca recebe dados de outros
  participantes — mesmo que no futuro a policy de `SELECT` seja corrigida/restringida, esta função continua
  funcionando (ela não depende da policy de `SELECT` para `anon`, por ser `SECURITY DEFINER`).
- `search_path` fixado em `public` mitiga *search_path hijacking* (prática recomendada do Postgres para
  funções `SECURITY DEFINER`).
- A validação de formato do CPF dentro da função (`RAISE EXCEPTION`) é defesa em profundidade — o cliente já
  valida o dígito verificador antes de chamar a RPC, mas a função não confia cegamente na entrada.

**Achado crítico (pré-existente, não introduzido por esta feature, mas agravado por ela):** a policy hoje
ativa em produção,

```sql
CREATE POLICY "anon select" ON leads FOR SELECT TO anon USING (true);
```

concede `SELECT *` irrestrito em `leads` para qualquer portador da `anon key` — que já está exposta no
bundle público do totem (ADR-001). Qualquer pessoa com acesso ao DevTools do totem já pode hoje extrair
nome/e-mail/telefone de **todos** os participantes de **todos** os eventos daquele projeto Supabase, sem
passar pelo PIN do Admin (o PIN só protege a *UI*, não a rede). Com CPF entrando na mesma tabela, o dado
exposto passa a incluir um identificador único de pessoa física perante o Estado — eleva a severidade desse
achado pré-existente.

**Recomendação do Tech Lead:** esta spec **não** propõe fechar esse policy amplo dentro do escopo de HUB-87
— o AdminPanel depende dele hoje para exportar CSV/estatísticas usando a mesma `anon key`, e reprojetar esse
acesso (autenticação real do operador, ou uma segunda RPC restrita para o Admin) é maior que o escopo desta
feature e merece spec própria. **Abrir Issue de tech-debt imediatamente** (label `tech-debt`, prioridade
Alta, dado que passa a envolver CPF) para redesenhar o acesso do Admin sem depender de `SELECT *` anônimo
irrestrito. Até lá, o RPC `check_cpf_participation` desta feature já garante que o **fluxo de captura** não
piora esse cenário (ele não expõe nada além do que a policy ampla já expõe hoje).

---

### 3. Validação de CPF brasileiro (client-side)

Novo módulo puro, sem dependências externas (mesmo padrão de `phoneMask.ts` — YAGNI, não adicionar
biblioteca para ~25 linhas de algoritmo padronizado):

`src/lead-capture/cpf/cpfValidation.ts`:

```ts
export function sanitizeCpf(value: string): string {
  return value.replace(/\D/g, '').slice(0, 11)
}

export function isValidCpf(digits: string): boolean {
  if (digits.length !== 11) return false
  if (/^(\d)\1{10}$/.test(digits)) return false // rejeita sequências repetidas (111.111.111-11 etc.)

  const calcCheckDigit = (base: string, weightStart: number): number => {
    const sum = base
      .split('')
      .reduce((acc, digit, i) => acc + Number(digit) * (weightStart - i), 0)
    const rest = (sum * 10) % 11
    return rest === 10 ? 0 : rest
  }

  const firstCheck = calcCheckDigit(digits.slice(0, 9), 10)
  const secondCheck = calcCheckDigit(digits.slice(0, 10), 11)
  return firstCheck === Number(digits[9]) && secondCheck === Number(digits[10])
}
```

`src/lead-capture/mask/cpfMask.ts` (espelha `phoneMask.ts`):

```ts
export const MAX_CPF_DIGITS = 11

export function applyCpfMask(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, MAX_CPF_DIGITS)
  if (digits.length <= 3) return digits
  if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`
  if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`
}
```

Validação client-side é **síncrona e local** — dispara antes de qualquer chamada de rede (Critério 1: "CPF
inválido bloqueia envio" independe de estar online). Reutiliza o mapeamento de caret já existente em
`caret.ts`/`maskedToRawIndex`/`rawToMaskedIndex` (o CPF entra no teclado virtual pelo mesmo mecanismo do
telefone — `type: 'tel'`, layout numérico).

---

### 4. Fluxo de busca (CPF é o primeiro campo — timeout de 3s + fallback offline)

**Mudança de UX relevante:** o `LeadForm` deixa de ser "preencha tudo → valide tudo → envie" para "CPF
primeiro → checagem assíncrona → então os demais campos habilitam". Por isso o CPF **não** entra em
`config.leadForm.fields` (que continua puramente genérico/configurável) — ele é um campo fixo, embutido,
com comportamento especial que a lista genérica de campos não modela. Resolve o ponto deixado em aberto pela
spec de design (`HUB-87-design.md` §10): não é `type: 'cpf'` dentro de `fields`, é um campo de primeira
classe do próprio `LeadForm`.

**Gatilho da consulta é automático, não manual (decisão de design #2):** não há botão "buscar" nem passo de
confirmação — assim que o valor bruto do campo CPF atinge 11 dígitos, dispara-se `isValidCpf` local; se
válido, dispara-se `checkCpfParticipation` automaticamente. Enquanto os 11 dígitos não estão completos, não
há validação nem chamada de rede (evita erro "piscando" a cada tecla — decisão de design #1).

**Os demais campos NÃO ficam bloqueados durante a checagem (decisão de design, §2.1):** ao contrário do que
uma primeira leitura do fluxo sugere, o operador pode digitar Nome/E-mail/Telefone **enquanto** o CPF ainda
está em `checking` — o gate de bloqueio real é só no **submit** (ENVIAR continua desabilitado até o CPF
resolver para um estado não-bloqueado, mesmo padrão de gating em camada dupla já usado para o consentimento
em HUB-67). Isso muda o desenho do estado: não é "campos desabilitados até resolver", é "campos habilitados
sempre, envio condicionado ao resultado da checagem".

**`src/standalone/lib/cpfLookup.ts`** — orquestra rede + timeout, sem tocar em React:

```ts
export type CpfLookupResult =
  | { status: 'found'; participationCount: number; lastLeadData: Record<string, string> | null }
  | { status: 'not-found' }
  | { status: 'offline-fallback'; reason: 'timeout' | 'network-error' | 'offline' }

const CPF_LOOKUP_TIMEOUT_MS = 3000 // decisão de negócio já travada — não configurável

export async function checkCpfParticipation(eventId: string, cpf: string): Promise<CpfLookupResult> {
  if (!navigator.onLine) return { status: 'offline-fallback', reason: 'offline' }

  const timeout = new Promise<'timeout'>((resolve) =>
    setTimeout(() => resolve('timeout'), CPF_LOOKUP_TIMEOUT_MS)
  )
  const query = supabase.rpc('check_cpf_participation', { p_event_id: eventId, p_cpf: cpf })

  const race = await Promise.race([query, timeout])
  if (race === 'timeout') return { status: 'offline-fallback', reason: 'timeout' }

  const { data, error } = race
  if (error) return { status: 'offline-fallback', reason: 'network-error' }

  const row = data?.[0]
  if (!row || row.participation_count === 0) return { status: 'not-found' }
  return { status: 'found', participationCount: row.participation_count, lastLeadData: row.last_lead_data }
}
```

Nota de implementação: checar `navigator.onLine` antes de tentar a RPC evita esperar os 3s inteiros quando
o totem já está sabidamente offline — não reabre a decisão de negócio do timeout (que continua valendo para
o caso "está online mas a RPC não responde a tempo"), apenas evita uma espera artificial quando já se sabe
de antemão que a rede está fora.

**`src/standalone/hooks/useCpfGate.ts`** — máquina de estados consumida pelo `LeadForm`:

```
idle → (11 dígitos completos + checksum válido, automático) → checking → {
  not-found            → 'new'         (nenhum autofill; demais campos seguem como o operador os deixou)
  found, count < limit → 'autofilled'  (autofill campo a campo — ver regra de granularidade abaixo)
  found, count ≥ limit (limite > 0)    → 'blocked' (CpfLimitModal, ENVIAR permanece bloqueado)
  offline-fallback (qualquer motivo)   → 'new-offline' (idêntico a 'new', mas cpfCheckSkipped=true)
}
```

- CPF inválido (checksum) ou incompleto nunca sai de `idle`/estado de erro local — não dispara rede
  (decisão de design #1).
- `limite === 0` nunca transiciona para `blocked`, independente da contagem (Cenário 5).
- **Campos genéricos (Nome/E-mail/Telefone) não são desabilitados em nenhum estado do CPF**, exceto quando
  `blocked` (o modal cobre a tela e captura o foco). O gate real é no **submit**: `ENVIAR` fica
  `disabled` sempre que `cpfGateState` não é `'new' | 'autofilled' | 'new-offline'` — mesmo padrão de gating
  independente já usado para o checkbox de consentimento (HUB-67). Isso resolve a decisão de design §2.1
  (checagem não bloqueia digitação concorrente).
- **Autofill é granular por campo, não um `setValues` único (decisão de design #4/#8).** O hook expõe, junto
  do estado, um `Set<string>` de `autofilledFieldIds`. Ao resolver `found`, para cada `fieldId` de
  `config.leadForm.fields`: se o valor atual daquele campo no `LeadForm` está vazio (o operador não digitou
  nada ali enquanto a consulta corria), aplica `lastLeadData[fieldId]` e marca o id em
  `autofilledFieldIds`; se o operador já tinha digitado algo naquele campo específico, **não sobrescreve**
  (decisão de design #8 — evita o efeito "digitei e sumiu"). Ao primeiro `onChange` manual de um campo
  marcado, remove seu id de `autofilledFieldIds` (mesmo padrão de "editar limpa o estado anterior" já usado
  para `errors[fieldId]` em `handleChange`) — o selo "Preenchido automaticamente" (Design §3.2) é
  renderizado condicionado à presença do id em `autofilledFieldIds`.
- **Editar o CPF depois de um autofill invalida os campos autopreenchidos (decisão de design #5).** Qualquer
  `onChange` no campo CPF enquanto `cpfGateState` é `'autofilled'` (ou `'blocked'`) dispara: limpa
  `values` dos campos que estavam em `autofilledFieldIds` (não os digitados manualmente), limpa
  `autofilledFieldIds`, volta `cpfGateState` para `idle` — e uma nova checagem só dispara quando o novo CPF
  completar 11 dígitos válidos novamente. Sem essa regra, é possível persistir Nome/E-mail de uma pessoa
  vinculados ao CPF de outra (risco de integridade de dado sinalizado pela spec de design, não só de UX).
- Estado `blocked` renderiza `CpfLimitModal` por cima do form (estrutura de acessibilidade equivalente ao
  `TermsModal`, ver nota de arquitetura abaixo) — não existe caminho de submit; único elemento focável é o
  botão "Próximo participante" (Design §3.3, sem X, sem "cancelar e continuar tentando").
- Botão **"Próximo participante"** (modal ou, quando aplicável, reset explícito) chama `reset()` do hook
  (volta a `idle`) e limpa `values`/`autofilledFieldIds`/`cpf` do `LeadForm` — permanece na mesma tela
  (`lead-form`), sem navegação de `AppScreen` (mesmo racional do `TermsModal`: overlay, não tela nova;
  confirmado de forma independente pela spec de design, Decisão #7).

**Nota de arquitetura (reaproveitamento, DRY):** a spec de design (§9) recomenda avaliar extrair a lógica de
acessibilidade comum a modais (`role="dialog"`, focus-trap, `Esc`/backdrop, scroll-lock do body) hoje só
implementada dentro do `TermsModal`, para ser reutilizada por `CpfLimitModal` sem duplicar ~40 linhas de
gerenciamento de foco. **Decisão do Tech Lead: sim, extrair.** Novo hook `src/standalone/hooks/useModalA11y.ts`
(foco inicial, trap, `Esc`, scroll-lock) consumido por ambos os modais — reduz risco de o `CpfLimitModal`
divergir sutilmente do padrão de acessibilidade já validado no `TermsModal`. Refatorar o `TermsModal` para
consumir o mesmo hook faz parte desta entrega (sem mudança de comportamento visível, só remoção de
duplicação — Clean Code).

---

### 5. Config — `maxParticipations`

`src/game/types.ts`:

```ts
leadForm: {
  // ...campos existentes...
  /**
   * Limite de participações por CPF nesta ativação (HUB-87, antifraude). Opcional e
   * retrocompatível. Ausente ⇒ default 1 (uma participação por CPF). `0` ⇒ ilimitado
   * (nunca bloqueia). Inteiro ≥ 0.
   */
  maxParticipations?: number
}
```

`DEFAULT_MAX_PARTICIPATIONS = 1` como constante nomeada (em `src/standalone/lib/lgpd.ts`? Não — módulo
dedicado `src/standalone/lib/cpfLookup.ts` ou um novo `src/lead-capture/cpf/constants.ts`; evitar acoplar a
constantes de LGPD, que são de outro domínio).

**Validação em `ConfigLoader.tsx` (`isValidConfig`)** — adicionar, seguindo o padrão já existente de falhar
alto (erro visível na tela, não default silencioso quando o campo está presente mas malformado):

```ts
const maxParticipations = leadForm['maxParticipations']
if (
  maxParticipations !== undefined &&
  (typeof maxParticipations !== 'number' || maxParticipations < 0 || !Number.isInteger(maxParticipations))
) {
  return false
}
```

`public/config.json` (exemplo) ganha `"maxParticipations": 1` dentro de `leadForm`.

---

### 6. UI — onde o modal de bloqueio se encaixa

**Sem novo `AppScreen`.** `App.tsx` (`type AppScreen = 'splash' | 'lead-form' | 'game' | 'result' | 'admin'`)
**não muda**. O bloqueio é um overlay renderizado **dentro** do `LeadForm`, exatamente como o `TermsModal`
(HUB-67) — decisão consistente com o padrão já estabelecido no projeto de manter overlays de estado
transitório dentro da própria tela, em vez de multiplicar `AppScreen`s.

- `CpfLimitModal.tsx`: `role="dialog"`, `aria-modal="true"`, mesma paleta/tokens do `TermsModal` (backdrop
  `bg-black/60`, card branco, botão pill accent). Conteúdo: mensagem de bloqueio + botão único **"Próximo
  participante"**. **Sem** botão de fechar/X e **sem** clique-fora-fecha — ao contrário do `TermsModal`, este
  modal não tem "cancelar e voltar ao que estava fazendo": a única saída é resetar para um novo participante
  (não há caminho para jogar, conforme Critério de Aceite 4).
- **"Próximo participante"** dispara `useCpfGate().reset()` + `LeadForm` limpa `values`/`errors`/`accepted`
  (mesmo estado que já existe hoje ao desmontar/remontar o form em `handleNext`) — o usuário permanece na
  tela `lead-form`, pronta para o próximo CPF, sem passar por `splash`.

---

### 7. Reconciliação offline → online (relatório, sem reversão)

`src/standalone/lib/reconciliation.ts` — função pura, sem I/O:

```ts
export interface ParticipationOverage {
  cpf: string
  eventId: string
  totalParticipations: number
  limit: number
  offlineParticipations: number // quantas dessas linhas tinham cpf_check_skipped = true
}

export function findParticipationOverages(
  leads: Array<{ cpf: string | null; eventId: string; cpfCheckSkipped: boolean; maxParticipationsAtSubmit: number | null }>
): ParticipationOverage[] {
  // agrupa por (eventId, cpf); ignora cpf null; ignora limit=0 (ilimitado nunca é overage);
  // usa o maxParticipationsAtSubmit mais recente do grupo como limite de referência do relatório
  // retorna apenas grupos onde totalParticipations > limit
}
```

- Consumida pelo `AdminPanel` (que **já** faz `select('*')` em `leads` do evento para o CSV — reaproveita a
  mesma leitura, sem nova chamada de rede/RPC dedicada) numa nova seção "Reconciliação de participações"
  exibindo a lista de CPFs excedentes (mascarados parcialmente na UI, ex. `123.***.**9-00`, já que é
  informativo e não precisa expor o CPF completo em tela para o operador identificar o excedente — decisão
  de UX a validar com Designer, não bloqueia a spec técnica).
- **Estritamente informativo.** Nenhuma ação de escrita (delete/update/flag) é feita sobre as linhas
  excedentes — Critério de Aceite 7 é explícito: nenhuma participação já ocorrida é revertida ou invalidada.
  O relatório existe para a **apuração humana** do sorteio decidir manualmente o que fazer com um excedente
  identificado (ex.: desclassificar do sorteio um CPF específico), não para o sistema decidir.
- Export: opcionalmente incluído como aba/seção extra do CSV existente ou um segundo botão "Exportar
  relatório de excedentes" — detalhe de implementação do Dev Front, não definido nesta spec técnica.

---

### 8. Contrato interno — `LeadForm.onSubmit`

Diferente da decisão tomada em HUB-67 (que **preterida** estender `onSubmit` para carregar `consentedAt`,
por ser um timestamp derivável no instante do próprio submit), aqui a extensão do contrato é necessária e
justificada: `cpf` e `cpfCheckSkipped` são **dados de domínio reais**, não deriváveis a partir do instante do
submit, e precisam sair do `LeadForm` para a persistência (`App.handleGameComplete` → `saveLead`).

```ts
interface LeadFormProps {
  config: GameConfig
  onSubmit: (formData: Record<string, string>, cpfMeta: { cpf: string; cpfCheckSkipped: boolean }) => void
  measureText?: TextMeasurer
}
```

`formData` continua no formato atual (só os campos de `config.leadForm.fields`) — CPF nunca entra nesse
`Record` genérico, preservando a separação (coluna dedicada vs. `data jsonb`) decidida na seção 1.

---

### Considerações Técnicas

- **Performance:** a checagem online adiciona no pior caso 3s de espera percebida antes de liberar os
  demais campos — aceitável para o contexto de totem (uma interação por visitante, não um formulário de alta
  frequência). O `COUNT` filtrado por índice composto `(event_id, cpf)` é O(log n) mesmo com milhares de
  leads acumulados ao longo de múltiplos eventos.
- **Segurança:** RPC `SECURITY DEFINER` com retorno mínimo (seção 2); `CHECK` de formato em duas camadas
  (client + banco); achado crítico pré-existente da policy `anon select` ampla documentado e recomendado
  como tech-debt urgente, não escondido.
- **Escalabilidade:** sem impacto relevante — mesmo volume de escrita de hoje (uma linha por jogada); a
  leitura adicional (RPC) é uma consulta agregada leve por submissão de CPF, não por tecla digitada.
- **Dependências externas:** nenhuma nova biblioteca — validação de CPF e máscara são funções puras
  implementadas no próprio projeto (mesmo padrão de `phoneMask.ts`), evitando dependência para ~25 linhas de
  algoritmo padronizado (YAGNI).
- **Compatibilidade com IndexedDB:** `DB_VERSION` de `leadsDb.ts` **não precisa** ser incrementado — os três
  campos novos (`cpf`, `cpfCheckSkipped`, `maxParticipationsAtSubmit`) são apenas campos adicionais em
  registros existentes, mesmo precedente já usado quando `consentedAt`/`consentVersion` foram adicionados
  sem bump de versão.
- **Acessibilidade:** `CpfLimitModal` segue o mesmo padrão de acessibilidade já validado no `TermsModal`
  (foco, `role="dialog"`, contraste) — sem necessidade de reinventar.

---

### Nota de dependência — pré-requisito obrigatório

A atualização de `docs/specs/lgpd-consentimento.md` é **pré-requisito** desta entrega, não um nice-to-have,
por dois motivos concretos:

1. **Finalidade do tratamento de dados precisa citar CPF.** A LGPD (Art. 9º) exige que o titular seja
   informado da finalidade específica do tratamento **antes** da coleta. Hoje o texto de consentimento
   (`buildConsentText`, `src/standalone/lib/lgpd.ts`) fala genericamente em "dados pessoais" para contato —
   não menciona controle de participações/elegibilidade a sorteio nem CPF. Coletar CPF para essa finalidade
   sem informá-la explicitamente no consentimento é uma **não conformidade LGPD nova**, introduzida por esta
   própria feature se a spec de LGPD não for atualizada junto.
2. **A seção "Jogar sem participar" da spec de LGPD está obsoleta e vai confundir quem implementar/revisar
   HUB-87.** Essa spec (v1.0, 2026-06-24) ainda descreve uma `ConsentScreen` com botão "Jogar sem
   participar" que **não existe mais no código** desde HUB-67 (2026-06-29) — o consentimento hoje é
   obrigatório, embutido no `LeadForm` via checkbox, sem caminho de jogar sem dados. Um dev ou QA que
   consultar `lgpd-consentimento.md` como referência de comportamento atual será levado a um fluxo que não
   existe.

**Ação:** o PO (dono da spec de LGPD) atualiza `docs/specs/lgpd-consentimento.md` — corrigindo a seção
obsoleta para refletir o fluxo real (HUB-67) e acrescentando "controle de participações e elegibilidade a
sorteio" à finalidade declarada, incluindo CPF — **antes** do início do desenvolvimento de HUB-87. Este item
entra na Definition of Done desta spec (não da spec de LGPD) como bloqueante.

---

### Fora de Escopo

- Redesenho do acesso do AdminPanel à tabela `leads` (fechar o `SELECT *` amplo para `anon`) — tech-debt a
  ser aberta como Issue própria (label `tech-debt`, prioridade Alta), fora do escopo desta feature.
- Mascaramento de CPF em tela/CSV (exibir `123.***.**9-00` em vez do CPF completo) — recomendado para a
  seção de reconciliação e para o CSV de export, mas a decisão final de UX/compliance fica com
  Designer/PO/PM; esta spec técnica **não bloqueia** por causa disso.
- Validação de CPF contra a Receita Federal (existência real do CPF) — fora de escopo; valida-se apenas o
  dígito verificador matemático, não a existência do CPF no cadastro público.
- Ação automática sobre CPFs excedentes identificados na reconciliação (desclassificação automática do
  sorteio) — é decisão humana de apuração, não do sistema (Critério de Aceite 7).
- Internacionalização — CPF é um documento exclusivamente brasileiro; sem suporte a outros documentos de
  identificação nesta entrega.
- Configuração do timeout de 3s via `config.json` — decisão de negócio já travada, hardcoded como constante
  nomeada.

---

### Estimativa Técnica

- **Story points: 13 (épico)** — soma dos componentes abaixo. **Recomendação explícita: quebrar em
  sub-issues** antes de iniciar o desenvolvimento (conforme sugerido pelo PO), pois mistura mudança de
  schema/banco, lib pura, reestruturação de UX do formulário (estado assíncrono) e relatório — frentes com
  riscos técnicos distintos que não devem ser um único PR gigante.

  | Sub-issue sugerida | Escopo | Pontos |
  |---|---|---|
  | HUB-87.1 | Migração Supabase (coluna `cpf`/`cpf_check_skipped`/`max_participations_at_submit`, índice, RPC `check_cpf_participation`, documentação em `services-checklist.md`) + ADR-011 já produzido nesta entrega | 3 |
  | HUB-87.2 | `cpfValidation.ts` + `cpfMask.ts` (lib pura, testável isolada, sem UI) | 2 |
  | HUB-87.3 | `LeadForm` — CPF como primeiro campo, `useCpfGate` (autofill granular por campo + invalidação ao editar CPF), `cpfLookup.ts`, `useModalA11y` (extraído do `TermsModal`) + `CpfLimitModal`, gating do submit | 5 |
  | HUB-87.4 | Persistência (`leadsDb`/`leadsSync`/`useLeadPersistence`/`App` wiring) + `reconciliation.ts` + seção de reconciliação no `AdminPanel` + coluna CPF no CSV | 3 |
  | HUB-87.5 | Docs: `lgpd-consentimento.md` (pré-requisito, dono é o PO), `public/config.json`, validação em `ConfigLoader.tsx` | 1 |

  Total: **14** (arredondado para o Fibonacci mais próximo do épico, **13**, para fins de reporte de
  velocity — a soma granular das sub-issues é a estimativa operacional real a usar no planning).

- **Riscos técnicos:**
  1. **Achado crítico de segurança pré-existente** (`anon select` amplo, seção 2) — não bloqueia HUB-87, mas
     deve virar Issue de tech-debt **antes** do encerramento da sprint que entrega esta feature, dado que
     CPF eleva a severidade.
  2. **Mudança de UX do `LeadForm` de síncrono para assíncrono** (campo com espera de rede) é a maior
     mudança estrutural do componente desde sua criação — risco de regressão nos fluxos já validados
     (teclado virtual HUB-57/59, layout HUB-65, consentimento HUB-67). Mitigação: cobertura de teste
     dedicada a cada estado da máquina (`idle/checking/blocked/autofilled/new/new-offline`), ao autofill
     granular por campo (não sobrescrever campo já digitado — decisão de design #8) e à invalidação do
     autofill ao editar o CPF (decisão de design #5), além de regressão explícita dos testes existentes do
     `LeadForm`.
  6. **Extração de `useModalA11y` a partir do `TermsModal` existente** (nota de arquitetura, seção 4) é um
     refactor de um componente já em produção — precisa de regressão explícita dos testes de `TermsModal`
     (HUB-67) garantindo que o comportamento de foco/`Esc`/scroll-lock não muda, só a duplicação é removida.
  3. **Testar timeout de 3s em `vitest`/jsdom** exige fake timers (`vi.useFakeTimers()`) — mitigação
     conhecida, mas requer atenção para não deixar teste "flaky" por race condition real vs. timer
     controlado.
  4. **Dependência de conteúdo LGPD (nota de dependência acima)** bloqueia o início se não for resolvida
     antes — comunicar ao Orchestrator/PO com antecedência para não virar gargalo de sprint.
  5. **Snapshot de `maxParticipations` por linha** (`max_participations_at_submit`) é decisão nova desta
     spec — validar com o PO se o comportamento esperado da reconciliação ao mudar o limite no meio do
     evento está de acordo (assunção documentada na seção 1, não testada com o stakeholder ainda).

---

## Definition of Done

- [ ] `docs/specs/lgpd-consentimento.md` atualizada (finalidade inclui CPF/controle de participações; seção
      "Jogar sem participar" corrigida para refletir HUB-67) — **pré-requisito, bloqueante**
- [ ] `docs/adr/ADR-011-cpf-antifraude-rpc-dedup.md` aprovada (Status: Proposto → Aceito)
- [ ] Migração SQL executada no Supabase e documentada em `docs/services-checklist.md`
- [ ] RPC `check_cpf_participation` criada com `SECURITY DEFINER`, `search_path` fixo, retorno mínimo
- [ ] Validação de CPF (dígito verificador) client-side, sem dependência de rede, cobertura de teste ≥ 80%
- [ ] Fluxo CPF-primeiro-campo com timeout de 3s e fallback offline permissivo implementado e testado
      (todos os estados da máquina), com gatilho automático ao completar 11 dígitos válidos (sem botão de
      confirmação) e sem bloquear a digitação concorrente dos demais campos (Design §2.1)
- [ ] Autofill granular por campo (não sobrescreve campo já digitado pelo operador) e invalidação do
      autofill ao editar o CPF (Design decisões #5/#8) implementados e testados
- [ ] `useModalA11y` extraído e reutilizado por `TermsModal` e `CpfLimitModal`, sem regressão nos testes
      existentes de `TermsModal` (HUB-67)
- [ ] Modal de bloqueio (Critério 4) sem caminho para jogar; "Próximo participante" reseta o form
- [ ] `maxParticipations` em `GameConfig` + validação em `ConfigLoader.tsx` + exemplo em `public/config.json`
- [ ] CPF persistido como coluna dedicada no Supabase (não em `data jsonb`)
- [ ] Reconciliação pós-sync implementada como relatório informativo, sem reversão de participações
- [ ] Regressão zero: teclado virtual, validações de campo, consentimento LGPD (HUB-67), layout (HUB-65)
- [ ] Gate completo verde: `eslint` + `tsc` + `vitest` (evidência dos 3 checks no PR, cada sub-issue)
- [ ] Sem código morto
- [ ] Issue de tech-debt aberta para o `anon select` amplo em `leads` (achado crítico, seção 2)
- [ ] Critérios de aceite validados pelo QA contra esta spec
- [ ] Code review aprovado pelo Tech Lead (cada sub-issue)
- [ ] PR aprovado pelo PO (critérios de aceite atendidos)
- [ ] Issue(s) atualizada(s) no Linear (HUB-87 e sub-issues, se a quebra for adotada)
