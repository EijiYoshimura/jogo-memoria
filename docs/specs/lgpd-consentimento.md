# Spec: LGPD — Consentimento Informado antes da Captura de Lead

**Versão:** 1.1
**Data:** 2026-06-24 (revisão em 2026-07-02)
**Status:** Aprovada — PO ✅ | PM ✅ | Tech Lead ✅

### Changelog

- **v1.1 (2026-07-02, PO):** revisão obrigatória e bloqueante identificada pelo Tech Lead na spec técnica
  de `docs/specs/HUB-87-cpf-antifraude.md` (seção "Nota de dependência"), antes do início do desenvolvimento
  de HUB-87. Duas correções:
  1. **Finalidade do tratamento passa a citar CPF e "controle de participações e elegibilidade a sorteio"**
     — LGPD Art. 9º exige informar a finalidade específica antes da coleta; a partir de HUB-87 o `LeadForm`
     também coleta CPF para impedir que o mesmo participante jogue além do limite configurado por evento.
     Ver Critérios de Aceite e Design atualizados abaixo.
  2. **Seção "Jogar sem participar" corrigida** — a v1.0 descrevia uma tela `ConsentScreen` separada com
     dois botões ("Participar e aceitar" / "Jogar sem participar") e um fluxo `consent (recusar) → game`
     sem captura de dados. **Isso não existe no código** desde HUB-67 (2026-06-29): o consentimento hoje é
     um checkbox embutido no próprio `LeadForm` (`src/standalone/LeadForm.tsx`) que bloqueia o botão ENVIAR
     se não marcado — não existe nenhum caminho de jogar sem consentimento/sem dados. Confirmado contra o
     código real (`LeadForm.tsx`, `App.tsx`) nesta revisão.

---

## Contexto

O jogo-memoria standalone coleta dados pessoais (nome, e-mail, telefone) de participantes de eventos. A LGPD (Lei nº 13.709/2018, Art. 7º, I) exige consentimento **livre, informado e inequívoco** antes de qualquer coleta. Sem isso, o app não pode ser usado em produção.

A partir de HUB-87 (controle de CPF antifraude), o formulário passa a coletar também **CPF**, com uma
finalidade adicional específica: controle de participações e elegibilidade a sorteio/prêmio vinculado à
ativação. Essa finalidade precisa estar refletida no texto de consentimento **antes** da coleta (Art. 9º) —
ver Critérios de Aceite e Design.

Referência de conformidade: `/hub/docs/lgpd/conformidade.md`

---

## User Story

**Como** participante de um evento,  
**quero** ser informado sobre quais dados serão coletados e para qual finalidade **antes** de fornecê-los,  
**para que** eu possa decidir conscientemente se quero ou não participar da captura de leads.

**Como** operador do evento,  
**quero** que todos os leads coletados tenham consentimento registrado,  
**para que** o evento esteja em conformidade com a LGPD.

---

## Critérios de Aceite

> **Nota (revisão v1.1):** os itens abaixo refletem o fluxo real implementado em HUB-67 (checkbox embutido
> no `LeadForm`), não a tela `ConsentScreen` separada descrita na v1.0 original. Ver Changelog no topo.

- [ ] O consentimento é obrigatório e embutido no próprio `LeadForm` (checkbox) — não existe uma tela de
      consentimento separada entre Splash e LeadForm
- [ ] O texto de consentimento (via link do checkbox, aberto no `TermsModal`) informa: quem controla os
      dados, a finalidade do tratamento e o prazo de retenção
- [ ] A finalidade declarada cobre **todos** os dados efetivamente coletados no `LeadForm`; a partir de
      HUB-87 isso inclui explicitamente **CPF** e a finalidade de **controle de participações e
      elegibilidade a sorteio/prêmio vinculado à ativação** (LGPD Art. 9º — finalidade específica informada
      antes da coleta)
- [ ] O botão ENVIAR permanece `disabled` enquanto o checkbox de consentimento não estiver marcado
      (gating em dupla camada e independente da validação dos demais campos obrigatórios)
- [ ] Não existe nenhum caminho para jogar sem consentimento e sem captura de dados — consentir é condição
      obrigatória para o envio do formulário e avanço ao jogo
