# Spec: CPF estrangeiro `111.111.111-11` — participação sem limite + contagem (HUB-109)

**Issue:** [HUB-109](https://linear.app/hub-de-ativacoes/issue/HUB-109) · **Trilha:** Lite · **Prioridade:** Urgent
**Autores:** Orchestrator (US, Trilha Lite) + Tech Lead (spec técnica)
**Depende de:** HUB-87 (gate de CPF), HUB-89 (migração/RPC), HUB-92 (persistência) — tudo já em produção.

## Contexto

Participantes estrangeiros não possuem CPF e hoje ficam barrados no formulário de lead: o gate
do HUB-87 exige CPF matematicamente válido, e `111.111.111-11` é rejeitado por `isValidCpf`
como sequência repetida (`/^(\d)\1{10}$/` em `src/lead-capture/cpf/cpfValidation.ts`).
Demanda urgente do stakeholder: aceitar `111.111.111-11` como **código de participante
estrangeiro** — sem barreira de entrada, sem limite de participações e com contagem de usos
visível para a organização.

Não há migração de banco: o `CHECK (cpf ~ '^[0-9]{11}$')` da coluna `leads.cpf` (HUB-89) já
aceita `11111111111`.

## User Story

**Como** operador do evento, **quero** que participantes estrangeiros sem CPF usem o código
`111.111.111-11` no campo CPF, **para que** consigam jogar sem barreira e a organização saiba
quantos estrangeiros participaram.

## Critérios de Aceite

- [ ] **1. Aceitação do código:** Given o formulário de lead, When o participante digita
  `111.111.111-11` no campo CPF, Then o valor é aceito (sem erro de CPF inválido), o
  formulário fica **vazio** para preenchimento manual e o envio é liberado (validações
  normais dos demais campos e do consentimento continuam valendo).
- [ ] **2. Sem controle de participações:** Given o código já usado N vezes (qualquer N),
  When um novo participante o utiliza, Then **nunca** há modal de bloqueio nem autofill de
  dados de participante anterior, independentemente do `maxParticipations` configurado —
  infinitas jogadas.
- [ ] **3. Registro no banco:** Given uma submissão com o código estrangeiro, When o lead é
  persistido (online ou offline→sync), Then a linha é gravada em `leads` com
  `cpf='11111111111'` na coluna dedicada, contabilizando cada uso.
- [ ] **4. Contagem visível:** Given usos registrados, When o operador abre o AdminPanel,
  Then vê a contagem de participações estrangeiras do evento (o CSV já exporta as linhas
  com o CPF na coluna dedicada).
- [ ] **5. Reconciliação limpa:** o relatório de excedentes (HUB-87 §7) **não** lista o CPF
  estrangeiro como excedente.
- [ ] **6. Exceção estrita:** só `11111111111` é aceito. Qualquer outra sequência repetida
  (`00000000000`, `22222222222`, …) e CPFs com dígito verificador inválido continuam
  rejeitados.
- [ ] **7. Regressão zero:** fluxo normal de CPF (validação, lookup com timeout 3s, autofill,
  bloqueio, fallback offline — HUB-87) inalterado para CPFs reais.

## Design

Sem Figma — não há tela nova. Dois pontos de UI:

1. **LeadForm:** para o código estrangeiro, o comportamento visual é **idêntico ao estado
   `new`** de um CPF inédito: sem spinner (não há consulta), sem selo de autofill, sem modal,
   sem mensagem de erro; ENVIAR habilita quando consentimento + campos obrigatórios estão OK.
   Nenhum announcement `aria-live` novo (o estado `new` também não tem — consistência).
2. **AdminPanel:** o grid de estatísticas ganha um **4º card "Estrangeiros"**
   (`grid-cols-3` → `grid-cols-4`), no mesmo estilo dos cards existentes, exibindo a contagem
   de participações com o código estrangeiro. Visível nos modos online e offline (no offline,
   conta apenas os leads locais do dispositivo — mesma semântica do card "Total local").

## Spec Técnica

### Arquitetura envolvida

| Camada | Arquivo | Mudança |
|--------|---------|---------|
| Domínio (puro) | `src/lead-capture/cpf/constants.ts` | + `FOREIGN_CPF` e `isForeignCpf()` |
| Domínio (puro) | `src/lead-capture/cpf/cpfValidation.ts` | **nenhuma** (intocado) |
| Aplicação | `src/standalone/hooks/useCpfGate.ts` | + estado `foreign` e transição sem rede |
| Aplicação (pura) | `src/standalone/lib/reconciliation.ts` | + exclusão do código estrangeiro |
| Apresentação | `src/standalone/LeadForm.tsx` | aceita o código nos 2 pontos de validação |
| Apresentação | `src/standalone/AdminPanel.tsx` | + card "Estrangeiros" (contagem derivada) |
| Infra | `cpfLookup.ts`, `leadsDb.ts`, `leadsSync.ts`, `useLeadPersistence.ts`, `leadsCsv.ts` | **nenhuma** |

Dependências continuam apontando para dentro: apresentação e libs de `standalone` importam a
constante/predicado do módulo puro `lead-capture/cpf` (mesmo sentido dos imports existentes de
`cpfValidation`).

### Decisão 1 — Onde mora a exceção: constante no domínio, tratamento no gate

**Decisão: confirmada a posição preliminar do Orchestrator.** `isValidCpf` **não** é
enfraquecido — `11111111111` continua matematicamente inválido, e a lib pura permanece uma
validação fiel do documento CPF brasileiro (reutilizável pelo Hub futuro, HUB-87 §3).
"Código de participante estrangeiro" é **regra de aplicação da captura de leads**, não uma
propriedade do documento — portanto vive no domínio de captura por CPF e é tratada pelo gate.

Em `src/lead-capture/cpf/constants.ts` (módulo puro, sem React/DOM):

```ts
/**
 * Código sentinela de participante estrangeiro (HUB-109). NÃO é um CPF válido —
 * `isValidCpf` continua rejeitando-o; o gate o trata como exceção nomeada, sem
 * consulta online, sem autofill e sem limite de participações.
 */
export const FOREIGN_CPF = '11111111111'

/** `true` apenas para o código estrangeiro exato (dígitos já sanitizados). */
export function isForeignCpf(digits: string): boolean {
  return digits === FOREIGN_CPF
}
```

Racional do predicado nomeado (em vez de `=== FOREIGN_CPF` espalhado): há **três
consumidores** (`useCpfGate`, `LeadForm`, `reconciliation`) e a regra de estritude
(igualdade exata sobre dígitos sanitizados) fica num único ponto. O critério 6 sai de graça:
qualquer outra sequência repetida não é `FOREIGN_CPF` e continua caindo em
`isValidCpf === false`.

### Decisão 2 — Novo estado do gate: `foreign` (sem rede, sem autofill, sem bloqueio)

`useCpfGate.ts`:

```ts
export type CpfGateState =
  | 'idle' | 'checking' | 'new' | 'autofilled' | 'blocked' | 'new-offline'
  | 'foreign' // código de participante estrangeiro — sem consulta, sem limite (HUB-109)

const SUBMIT_ENABLED: ReadonlySet<CpfGateState> = new Set<CpfGateState>([
  'new', 'autofilled', 'new-offline', 'foreign',
])
```

Em `handleCpfChange`, a checagem do código estrangeiro entra **antes** do gatilho de
`isValidCpf` — obrigatoriamente, pois `isValidCpf(FOREIGN_CPF)` é `false` e a checagem depois
do gatilho seria código morto:

```ts
const handleCpfChange = useCallback(
  (sanitizedCpf: string) => {
    if (sanitizedCpf === lookedUpCpfRef.current) return
    lookedUpCpfRef.current = sanitizedCpf
    invalidate()
    if (isForeignCpf(sanitizedCpf)) {
      setState('foreign') // sem lookup: idêntico online/offline, sem timeout
      return
    }
    if (sanitizedCpf.length === CPF_DIGIT_COUNT && isValidCpf(sanitizedCpf)) {
      startLookup(sanitizedCpf)
    }
  },
  [invalidate, startLookup]
)
```

**Propriedades do estado `foreign`:**

- **Sem chamada de rede:** `startLookup` nunca roda — nem RPC `check_cpf_participation`, nem
  timeout de 3s. Comportamento **idêntico online e offline** (critério 2 vale nos dois modos).
- **Sem autofill:** `invalidate()` (que roda antes) já limpou selos e campos autopreenchidos;
  o formulário fica vazio para preenchimento manual (critério 1).
- **Sem bloqueio:** `blocked` só é alcançável dentro de `applyResult`, que só roda após
  lookup — inalcançável para o código. `maxParticipations` é irrelevante nesse ramo.
- **`canSubmit === true`** via `SUBMIT_ENABLED`.

**Transições (tabela completa):**

| De | Evento | Para |
|----|--------|------|
| `idle` | dígitos completam exatamente `11111111111` | `foreign` |
| `foreign` | qualquer edição do CPF (`invalidate`) | `idle` (e daí `checking` se virar CPF real válido, ou `foreign` de novo se voltar ao código) |
| `checking` (consulta in-flight) | edição para o código | `foreign` — o bump de `requestSeqRef` em `invalidate()` descarta a resposta obsoleta (mecanismo existente, sem mudança) |
| `new` / `autofilled` / `new-offline` / `blocked` | edição para o código | `foreign` (via `invalidate()` → `idle` → `foreign`, limpando autofill anterior) |
| `foreign` | `reset()` ("Próximo participante") | `idle` (sem mudança no `reset`) |

Nenhuma outra parte da máquina de estados muda.

### Decisão 3 — Semântica de `cpfCheckSkipped`: `false` para o estrangeiro

**Decisão: `cpfCheckSkipped = false`.**

Justificativa: o contrato do campo (HUB-87/HUB-92) é *"a checagem online de dedup não pôde
ser concluída"* — ou seja, **falha operacional** (timeout, offline, erro de rede), e seu único
consumidor a jusante é a reconciliação, que o usa para contar participações offline dentro de
grupos excedentes que exigem apuração humana. Para o código estrangeiro, a checagem é
**inaplicável por design** — não houve tentativa nem falha; não existe limite a reconciliar.
Gravar `true` poluiria a semântica do campo (inflaria métricas de indisponibilidade e a coluna
`offlineParticipations` de futuras consultas) e mentiria sobre o estado da rede.

Implementação: nenhuma. `invalidate()` já zera `cpfCheckSkipped` para `false` e o ramo
`foreign` não o altera. A linha persistida fica:

```
cpf = '11111111111'
cpf_check_skipped = false
max_participations_at_submit = <snapshot da config vigente, sem special-case>
```

`maxParticipationsAtSubmit` **continua o snapshot honesto** da config no submit (sem
special-case para `0`/ilimitado): a exclusão da reconciliação é explícita na função
(Decisão 4) e não depende desse valor — dado gravado permanece fiel à configuração vigente.

### Decisão 4 — AdminPanel (card "Estrangeiros") e exclusão na reconciliação

**Reconciliação** (`findParticipationOverages`, função pura): exclusão explícita na entrada
do loop, ao lado do guard de CPF nulo — o grupo do código estrangeiro nunca se forma:

```ts
for (const lead of leads) {
  if (lead.cpf === null) continue // linhas sem CPF não entram no relatório (§7)
  if (isForeignCpf(lead.cpf)) continue // código estrangeiro é sem limite (HUB-109)
  ...
}
```

Exclusão na entrada (e não filtro na saída) é defesa em profundidade: mesmo que o snapshot de
limite do grupo indicasse excedente, o grupo não existe.

**AdminPanel** — contagem **sem nenhuma chamada de rede nova**, derivada das leituras que já
acontecem:

- **Modo online:** `remoteLeads` (retorno já autorizado da RPC `admin_list_leads`) +
  pendentes locais de `getPendingLeads()` — que **já é chamado** em `computeCounts`. Contagem
  = `remote.filter(l => isForeignCpf(l.cpf ?? '')).length + pending.filter(l => isForeignCpf(l.cpf ?? '')).length`.
  Sem dupla contagem: `remoteLeads` são os sincronizados; `pending` são só os `!synced`.
- **Modo offline:** `getAllLeads()` — já chamado em `enterOffline`. Contagem sobre todos os
  leads locais do dispositivo (semântica do card "Total local").

Implementação: estado `foreignLeads: number` atualizado dentro de `computeCounts` (online) e
`enterOffline` (offline), exibido no 4º card do grid (`grid-cols-4`), rótulo "Estrangeiros".
`handleForceSync` já repassa por `computeCounts` — o card atualiza junto com os demais.

**CSV:** sem mudança — `buildLeadsCsv` já exporta a coluna `cpf` dedicada de todas as linhas,
incluindo `11111111111` (critério 4, parte já atendida). A nota LGPD do export (ADR-013) não é
afetada: o código estrangeiro é um sentinela compartilhado, não dado pessoal.

### LeadForm — dois pontos de validação a ajustar

O CPF é validado em **dois pontos independentes** do `LeadForm.tsx`; ambos precisam da
exceção (esquecer um deles deixa UX inconsistente — risco R2):

1. **`handleChange`** (erro em tempo de digitação):
   ```ts
   setCpfError(
     digits.length === CPF_DIGIT_COUNT && !isValidCpf(digits) && !isForeignCpf(digits)
       ? CPF_INVALID_MESSAGE
       : ''
   )
   ```
2. **`validate()`** (gate do submit):
   ```ts
   const cpfMessage =
     cpfDigits.length === 0
       ? `${CPF_LABEL} é obrigatório`
       : !isValidCpf(cpfDigits) && !isForeignCpf(cpfDigits)
         ? CPF_INVALID_MESSAGE
         : ''
   ```

O restante do fluxo do form é inalterado: `cpfGate.handleCpfChange(digits)` continua sendo
chamado com os dígitos sanitizados (o gate decide), o spinner só aparece em `checking`
(nunca para o código), e o `onSubmit` entrega `cpfMeta = { cpf: '11111111111',
cpfCheckSkipped: false }` pelo caminho existente — **persistência e sync não mudam**
(critério 3 é atendido pela coluna dedicada já existente, online e offline→sync).

### Contratos de API

Nenhum contrato novo e nenhuma mudança de servidor:

- RPC `check_cpf_participation` — **nunca é chamada** para o código estrangeiro (o gate
  curto-circuita antes). Contrato inalterado.
- RPC `admin_list_leads` — inalterada; as linhas do código estrangeiro já voltam no payload
  e alimentam o card e o CSV.
- `INSERT` em `leads` (online e offline-sync) — payload inalterado; apenas o valor
  `cpf='11111111111'` passa a ocorrer.

### Modelo de dados

**Migração: não.** A constraint `CHECK (cpf ~ '^[0-9]{11}$')` (HUB-89) já aceita
`11111111111`. Nenhuma coluna nova; nenhum bump de `DB_VERSION` no IndexedDB.

### Considerações de performance/segurança

- **Performance:** caminho do estrangeiro é *mais leve* que o normal (zero rede, zero
  timeout). Contagem no AdminPanel é um `filter` em memória sobre dados já carregados.
- **Segurança/antifraude:** o código estrangeiro é, por definição, um furo controlado no
  limite de participações — decisão de negócio do stakeholder (aceita na US). Qualquer pessoa
  que conheça o código joga ilimitado; a mitigação é a **visibilidade** (card de contagem +
  linhas no CSV) para a organização auditar abusos. Fica registrado: não há como distinguir
  estrangeiros reais de brasileiros usando o código — limitação aceita.
- **LGPD:** nenhum dado novo coletado; texto de consentimento inalterado (fora de escopo).
  `11111111111` não identifica pessoa (sentinela compartilhado).
- **Sorteio/apuração:** linhas com o código estrangeiro identificam múltiplas pessoas sob o
  mesmo "CPF" — a apuração humana do sorteio deve tratá-las pelos demais campos (nome/email).
  Registrar no `docs/guia-operador.md` (ver DoD).

### Plano de testes (por módulo)

**`src/lead-capture/cpf/__tests__/` — constants + validação:**
- `isForeignCpf('11111111111')` → `true`; `'00000000000'`, `'22222222222'`, CPF real válido,
  `'111111111'` (parcial) e `'111.111.111-11'` (não sanitizado) → `false`.
- **Regressão:** `isValidCpf('11111111111')` **continua `false`** (lib intocada).

**`useCpfGate` (hooks/__tests__):**
- Código estrangeiro completo → `state === 'foreign'`, `canSubmit === true`,
  `cpfCheckSkipped === false`, `autofilledFieldIds` vazio e **lookup injetado não chamado**
  (spy com `expect(lookup).not.toHaveBeenCalled()` — trava o risco R1).
- `foreign` com `maxParticipations = 1` (e qualquer valor) → nunca `blocked`.
- Editar de `foreign` para dígitos parciais → `idle`; completar CPF real válido → lookup
  dispara (`checking` → resultado).
- CPF real com consulta in-flight → editar para o código → resposta obsoleta descartada,
  estado final `foreign`.
- Estado `autofilled` → editar CPF para o código → campos autopreenchidos limpos + `foreign`.
- `reset()` a partir de `foreign` → `idle`.
- **Regressão:** suite existente do gate passa sem alteração de expectativa.

**`reconciliation` (lib/__tests__):**
- Grupo `(eventId, '11111111111')` com total ≫ limite (inclusive com `cpfCheckSkipped=true`
  em linhas legadas) → **não listado**.
- Dataset misto (código estrangeiro excedente + CPF real excedente) → só o real listado.
- **Regressão:** casos existentes (nulo, ilimitado, sem limite conhecido, excedente real).

**`LeadForm` (standalone/__tests__):**
- Digitar `111.111.111-11` → sem `CPF_INVALID_MESSAGE`, sem spinner, campos genéricos vazios;
  com consentimento + obrigatórios → ENVIAR habilita; submit entrega
  `cpfMeta = { cpf: '11111111111', cpfCheckSkipped: false }` e `formData` sem CPF.
- Submit com código + campo obrigatório vazio → erro do campo (validações normais valem).
- `000.000.000-00` e `222.222.222-22` → `CPF_INVALID_MESSAGE` e submit barrado (critério 6).
- **Regressão:** fluxo de CPF real (erro de dígito, autofill, modal de bloqueio, fallback
  offline) sem mudança.

**Persistência/sync (App.flow ou lib/__tests__):**
- Fluxo de submissão com o código → `saveLead`/`syncOnlineLead` recebem
  `cpf='11111111111'`, `cpfCheckSkipped=false`, `maxParticipationsAtSubmit=<config>` —
  pass-through verbatim, sem special-case (módulos intocados; teste de contrato).

**`AdminPanel` (standalone/__tests__):**
- Online: `remoteLeads` com K linhas estrangeiras + pendentes locais com M → card mostra K+M.
- Offline: leads locais com K linhas estrangeiras → card mostra K.
- Zero usos → card mostra `0`.
- Seção de reconciliação com dataset contendo código estrangeiro acima do limite → não
  listado na UI (integração com a função pura).
- **Regressão:** export CSV e demais cards inalterados (suite existente).

### Estimativa técnica

**3 story points — confirmada.** Mudanças pequenas e localizadas: 1 constante + predicado
(~10 linhas), gate (~8 linhas), LeadForm (2 condições), reconciliation (1 linha), AdminPanel
(card + contagem, ~20 linhas), e a maior parte do esforço em testes (6 módulos).

**Riscos técnicos:**

| # | Risco | Mitigação |
|---|-------|-----------|
| R1 | Ordem errada em `handleCpfChange` (checar `foreign` depois do gatilho `isValidCpf` = código morto — o código nunca ativaria) | Teste de gate assertando `state==='foreign'` **e** lookup não chamado |
| R2 | Esquecer um dos **dois** pontos de validação do LeadForm (`handleChange` × `validate()`) → erro fantasma na digitação ou no submit | Dois testes distintos (digitação e submit) no plano |
| R3 | Dupla contagem no card online (remoto + local sincronizado) | Contar `remote` + apenas `pending` (`!synced`); teste com lead presente nos dois estágios |
| R4 | Regressão no fluxo de CPF real (critério 7) | Suites existentes de gate/LeadForm/reconciliation rodam sem alteração de expectativa; gate completo no PR |

## Fora de Escopo

- Coleta de documento estrangeiro real (passaporte etc.) — o código é um sentinela, não
  identificação.
- Migração de banco — a constraint existente já aceita o valor.
- Mudança no texto LGPD/termos de consentimento — dados coletados são os mesmos.
- Distinguir estrangeiros reais de brasileiros usando o código (impossível por construção).
- Mascaramento do código no CSV ou tratamento especial no export (ADR-013 mantido).
- Configurabilidade do código (valor fixo `11111111111`; tornar configurável é YAGNI).

## Definition of Done

- [ ] Critérios de aceite 1–7 validados pelo QA contra esta spec
- [ ] Gate de qualidade completo verde: `eslint` + `tsc` + `vitest` — zero erros, zero
  supressões novas (`eslint-disable`/`@ts-ignore`) sem justificativa
- [ ] Evidência dos **3 checks** (lint, type-check, testes) na descrição do PR — baseline
  antes de iniciar e regressão ao finalizar
- [ ] **Nenhum comando exigiu aprovação manual de sandbox** durante o desenvolvimento
- [ ] Testes novos do plano implementados; suites existentes passam sem alteração de
  expectativa (regressão zero — critério 7)
- [ ] Code review aprovado pelo Tech Lead (checklist: camadas, `isValidCpf` intocado,
  ausência de código morto, diff legível)
- [ ] PO aprova o PR (critérios de aceite atendidos); trilha de aprovação registrada na
  issue (AUD-04)
- [ ] `docs/guia-operador.md` atualizado: como orientar o participante estrangeiro, onde ver
  a contagem no AdminPanel e nota de apuração do sorteio (linhas do código identificam
  pessoas distintas — usar demais campos)
- [ ] Issue HUB-109 atualizada no Linear (link desta spec no corpo da issue)
