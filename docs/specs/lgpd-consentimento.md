# Spec: LGPD — Consentimento Informado antes da Captura de Lead

**Versão:** 1.0  
**Data:** 2026-06-24  
**Status:** Aprovada — PO ✅ | PM ✅ | Tech Lead ✅

---

## Contexto

O jogo-memoria standalone coleta dados pessoais (nome, e-mail, telefone) de participantes de eventos. A LGPD (Lei nº 13.709/2018, Art. 7º, I) exige consentimento **livre, informado e inequívoco** antes de qualquer coleta. Sem isso, o app não pode ser usado em produção.

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

- [ ] Uma tela de consentimento é exibida **antes** do formulário de lead (entre Splash e LeadForm)
- [ ] A tela exibe: nome do evento, quem controla os dados, finalidade e prazo de retenção
- [ ] Botão "Participar e aceitar" é visível e positivo
- [ ] Botão "Jogar sem participar" é igualmente visível — sem dark pattern (sem cor acinzentada discreta, sem texto menor)
- [ ] Ao aceitar: fluxo normal → LeadForm → Jogo → Resultado
- [ ] Ao recusar: vai direto ao Jogo → Resultado — **sem** captura de nenhum dado pessoal
- [ ] O lead salvo inclui `consentedAt` (timestamp ISO 8601) e `consentVersion` (string da versão do texto)
- [ ] Se `config.lgpd` estiver ausente, a tela de consentimento usa texto padrão (não quebra o app)
- [ ] Link para Política de Privacidade exibido se `lgpd.privacyPolicyUrl` estiver preenchido
- [ ] Tela responsiva e touch-friendly (mínimo 64px nos botões)

---

## Design

### Layout da tela de consentimento

```
┌─────────────────────────────────────┐
│  [Logo do evento]                   │
│  [Nome do evento]                   │
│                                     │
│  Para participar, coletaremos:      │
│  • Nome, e-mail e WhatsApp          │
│  Finalidade: [purposeText]          │
│  Controlador: [dataController]      │
│  Retenção: [retentionMonths] meses  │
│                                     │
│  [link: Política de Privacidade]    │
│                                     │
│  ┌─────────────────────────────┐    │
│  │  Participar e aceitar  ✓    │    │  ← primaryColor, destaque
│  └─────────────────────────────┘    │
│                                     │
│  ┌─────────────────────────────┐    │
│  │  Jogar sem participar       │    │  ← mesma visibilidade
│  └─────────────────────────────┘    │
└─────────────────────────────────────┘
```

Ambos os botões devem ter a mesma altura (≥ 64px) e peso visual equivalente — LGPD proíbe dark patterns que dificultem a recusa.

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

### 2. Novo AppScreen em `src/standalone/main.tsx`

```typescript
type AppScreen = 'splash' | 'consent' | 'lead-form' | 'game' | 'result' | 'admin'
```

Fluxo atualizado:
```
splash → consent (sempre, independente de lgpd config)
consent (aceitar) → lead-form → game → result → splash
consent (recusar) → game → result → splash
```

O lead é salvo na transição `lead-form → game` (comportamento existente preservado).  
Quando usuário recusa: `handleConsentDecline()` define um flag `leadCaptureEnabled: false`, vai para `'game'` e o `handleLeadSubmit` nunca é chamado.

### 3. Novo componente `src/standalone/ConsentScreen.tsx`

Props:
```typescript
interface ConsentScreenProps {
  config: GameConfig
  onAccept: () => void
  onDecline: () => void
}
```

Monta o texto de consentimento a partir de `config.lgpd` (ou defaults).

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
- [ ] `npm test` passando (testes existentes + novos testes do ConsentScreen/fluxo)
- [ ] Code review aprovado pelo Tech Lead
- [ ] `docs/services-checklist.md` atualizado com o SQL de migração
- [ ] `public/config.json` atualizado com seção `lgpd` de exemplo
- [ ] Issue atualizada no Linear para Done