- [ ] O lead salvo inclui `consentedAt` (timestamp ISO 8601) e `consentVersion` (string da versão do texto)
- [ ] Se `config.lgpd` estiver ausente, o texto de consentimento usa valores padrão (não quebra o app)
- [ ] Link para Política de Privacidade exibido se `lgpd.privacyPolicyUrl` (ou `privacyPolicyPath`) estiver
      preenchido
- [ ] Checkbox e área de toque responsivos e touch-friendly (mínimo 44px de altura do controle)

---

## Design

### Fluxo real (desde HUB-67, 2026-06-29)

O consentimento **não é uma tela separada**. É um checkbox embutido no próprio `LeadForm`
(`src/standalone/LeadForm.tsx`), exibido logo após os campos do formulário e antes do botão ENVIAR:

```
┌─────────────────────────────────────┐
│  [Logo do evento]                   │
│                                     │
│  Nome: [_______________]            │
│  E-mail: [_______________]          │
│  WhatsApp: [_______________]        │
│  (a partir de HUB-87: CPF: [_____]) │
│                                     │
│  ☐ Li e aceito os termos de         │
│     consentimento e a Política      │
│     de Privacidade.  [link → modal] │
│                                     │
│  ┌─────────────────────────────┐    │
│  │          ENVIAR             │    │  ← disabled={!accepted},
│  └─────────────────────────────┘    │     gate independente da
│                                     │     validação dos campos
└─────────────────────────────────────┘
```

O link dentro do texto do checkbox abre o `TermsModal` (`src/standalone/TermsModal.tsx`), que exibe o texto
completo dos termos (`buildConsentText`) e a finalidade do tratamento (`getPurposeText`) — incluindo, a
partir de HUB-87, a menção a CPF e controle de participações/elegibilidade a sorteio — além do link para a
Política de Privacidade quando configurado.

**Não existe** botão "Jogar sem participar" nem qualquer caminho para jogar sem consentimento — o gate de
consentimento é uma condição de bloqueio do próprio botão ENVIAR (`disabled={!accepted}`), na mesma camada
de validação independente dos demais campos obrigatórios (`handleSubmit` só chama `onSubmit` quando
`fieldsOk && consentOk`). LGPD proíbe dark patterns que dificultem a recusa — como não há caminho de
recusa (o jogo em si depende do lead), o requisito equivalente aqui é: o checkbox não pode vir pré-marcado,
o texto dos termos deve estar acessível sem custo de fricção adicional (link sempre visível, sem exigir
scroll ou navegação extra) e a mensagem de erro de consentimento (`CONSENT_REQUIRED_MESSAGE`) deve ser
clara quando o operador tentar enviar sem marcar.

---

## Spec Técnica

### 1. Novo campo em `GameConfig` (`src/game/types.ts`)

```typescript
export interface GameConfig {
  // ... campos existentes ...
  lgpd?: {
    consentVersion: string       // ex: "1.0"
    dataController: string       // ex: "Tech Summit Ltda"
    purposeText: string          // ex: "para receber novidades e promoções"
    retentionMonths: number      // ex: 12
    privacyPolicyUrl?: string    // ex: "https://empresa.com/privacidade"
  }
}
```

`lgpd` é opcional: se ausente, a tela usa valores padrão genéricos e `consentVersion: 'default'`.

> **Nota (revisão v1.1, 2026-07-02):** o formato do campo `lgpd` não mudou. O que muda é o **conteúdo**:
> quem configura o evento (`purposeText` ou `consentText` custom em `public/config.json`) precisa incluir
> CPF e "controle de participações e elegibilidade a sorteio" na finalidade sempre que
> `leadForm.maxParticipations` estiver em uso (HUB-87). Isso é responsabilidade de configuração por evento,
> não de código — mas o texto padrão/exemplo (`DEFAULT_PURPOSE_TEXT` em `src/standalone/lib/lgpd.ts` e o
> exemplo em `public/config.json`) deve ser revisado como parte da entrega de HUB-87.5 para refletir esse
> caso comum.

### 2. ~~Novo AppScreen em `src/standalone/main.tsx`~~ — superado por HUB-67

> **Nota (revisão v1.1, 2026-07-02):** esta seção descrevia o plano original (v1.0) de uma tela `consent`
> separada. A implementação entregue em HUB-67 (2026-06-29) tomou um caminho diferente e mais simples —
> **nenhum novo `AppScreen` foi introduzido**. Ver "2 (revisado)" abaixo para o comportamento real,
> confirmado contra o código em `src/standalone/App.tsx` nesta revisão.

