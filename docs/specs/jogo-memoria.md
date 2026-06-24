# Spec: Jogo de Memória Standalone

> Status: Aprovada | Sprint: 1 | Data: 2026-06-24
> Nota: spec criada como backfill da Sprint 1 a partir do grooming aprovado

## Contexto

O Hub de Ativações (plataforma principal) ainda não está pronto. O jogo da memória é um dos plugins previstos para o Hub, mas há urgência de disponibilizá-lo para eventos presenciais. A solução é um app standalone arquitetado como plugin Module Federation, permitindo integração futura ao Hub sem reescrita.

## User Story

Como **operador de evento**, quero configurar e executar um jogo da memória em totens e tablets, para que participantes joguem, deixem seus dados e a empresa capture leads de forma confiável mesmo sem internet estável.

## Critérios de Aceite

- [x] Formulário de lead com campos configuráveis captura dados antes do jogo
- [x] Jogo da memória com imagens configuráveis por evento, timer e grid responsivo
- [x] Leads persistidos em IndexedDB imediatamente; sincronizados com Supabase quando online
- [x] Painel admin protegido por PIN com export CSV dos leads
- [x] Tela splash com branding do evento e gesto oculto para acessar admin
- [x] Fluxo auto-reset para próximo participante após resultado
- [x] Configuração completa via `public/config.json` sem alteração de código

## Design

Não se aplica — interface funcional orientada a totem (touch, sem mouse).

Princípios de UX aplicados:
- Inputs com mínimo 56px de altura e 20px de font-size
- Sem scroll na tela principal
- Sem zoom por pinça (meta viewport configurado)
- Teclado numérico customizado no admin (não depende do teclado do SO)

## Spec Técnica

### Arquitetura envolvida

```
src/
├── game/                    ← Plugin Module Federation (Hub-ready)
│   ├── domain/
│   │   ├── entities/        ← Card, GameSession
│   │   └── use-cases/       ← StartGame (Fisher-Yates), FlipCard
│   ├── components/          ← Board, Card (flip 3D), Timer
│   └── index.tsx            ← Exposto como './MemoryGame' via Module Federation
└── standalone/              ← Casca descartável na integração ao Hub
    ├── ConfigLoader.tsx     ← fetch('/config.json') + Context
    ├── LeadForm.tsx
    ├── AdminPanel.tsx
    ├── SplashScreen.tsx
    ├── ResultScreen.tsx
    ├── lib/                 ← leadsDb (IndexedDB), leadsSync (Supabase)
    ├── hooks/               ← useLeadPersistence
    └── main.tsx             ← Orquestração de telas
```

### Contrato do plugin (integração futura ao Hub)

```typescript
// src/game/index.tsx
export interface MemoryGameProps {
  config: GameConfig
  onComplete: (score: number, timeTaken: number) => void
}
export default function MemoryGame(props: MemoryGameProps): JSX.Element
```

### Modelo de dados

**Supabase (PostgreSQL):**
```sql
CREATE TABLE leads (
  id           uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id     text        NOT NULL,
  data         jsonb       NOT NULL,
  score        integer,
  time_taken   integer,
  played_at    timestamptz DEFAULT now(),
  synced_from  text        DEFAULT 'online',
  created_at   timestamptz DEFAULT now()
);
```

**IndexedDB:**
- Database: `jogo-memoria-db` | Store: `leads-queue`
- Schema: `{ localId, eventId, data, score, timeTaken, playedAt, synced: boolean }`

### Configuração do evento (`public/config.json`)

```typescript
interface GameConfig {
  event: { id: string; name: string; logo: string; primaryColor: string; backgroundColor: string }
  game: { pairs: number; cardImages: string[]; cardBack: string; timeLimitSeconds: number; autoResetSeconds?: number }
  leadForm: { title: string; fields: Array<{ id: string; label: string; type: 'text'|'email'|'tel'; required: boolean; mask?: string }> }
  adminPin: string  // 4-6 dígitos
}
```

### Considerações de performance e segurança

- Supabase ANON key exposta no frontend — RLS garante insert-only para anon
- `adminPin` no `config.json` — arquivo estático não deve ser commitado com o PIN real do evento
- IndexedDB como buffer obrigatório — nenhum lead pode ser perdido sem internet

## Fora de Escopo

- Ranking/leaderboard entre participantes
- Som/áudio
- RFID/QR input (Hub Fase 2)
- Consentimento LGPD explícito na tela (avaliação Sprint 2)
- Backend próprio (Supabase substitui)
- Múltiplos idiomas

## Definition of Done

- [x] Critérios de aceite validados pelo QA em dispositivo real
- [x] Code review aprovado pelo Tech Lead (2 ciclos)
- [x] 14 testes unitários cobrindo domínio crítico (StartGame, FlipCard)
- [x] `npm run build` sem erros TypeScript
- [x] PR mergeado em master
- [x] Issues HUB-28 a HUB-36 marcadas Done no Linear
