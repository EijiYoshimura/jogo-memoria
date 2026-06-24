# Guia do Desenvolvedor

Este guia cobre tudo o que um desenvolvedor precisa para trabalhar no projeto: setup local, estrutura de código, convenções, testes e deploy.

---

## Índice

1. [Setup local](#setup-local)
2. [Scripts disponíveis](#scripts-disponíveis)
3. [Estrutura do projeto](#estrutura-do-projeto)
4. [Fluxo de telas (AppScreen)](#fluxo-de-telas-appscreen)
5. [Camada de domínio (src/game/domain/)](#camada-de-domínio-srcgamedomain)
6. [Camada de persistência](#camada-de-persistência)
7. [Configuração em runtime (config.json)](#configuração-em-runtime-configjson)
8. [Testes](#testes)
9. [Module Federation](#module-federation)
10. [Deploy](#deploy)
11. [Variáveis de ambiente](#variáveis-de-ambiente)
12. [Convenções de código](#convenções-de-código)

---

## Setup local

### Pré-requisitos

- Node.js 20+
- npm 10+
- Conta no Supabase (opcional para desenvolvimento — jogo funciona sem sync)

### Passos

```bash
# 1. Clone o repositório
git clone git@github.com:seu-org/jogo-memoria.git
cd jogo-memoria

# 2. Instale as dependências
npm install

# 3. Configure as variáveis de ambiente (crie este arquivo — ele está no .gitignore)
cp .env.example .env.local
# Edite .env.local com suas credenciais do Supabase

# 4. Inicie o servidor de desenvolvimento
npm run dev
# → http://localhost:5173
```

O arquivo `.env.example` contém as variáveis necessárias sem valores:

```
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
```

Sem essas variáveis, o jogo funciona normalmente — leads são salvos no IndexedDB local mas o sync com Supabase falha silenciosamente.

---

## Scripts disponíveis

| Script | Descrição |
|--------|-----------|
| `npm run dev` | Servidor de desenvolvimento com HMR (porta 5173) |
| `npm run build` | TypeScript check + build de produção em `dist/` |
| `npm test` | Executa a suite de testes com Vitest (modo run, não watch) |
| `npm run preview` | Serve o build de produção localmente |

---

## Estrutura do projeto

```
jogo-memoria/
├── public/
│   └── config.json          ← Configuração do evento (editada por operadores)
├── src/
│   ├── game/                ← Plugin Hub-ready (zero dependências de standalone/)
│   │   ├── domain/
│   │   │   ├── entities/
│   │   │   │   ├── Card.ts              ← CardState, Card interface
│   │   │   │   └── GameSession.ts       ← GameStatus, GameSession interface
│   │   │   └── use-cases/
│   │   │       ├── StartGame.ts         ← Fisher-Yates shuffle, gera GameSession inicial
│   │   │       ├── StartGame.test.ts    ← 6 testes unitários
│   │   │       ├── FlipCard.ts          ← Lógica de virar carta, verifica match
│   │   │       └── FlipCard.test.ts     ← 8 testes unitários
│   │   ├── components/
│   │   │   ├── Board.tsx                ← Grid responsivo de cartas
│   │   │   ├── Card.tsx                 ← Carta com animação CSS 3D flip
│   │   │   └── Timer.tsx               ← Contador regressivo MM:SS
│   │   ├── types.ts                     ← Interface GameConfig (contrato do config.json)
│   │   └── index.tsx                   ← Entry point do plugin: MemoryGame component
│   │
│   └── standalone/          ← Wrapper descartável (não existe no Hub)
│       ├── main.tsx         ← Orquestra telas via AppScreen state machine
│       ├── ConfigLoader.tsx ← Carrega + valida config.json via React Context
│       ├── SplashScreen.tsx ← Tela inicial, detecta 5 toques para admin
│       ├── LeadForm.tsx     ← Formulário dinâmico de captura de lead
│       ├── ResultScreen.tsx ← Resultado pós-jogo + auto-reset
│       ├── AdminPanel.tsx   ← PIN keypad + dashboard + CSV + sync
│       ├── hooks/
│       │   └── useLeadPersistence.ts   ← saveLead(): IndexedDB → Supabase
│       └── lib/
│           ├── leadsDb.ts              ← IndexedDB CRUD (idb)
│           ├── leadsSync.ts            ← Sync de pending leads
│           └── supabaseClient.ts       ← createClient() com anon key
│
├── docs/                    ← Documentação do projeto
├── .env.example             ← Template de variáveis de ambiente
├── .gitignore               ← Inclui .env.local, dist/, .worktrees/
├── package.json
├── tsconfig.json
├── tsconfig.app.json
├── tsconfig.node.json
└── vite.config.ts           ← Vite + Module Federation + Vitest
```

---

## Fluxo de telas (AppScreen)

`src/standalone/main.tsx` implementa uma state machine simples:

```typescript
type AppScreen = 'splash' | 'lead-form' | 'game' | 'result' | 'admin'
```

Transições:

```
splash → lead-form        (toque na tela)
splash → admin            (5 toques no logo em < 3s)
lead-form → game          (formulário enviado com sucesso → lead salvo)
game → result             (jogo vencido ou tempo esgotado)
result → splash           (autoResetSeconds esgotado ou toque)
admin → splash            (fechar painel)
```

O lead é salvo na transição `lead-form → game` (antes do jogo iniciar), não ao finalizar. Isso garante que mesmo que o participante abandone o jogo, o lead é capturado.

---

## Camada de domínio (src/game/domain/)

### Entidades

**`Card`** (`src/game/domain/entities/Card.ts`):

```typescript
type CardState = 'hidden' | 'flipped' | 'matched'

interface Card {
  id: string          // UUID único
  pairId: string      // Identifica o par (mesmo valor para as duas cartas do par)
  imageUrl: string
  state: CardState
}
```

**`GameSession`** (`src/game/domain/entities/GameSession.ts`):

```typescript
type GameStatus = 'idle' | 'playing' | 'won' | 'lost'

interface GameSession {
  id: string          // crypto.randomUUID()
  cards: Card[]
  flippedCards: Card[]
  matchedPairs: number
  totalPairs: number
  status: GameStatus
  startedAt: number   // Date.now()
  timeTaken: number   // segundos
}
```

### Use Cases

**`StartGame`** (`src/game/domain/use-cases/StartGame.ts`):
- Recebe `config: GameConfig`
- Duplica as imagens (cria pares), atribui `pairId` e `id` únicos
- Embaralha com Fisher-Yates
- Retorna `GameSession` com `status: 'idle'`

**`FlipCard`** (`src/game/domain/use-cases/FlipCard.ts`):
- Recebe `session: GameSession` e `cardId: string`
- Bloqueia: 2 cartas já viradas sem match, carta já matched, double-click
- Verifica match por `pairId`
- Retorna nova `GameSession` imutável

---

## Camada de persistência

### IndexedDB (`src/standalone/lib/leadsDb.ts`)

Banco: `jogo-memoria-db` | Store: `leads-queue`

```typescript
interface LocalLead {
  localId?: number           // auto-increment (chave primária)
  eventId: string
  data: Record<string, string>  // campos do formulário
  score: number
  timeTaken: number
  playedAt: string           // ISO 8601
  synced: boolean
}

// Funções disponíveis
saveLead(lead): Promise<number>           // retorna localId
getPendingLeads(): Promise<LocalLead[]>   // synced = false
getAllLeads(): Promise<LocalLead[]>
markSynced(localId): Promise<void>
```

### Supabase (`src/standalone/lib/leadsSync.ts`)

Schema da tabela `leads`:

```sql
CREATE TABLE leads (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id text NOT NULL,
  data jsonb NOT NULL,          -- campos do formulário
  score integer,
  time_taken integer,           -- segundos
  played_at timestamptz DEFAULT now(),
  synced_from text DEFAULT 'online',  -- 'online' | 'offline-sync'
  created_at timestamptz DEFAULT now()
);
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon insert only" ON leads FOR INSERT TO anon WITH CHECK (true);
```

### Hook de persistência (`src/standalone/hooks/useLeadPersistence.ts`)

```typescript
const { saveLead } = useLeadPersistence()

// Salva no IndexedDB primeiro, depois tenta Supabase
await saveLead({ eventId, formData, score, timeTaken })
```

O hook também registra `window.addEventListener('online', syncPendingLeads)` para sync automático ao reconectar.

---

## Configuração em runtime (config.json)

`src/standalone/ConfigLoader.tsx` carrega `/config.json` na inicialização e o disponibiliza via React Context. Se o arquivo estiver ausente ou malformado, a aplicação exibe uma tela de erro bloqueante.

`src/standalone/main.tsx` e todos os componentes acessam a configuração via:

```typescript
import { useConfig } from './ConfigLoader'
const config = useConfig()
```

O componente `MemoryGame` em `src/game/index.tsx` recebe a configuração como prop:

```typescript
<MemoryGame config={config} onComplete={(score, timeTaken) => { /* ... */ }} />
```

Ver [Referência de Configuração](referencia-config.md) para todos os campos.

---

## Testes

A suite usa **Vitest** com ambiente jsdom. Cobertura atual: use-cases de domínio.

```bash
npm test
```

### Estrutura dos testes

Os arquivos `.test.ts` ficam ao lado do arquivo testado:

```
src/game/domain/use-cases/
├── StartGame.ts
├── StartGame.test.ts    ← 6 testes
├── FlipCard.ts
└── FlipCard.test.ts     ← 8 testes
```

### O que é testado

**StartGame (6 testes):**
- Cria a quantidade correta de cartas (pairs × 2)
- Cada par tem exatamente 2 cartas com o mesmo `pairId`
- Todas as cartas iniciam com `state: 'hidden'`
- Cards têm IDs únicos
- `status` inicial é `'idle'`
- Embaralhamento altera a ordem (Fisher-Yates)

**FlipCard (8 testes):**
- Vira uma carta oculta corretamente
- Não vira carta já matched
- Não vira terceira carta quando 2 estão viradas sem match
- Não vira a mesma carta duas vezes (double-click)
- Detecta match por pairId
- Atualiza `matchedPairs` ao encontrar par
- Muda `status` para `'won'` ao completar todos os pares
- Reverte cartas sem match após tentativa (via `resetFlipped`)

### Adicionando testes

Ao implementar nova lógica de domínio:

1. Crie o arquivo `*.test.ts` ao lado do arquivo testado
2. Use `describe` + `it` com nomes descritivos em português
3. Use o padrão arrange-act-assert sem comentários óbvios
4. Rode `npm test` e confirme que novos e existentes passam

---

## Module Federation

`vite.config.ts` expõe o plugin do jogo:

```typescript
federation({
  name: 'jogo-memoria',
  filename: 'remoteEntry.js',
  exposes: {
    './MemoryGame': './src/game/index.tsx'
  },
  shared: ['react', 'react-dom']
})
```

O arquivo `dist/remoteEntry.js` é o ponto de entrada para o Hub. O Hub carrega o plugin assim:

```typescript
// No vite.config.ts do Hub
remotes: {
  'jogo-memoria': 'https://jogo-memoria.pages.dev/remoteEntry.js'
}

// No código do Hub
const MemoryGame = React.lazy(() => import('jogo-memoria/MemoryGame'))
```

O build usa `target: 'esnext'` e `minify: false` para compatibilidade com Module Federation.

---

## Deploy

### Cloudflare Pages (recomendado)

O deploy é automático via Git. Cada push para `master` dispara um novo deploy.

Build settings no Cloudflare Pages:
- **Framework preset:** None
- **Build command:** `npm run build`
- **Build output directory:** `dist`
- **Root directory:** `/` (raiz do repo)
- **Environment variables:** `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`

### Por-evento

Para cada evento, o fluxo é:

1. Editar `public/config.json` com os dados do evento
2. `git add public/config.json && git commit -m "config: setup evento X"`
3. `git push` → Cloudflare Pages re-deploya automaticamente

Se múltiplos eventos precisarem rodar em paralelo (URLs diferentes), use branches separadas ou forks.

---

## Variáveis de ambiente

| Variável | Obrigatória | Descrição |
|----------|-------------|-----------|
| `VITE_SUPABASE_URL` | Para sync | URL do projeto Supabase (ex: `https://abc.supabase.co`) |
| `VITE_SUPABASE_ANON_KEY` | Para sync | Chave pública anon do Supabase |

Todas as variáveis com prefixo `VITE_` são injetadas no bundle pelo Vite em build time e ficam visíveis no JavaScript do cliente — use **somente** a `anon` key, nunca a `service_role`.

---

## Convenções de código

- **TypeScript strict** — sem `any`, tipos explícitos em interfaces públicas
- **Componentes** com mais de 100 linhas devem ser quebrados
- **Sem lógica de negócio** em componentes — use cases ficam em `domain/use-cases/`
- **Sem `console.log`** de debug no código commitado
- **Sem código morto** — remova imports e variáveis não usados
- **Sem magic numbers** — use constantes nomeadas
- `src/game/` nunca importa de `src/standalone/` — violação bloqueia o PR
- Todo PR deve incluir evidência de `npm test` passando na descrição