### 2 (revisado). Consentimento embutido no `LeadForm` — implementação real (HUB-67)

`AppScreen` em `src/standalone/App.tsx` **não ganhou** o valor `'consent'` — permanece:

```typescript
type AppScreen = 'splash' | 'lead-form' | 'game' | 'result' | 'admin'
```

Fluxo real:
```
splash → lead-form → game → result → splash
```

Não há trajeto de "recusar e jogar sem dados". O consentimento é obrigatório: o checkbox no `LeadForm`
controla o estado local `accepted` (`useState<boolean>`); `handleSubmit` faz gating em dupla camada e
independente — validação dos campos (`validate()`) **e** `accepted` — e só chama `onSubmit(values)` quando
ambos são verdadeiros. O botão ENVIAR também fica `disabled={!accepted}` (bloqueio visual adicional,
redundante ao gating do submit). `App.handleLeadSubmit` só é alcançável a partir desse `onSubmit` — não há
nenhum outro caminho para a tela `'game'` a partir de `'lead-form'`.

### 3. ~~Novo componente `src/standalone/ConsentScreen.tsx`~~ — não existe

> **Nota (revisão v1.1, 2026-07-02):** o componente `ConsentScreen.tsx` descrito abaixo nunca foi criado
> dessa forma — foi substituído pela abordagem de checkbox embutido (seção 2 revisada acima). Os arquivos
> reais que compõem o fluxo de consentimento hoje são:
> - `src/standalone/LeadForm.tsx` — checkbox de consentimento + gating do submit
> - `src/standalone/TermsModal.tsx` — modal com o texto completo dos termos e a finalidade, aberto a
>   partir do link dentro do checkbox
> - `src/standalone/lib/lgpd.ts` — `buildConsentText`/`getPurposeText`, fonte única de verdade do texto
>   (esta parte da spec técnica original permanece correta — só a camada de apresentação mudou)

### 4. Atualização de `LocalLead` (`src/standalone/lib/leadsDb.ts`)

```typescript
export interface LocalLead {
  // ... campos existentes ...
  consentedAt: string      // ISO 8601 — timestamp do aceite
  consentVersion: string   // versão do texto exibido
}
```

### 5. Atualização do schema Supabase

Nova migração SQL a executar no projeto Supabase existente:

```sql
ALTER TABLE leads
  ADD COLUMN consented_at  timestamptz,
  ADD COLUMN consent_version text;
```

Coluna nullable (compatível com leads existentes que não tinham consentimento explícito).

### 6. Atualização de `leadsSync.ts`

Incluir os novos campos no INSERT para o Supabase:

```typescript
{
  // ... campos existentes ...
  consented_at:    lead.consentedAt,
  consent_version: lead.consentVersion,
}
```

### 7. Atualização de `config.json`

Adicionar seção `lgpd` ao `public/config.json` de exemplo.

---

## Fora de Escopo

- `ip_hash` e `user_agent_hash` (sem backend disponível no standalone)
- Tabela separada `consent_logs` (fica para integração com Hub Runtime)
- Interface self-service de exercício de direitos LGPD (Fase 2)
- DPA entre Hub e agência (responsabilidade jurídica, não técnica)

---

## Definition of Done

- [ ] Critérios de aceite validados pelo QA
- [ ] `npm test` passando (testes existentes + novos testes do `LeadForm`/checkbox de consentimento e do
      `TermsModal`)
- [ ] Code review aprovado pelo Tech Lead
- [ ] `docs/services-checklist.md` atualizado com o SQL de migração
- [ ] `public/config.json` atualizado com seção `lgpd` de exemplo
- [ ] Issue atualizada no Linear para Done

**Revisão v1.1 (2026-07-02):** itens acima descrevem o DoD original (v1.0), já cumprido — HUB-67 entregou o
fluxo real de consentimento (checkbox embutido). Esta revisão em si (finalidade citando CPF/controle de
participações + correção da seção obsoleta "Jogar sem participar") não reabre o DoD original; é
pré-requisito documental da spec técnica de HUB-87 (`docs/specs/HUB-87-cpf-antifraude.md`, seção "Nota de
dependência" e item correspondente no DoD daquela spec).
