# Jogo da Memória — Documentação de Onboarding

Aplicação de jogo da memória para uso em eventos, com captura de leads, persistência offline e painel administrativo. Configurável por evento via arquivo JSON, sem necessidade de alterar código.

---

## Índice

- [O que é e como funciona](#o-que-é-e-como-funciona)
- [Fluxo do usuário](#fluxo-do-usuário)
- [Guia do Operador](docs/guia-operador.md) — setup do evento, kiosk, painel admin
- [Guia do Desenvolvedor](docs/guia-desenvolvedor.md) — setup local, estrutura, testes, deploy
- [Referência de Configuração](docs/referencia-config.md) — todos os campos do config.json
- [Arquitetura](#arquitetura)
- [Integração com o Hub](#integração-com-o-hub)

---

## O que é e como funciona

O Jogo da Memória é uma aplicação **standalone** pensada para rodar em totem/tablet durante eventos. Antes de jogar, o participante preenche um formulário de lead (nome, e-mail, WhatsApp — campos configuráveis). Ao concluir o jogo, o lead é salvo localmente (IndexedDB) e sincronizado com o Supabase quando houver internet.

Todo comportamento do jogo — imagens das cartas, limite de tempo, campos do formulário, cores, logo, PIN do admin — é definido em um único arquivo: `public/config.json`. Não é necessário alterar código para configurar um novo evento.

### Tecnologias

| Camada | Tecnologia |
|--------|-----------|
| Frontend | React 19 + TypeScript |
| Build | Vite 6 |
| Estilo | Tailwind CSS v4 |
| Banco de dados | Supabase (PostgreSQL) |
| Offline | IndexedDB via `idb` |
| Testes | Vitest + jsdom |
| Deploy | Cloudflare Pages (recomendado) |
| Plugin System | vite-plugin-federation (Module Federation) |

---

## Fluxo do usuário

```
Splash Screen
    ↓ (toque em qualquer lugar)
Formulário de Lead
    ↓ (preenchimento + envio)
Jogo da Memória
    ↓ (vence ou tempo esgota)
Tela de Resultado
    ↓ (aguarda autoResetSeconds ou toque)
Splash Screen
```

**Acesso ao painel admin:** 5 toques no logo da splash screen em menos de 3 segundos → tela de PIN.

---

## Arquitetura

```
src/
├── game/                  ← Plugin Hub-ready (NUNCA importa de standalone/)
│   ├── domain/
│   │   ├── entities/      ← Card, GameSession (tipos puros)
│   │   └── use-cases/     ← StartGame, FlipCard (lógica sem framework)
│   ├── components/        ← Board, Card, Timer (UI do jogo)
│   ├── types.ts           ← Interface GameConfig (contrato do config.json)
│   └── index.tsx          ← Entry point do plugin (expõe MemoryGame)
│
└── standalone/            ← Wrapper descartável (não existe no Hub)
    ├── main.tsx           ← Orquestra as telas (AppScreen state machine)
    ├── ConfigLoader.tsx   ← Carrega e valida config.json
    ├── LeadForm.tsx       ← Formulário de captura de lead
    ├── SplashScreen.tsx   ← Tela inicial com detecção de toque secreto
    ├── ResultScreen.tsx   ← Tela de resultado pós-jogo
    ├── AdminPanel.tsx     ← PIN + dashboard + CSV export + sync
    ├── hooks/
    │   └── useLeadPersistence.ts  ← Dual-write: IndexedDB → Supabase
    └── lib/
        ├── leadsDb.ts     ← Abstração IndexedDB (fila offline)
        ├── leadsSync.ts   ← Sync de leads pendentes com Supabase
        └── supabaseClient.ts ← Cliente Supabase (anon key)
```

### Regra de dependência

`src/game/` → nunca importa de `src/standalone/`
`src/standalone/` → pode importar de `src/game/`

Isso garante que o plugin do jogo seja portável para o Hub sem refatoração.

### Persistência de leads

1. Participante preenche o formulário e clica em jogar
2. Lead salvo imediatamente no **IndexedDB** (`synced: false`) — nunca é perdido
3. Tentativa imediata de sync com **Supabase** (se online → `synced: true`)
4. Se offline, listener `window.online` sincroniza automaticamente ao reconectar
5. Admin pode forçar sync manual pelo painel

---

## Integração com o Hub

Quando o Hub estiver pronto, a integração se resume a:

1. Remover `src/standalone/` inteiro
2. O Hub Runtime importa `MemoryGame` de `remoteEntry.js` via Module Federation:
   ```js
   import MemoryGame from 'jogo-memoria/MemoryGame'
   ```
3. O Hub passa `config` e `onComplete` como props — mesma interface já implementada em `src/game/index.tsx`

Nenhuma alteração em `src/game/` é necessária.

Veja `docs/adr/ADR-003-module-federation-desde-inicio.md` e `docs/services-checklist.md` para detalhes completos.

---

## Links rápidos

| Documento | Conteúdo |
|-----------|----------|
| [Guia do Operador](docs/guia-operador.md) | Como configurar e operar o jogo em um evento |
| [Guia do Desenvolvedor](docs/guia-desenvolvedor.md) | Setup local, estrutura de código, testes, deploy |
| [Referência de Configuração](docs/referencia-config.md) | Todos os campos do `config.json` com tipos e exemplos |
| [Checklist de Serviços](docs/services-checklist.md) | Supabase, Cloudflare Pages, por-evento |
| [Spec do produto](docs/specs/jogo-memoria.md) | User stories e critérios de aceite |
| [ADRs](docs/adr/) | Decisões técnicas registradas |
