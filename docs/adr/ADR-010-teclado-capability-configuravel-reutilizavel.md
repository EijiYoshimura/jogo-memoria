# ADR-010: Teclado virtual como capability configurável e reutilizável

**Data:** 2026-06-26
**Status:** Aceito

## Contexto

Correção do cliente (2026-06-25): o teclado virtual **não é exclusivo do standalone**. Na
versão final (Hub) ele é uma **opção configurável por ativação** — o operador escolhe ativar ou
não. Logo o teclado precisa nascer como **capability reutilizável da camada de lead capture**,
consumida tanto pelo standalone atual quanto pelo Hub futuro, ligada/desligada por flag de
config. Mover o `LeadForm` inteiro para a camada reutilizável agora seria maior que o MVP e
arriscaria regressão sob prazo de ≤2 semanas.

## Decisão

1. **Toggle configurável, retrocompatível, default DESLIGADO.** Em `GameConfig.leadForm`
   (`src/game/types.ts`), adições **opcionais**:
   - `virtualKeyboard?: { enabled: boolean }` — objeto (não booleano solto) para absorver opções
     futuras (`accents`, `locale`, `shortcuts`) sem novo campo de topo.
   - `fields[].keyboardLayout?: string` — override de layout por campo; ausência cai no `type`.
   - Leitura no consumidor: `config.leadForm.virtualKeyboard?.enabled ?? false`. Ausente/`false`
     ⇒ comportamento nativo atual (sem migração de config).

2. **Código novo nasce em `src/lead-capture/keyboard/`** (camada reutilizável), não preso ao
   `src/standalone/` descartável: núcleo puro + hook + componente apresentacional + registry +
   barrel `index.ts`. O Hub importa essa superfície e replica só a casca do form com o mesmo
   contrato — sem reescrever o teclado.

3. **Regra de dependência (aponta para dentro):** `game` ⊅ `lead-capture` ⊅ `standalone`.
   `src/lead-capture/` nunca importa de `src/standalone/`; o núcleo é agnóstico de `GameConfig`
   e de máscara (recebe descritores primitivos `{ type, keyboardLayout? }`, devolve `raw`; o
   consumidor aplica sua própria máscara/validação).

4. **Hook chamado incondicionalmente** (`useVirtualKeyboard(vkEnabled)`): quando desligado,
   estado inerte e setters no-op — sem violar regras de hooks e sem código morto em runtime.

## Consequências

### Positivas
- Retrocompatibilidade total: configs existentes seguem em modo nativo, sem migração.
- Opt-in explícito alinhado à decisão do cliente; o totem do evento liga via seu `config.json`.
- Capability pronta para o Hub consumir sem reescrita; núcleo puro e testável isoladamente.

### Negativas / Trade-offs
- **Dívida explícita:** o `LeadForm` permanece em `src/standalone/` por ora (apenas importa o
  teclado). Numa fase posterior, extrair um `LeadCaptureForm` reutilizável para
  `src/lead-capture/` — registrado como Issue `tech-debt` no backlog.
- Caret atua no fim da string (decisão de escopo MVP); a fronteira do núcleo puro está preparada
  para `caretIndex` futuro sem reescrita.
