# Spec de Design: HUB-87 — Controle de CPF antifraude no formulário de lead

- **Issue:** [HUB-87](https://linear.app/hub-de-ativacoes/issue/HUB-87)
- **Fase:** Design (UX/UI)
- **Autor:** Product Designer
- **Data:** 2026-07-02
- **Componente(s) alvo:** `/home/eiji/work/jogo-memoria/src/standalone/LeadForm.tsx` (novo campo CPF + estados de consulta/autopreenchimento), novo componente `LeadLimitModal` (nome sugerido — decisão de estrutura final é do Tech Lead), avaliação opcional de um indicador de conectividade.
- **Specs relacionadas:** `HUB-65-form-layout.md` (layout base do form), `HUB-67-consent-in-form.md` (padrão de modal/gating/`aria-live` já em produção), `HUB-57-teclado-virtual.md`/`keyboardLayouts.ts` (teclado numérico já existe e é reaproveitado), `lgpd-consentimento.md` (**dependência bloqueante** — precisa ser atualizada para cobrir a coleta de CPF antes do merge, conforme nota da issue; fora do escopo desta spec de design).
- **Fora de escopo desta spec** (conforme a issue): schema de armazenamento do CPF, endpoint/estratégia de consulta e cache, quebra em sub-issues — cabe à spec técnica do Tech Lead. Não há mudança de copy jurídica de LGPD aqui.

> MVP para evento com fila de pessoas. Nenhuma decisão abaixo introduz paleta, tipografia ou padrão novo fora do já estabelecido em `#0333BD` / `#FCFC30` / branco / `#FFC7C7` (erro) — reaproveita o máximo possível do que já existe em `LeadForm.tsx`, `TermsModal.tsx` e `ResultScreen.tsx`.

---

## 1. Leitura do estado atual (o que já existe e será reaproveitado)

Verifiquei o código antes de desenhar, para não reinventar o que já está em produção:

| O que precisava | O que já existe | Reaproveito como |
|---|---|---|
| Input de texto com máscara, estados normal/ativo/erro | `LeadForm.tsx` — inputs `min-h-[56px]`, `text-20px`, borda por accent/`ACTIVE_BORDER_COLOR #0333BD`/`ERROR_BORDER_COLOR #EF4444`, `ERROR_RING_SHADOW`/`ACTIVE_RING_SHADOW` | Campo CPF usa exatamente o mesmo componente visual de input, sem criar um novo estilo |
| Máscara de dígitos progressiva | `phoneMask.ts` (`applyPhoneMask`, `maskedToRawIndex`/`rawToMaskedIndex`) | Mesmo padrão de função pura para a máscara `000.000.000-00` (nome sugerido `applyCpfMask`, a cargo do Tech Lead) |
| Teclado numérico (dialpad) | `keyboardLayouts.ts` → layout `numeric` já existe (3 colunas, `align: 'center'`), e `FieldDescriptor.keyboardLayout` já permite **override explícito** por campo | CPF usa `keyboardLayout: 'numeric'` — **nenhum teclado novo é necessário** |
| Modal acessível (`role="dialog"`, foco, `Esc`) | `TermsModal.tsx` — focus-trap, `aria-modal`, scroll-lock, card branco `rounded-[1.5rem]` | Modal de limite reaproveita a mesma estrutura de acessibilidade, com um card mais simples (ver §5) |
| Botão "Próximo participante" | `ResultScreen.tsx` já usa exatamente esse texto e este estilo: `rounded-full border-4 border-white font-bb-titulos font-extrabold uppercase text-2xl min-h-[56px] px-10 active:opacity-80`, fundo accent, texto `#0333BD` | **Reaproveito literalmente o mesmo botão** — consistência total com o padrão que o app já usa para "encerrar e liberar o totem para o próximo" |
| Mensagem de erro com `aria-live="polite"` | `consentError` no `LeadForm` (`aria-live="polite"` + `aria-describedby`) e `PreviewBanner` (`role="status"` + `aria-live="polite"` com anúncio em `sr-only`) | Mesmo padrão para o status do CPF (verificando/encontrado/inválido) e para o anúncio do modal de bloqueio |
| Indicador visual de online/offline | **Não existe.** Busquei em `SplashScreen`, `AdminPanel`, `ConfigLoader` e nos hooks de persistência (`useLeadPersistence`, `leadsSync.ts`) — o único rastro de "online"/"offline" é o campo de dado `synced_from` gravado no Supabase e exibido como texto puro numa coluna de tabela do `AdminPanel`, não é um indicador de UI. | Não há padrão para reaproveitar. Ver decisão em §7 — não crio um indicador novo por padrão; deixo como recomendação opcional sujeita a validação do PO. |

---

## 2. Fluxo do Usuário

O CPF passa a ser o **primeiro campo**, antes de Nome/E-mail/Telefone. Ele dispara uma consulta automática assim que os 11 dígitos formam um CPF com dígito verificador válido — sem exigir nenhum toque adicional do operador (nem botão "buscar").

```
┌─────────────────────────────────────────────────────────────────┐
│ Participante chega ao LeadForm                                   │
│ CPF é o 1º campo, vazio, borda accent (padrão)                   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
              Operador digita os dígitos do CPF
              (teclado numérico, máscara 000.000.000-00
               aplicada progressivamente — igual ao telefone)
                              │
                 ┌────────────┴─────────────┐
                 │ 11 dígitos completos?     │
                 └────────────┬─────────────┘
                       não ───┘   sim
                        │          │
                 (segue digitando   ▼
                  sem validar        Valida dígito verificador
                  ainda — Decisão    localmente (instantâneo, sem rede)
                  de design #1)            │
                                ┌───────────┴────────────┐
                          inválido                     válido
                                │                         │
                                ▼                         ▼
                    Estado ERRO ESPECÍFICO      Dispara consulta automática
                    "CPF inválido..."           (Estado VERIFICANDO)
                    (Cenário 1) — não             │
                    dispara consulta        timeout de negócio: 3s
                                                    │
                       ┌────────────────────────────┼───────────────────────────┐
                       │                             │                            │
                  responde a tempo             responde a tempo            NÃO responde a tempo
                  → CPF não encontrado         → CPF encontrado            OU falha de rede
                  (Cenário 2)                  │                            (Cenário 6)
                       │                  ┌─────┴──────┐                          │
                       ▼                  │            │                          ▼
              Campos seguintes      participações   participações        Trata como CPF novo:
              seguem vazios,        < limite         ≥ limite (≠0)        libera o formulário
              digitação normal      (Cenário 3)      (Cenário 4)          normalmente (idêntico
                                          │                │               ao Cenário 2), sem
                                          ▼                ▼               alertar o participante;
                              Estado AUTOPREENCHIDO   Estado BLOQUEADO      operador tem, no máximo,
                              Nome/E-mail/Telefone    → abre MODAL DE       um indicador discreto
                              preenchidos com          LIMITE ATINGIDO      opcional (ver §7)
                              indicação visual de      (único botão:
                              "vieram do cadastro",    "Próximo
                              seguem EDITÁVEIS          participante")
                              (Decisão #4)                    │
                                          │                    ▼
                                          ▼            Toque em "Próximo
                              Fluxo normal do form      participante" →
                              (consentimento + ENVIAR)  formulário reseta
                                                         vazio (Decisão #7)
```

Se o limite do evento estiver configurado como `0` (ilimitado — Cenário 5), o ramo "participações ≥ limite" nunca é avaliado como verdadeiro — o modal nunca aparece para esse evento. Isso é comportamento, não um estado visual adicional.

### 2.1 O que NÃO acontece (para não introduzir ambiguidade)

- A consulta **não** bloqueia a digitação de Nome/E-mail/Telefone. O operador pode preencher os outros campos enquanto o CPF ainda está "verificando", ou voltar e corrigir o CPF a qualquer momento.
- Corrigir o CPF **depois** de um autopreenchimento invalida o autopreenchimento (ver Decisão #5) — nunca fica um Nome/E-mail/Telefone "órfão" de um CPF diferente do que está no campo.
- Não existe estado de erro "genérico de rede" visível ao participante — o Cenário 6 é transparente por design (mesma UX do Cenário 2, CPF novo). O único sinal, opcional, é para o operador (§7), nunca alarmante.

---

## 3. Telas / Wireframes textuais dos novos estados

### 3.1 Campo CPF — todos os estados (mesma família visual dos campos existentes)

```
Padrão (vazio)                    Ativo (digitando, incompleto)
┌─────────────────────────────┐   ┌─────────────────────────────┐
│ CPF *                        │   │ CPF *                        │
│┌─────────────────────────────┐│  │┌─────────────────────────────┐│
││                              ││  ││ 123.456.7__|                ││ ← borda azul
│└─────────────────────────────┘│  │└─────────────────────────────┘│   ACTIVE_BORDER_COLOR
│ borda accent (#FCFC30)        │   │ sem erro ainda — dígitos      │
└─────────────────────────────┘   │ incompletos não validam        │
                                    └─────────────────────────────┘

Erro — dígito verificador inválido        Verificando (loading discreto)
┌─────────────────────────────┐           ┌─────────────────────────────┐
│ CPF *                        │           │ CPF *                        │
│┌─────────────────────────────┐│          │┌─────────────────────────────┐│
││ 111.111.111-11              ●││ ← borda  ││ 123.456.789-09           ⟳ ││ ← spinner discreto,
│└─────────────────────────────┘│   erro    │└─────────────────────────────┘│   borda ativa mantida
│ ⚠ CPF inválido. Confira os    │  (#EF4444)│ (sem texto visível — feedback │
│   números digitados.          │           │  sonoro via aria-live, ver §6)│
└─────────────────────────────┘           └─────────────────────────────┘

Resolvido — CPF novo (silencioso)         Resolvido — CPF já cadastrado
┌─────────────────────────────┐           ┌─────────────────────────────┐
│ CPF *                        │           │ CPF *                        │
│┌─────────────────────────────┐│          │┌─────────────────────────────┐│
││ 123.456.789-09              ││          ││ 987.654.321-00              ││
│└─────────────────────────────┘│          │└─────────────────────────────┘│
│ volta à borda accent normal,  │          │ volta à borda accent normal,  │
│ demais campos seguem vazios   │          │ demais campos AUTOPREENCHIDOS │
└─────────────────────────────┘           │ (ver §3.2)                     │
                                            └─────────────────────────────┘
```

Nota de conteúdo (mensagens): a mensagem de campo obrigatório vazio continua seguindo o padrão genérico já existente em `validate()` (`"${label} é obrigatório"` → **"CPF é obrigatório"**). A mensagem de dígito verificador inválido é **um texto diferente e específico** — **"CPF inválido. Confira os números digitados."** — exatamente para que o Cenário 1 não seja confundido com campo vazio, como pedido no requisito 1. Ambas usam o mesmo estilo visual (`text-[#FFC7C7]`, mesma posição abaixo do campo) — a diferenciação é pelo **texto**, não por uma segunda linguagem visual nova (evita criar um terceiro estado de cor sem necessidade real — YAGNI).

### 3.2 Formulário completo com autopreenchimento

```
┌───────────────────────────────────────────┐
│                 [logo BB]                   │
│                                              │
│  CPF *                                      │
│ ┌──────────────────────────────────────────┐│
│ │ 987.654.321-00                            ││
│ └──────────────────────────────────────────┘│
│                                              │
│  NOME COMPLETO *      ⟨ Preenchido           │  ← selo discreto por campo
│                          automaticamente ⟩   │     (aparece só nos campos
│ ┌──────────────────────────────────────────┐│     que vieram do cadastro)
│ │┃Maria da Silva                            ││  ← borda esquerda accent 4px
│ └──────────────────────────────────────────┘│     (mesmo accent, sem nova cor)
│                                              │
│  E-MAIL                ⟨ Preenchido          │
│                          automaticamente ⟩   │
│ ┌──────────────────────────────────────────┐│
│ │┃maria@email.com                           ││
│ └──────────────────────────────────────────┘│
│                                              │
│  TELEFONE              ⟨ Preenchido          │
│                          automaticamente ⟩   │
│ ┌──────────────────────────────────────────┐│
│ │┃(61) 99999-9999                           ││
│ └──────────────────────────────────────────┘│
│                                              │
│  ☐ Li e aceito os termos...                  │
│                                              │
│              [ ENVIAR ]                      │
└───────────────────────────────────────────┘
```

- O selo **"Preenchido automaticamente"** é um chip pequeno (`text-xs`, `text-white/70` ou accent translúcido, sem novo fundo sólido — mantém a superfície azul limpa), posicionado à direita do label do campo, alinhado à mesma linha (`flex justify-between` no bloco label). Em telas estreitas onde não couber ao lado, quebra para uma segunda linha abaixo do label — nunca sobrepõe o campo.
- A borda esquerda accent de 4px (`border-l-4 border-l-[#FCFC30]`) dentro do input é o reforço visual redundante ao selo — comunica "isto não foi você que digitou" sem depender só de texto pequeno (ajuda quem não lê o chip rapidamente na fila).
- **Os campos autopreenchidos permanecem 100% editáveis** (Decisão #4) — não há `readOnly`/bloqueio. Assim que o operador edita manualmente um desses campos, o selo e a borda accent daquele campo (e só daquele) desaparecem — o campo passa a se comportar como digitado normalmente. Mesmo padrão de "o que muda no `onChange` limpa o estado anterior" que o form já usa para limpar erros (`handleChange` limpa `errors[fieldId]`).
- Nenhum estado de "sucesso" com verde é introduzido — o app não tem esse token hoje (ver HUB-57-design.md, Estados do campo: "sem estilo dedicado no MVP"); manter a mesma decisão aqui evita inflar a paleta.

### 3.3 Modal de limite atingido (Cenário 4)

Reaproveita a estrutura de acessibilidade do `TermsModal` (backdrop, card branco, foco), mas com um conteúdo propositalmente mais simples/curto — só há uma ação possível, então não há cabeçalho com X nem rodapé separado.

```
              ┌───────────────────────────────┐
              │                                │
              │            ┏━━━━━┓             │
              │            ┃  ✓  ┃             │  ← círculo accent #FCFC30,
              │            ┗━━━━━┛             │     check azul #0333BD
              │                                │     (mesmo motivo visual do
              │                                │      checkbox marcado do form —
              │   Você já participou!          │      reforça "tudo certo", não
              │                                │      "erro"/"proibido")
              │   Este CPF já atingiu o        │
              │   número máximo de              │
              │   participações deste evento.   │
              │   Obrigado por participar!      │
              │                                │
              │  ┌──────────────────────────┐  │
              │  │   PRÓXIMO PARTICIPANTE    │  │  ← único botão, mesmo
              │  └──────────────────────────┘  │     estilo do ResultScreen
              │                                │
              └───────────────────────────────┘
                    (overlay escurecido por trás,
                     bloqueia toque no form)
```

**Conteúdo (copy sugerida, sujeita à aprovação do PO — conteúdo é decisão de produto):**
- Título: **"Você já participou!"**
- Corpo: **"Este CPF já atingiu o número máximo de participações deste evento. Obrigado por participar!"**
- Botão único: **"PRÓXIMO PARTICIPANTE"** (texto e estilo idênticos ao `ResultScreen`, ver §1)

Por que este tom: título e ícone comunicam conclusão positiva ("você já esteve aqui, deu certo"), não bloqueio punitivo. Não há linguagem de "negado", "erro", "não autorizado" nem vermelho de erro — o card usa a mesma paleta branca/accent/azul do resto do produto, sem o `#EF4444`/`#FFC7C7` de erro de campo. É uma regra de negócio real (não um bug do participante), então o texto não pede desculpas exageradamente nem sugere que há algo a "consertar".

**Interação (decisão #6 — sem segunda via):**
- O único elemento focável do modal é o botão "Próximo participante".
- **Não há X, não há link "voltar" e o clique no backdrop não fecha "sem fazer nada"** — backdrop e `Esc` dispensam o modal executando a **mesma ação** do botão (reset do formulário), nunca deixam o operador de volta na tela travada sem saída. Isso evita um "modo escondido" de tentar de novo sem passar pela ação explícita, mas ainda garante que o modal não vira uma armadilha de teclado/toque (WCAG 2.1.2).
- Foco vai automaticamente para o botão ao abrir (não precisa navegar); Enter/Espaço/toque disparam a mesma ação.
- Scroll do body trava enquanto aberto (mesmo padrão do `TermsModal`).

---

## 4. Estados

- [x] Estado padrão — campo CPF vazio, primeiro do formulário
- [x] Estado ativo (digitando, incompleto) — sem validação prematura
- [x] Estado de erro específico — dígito verificador inválido (texto distinto de "obrigatório")
- [x] Estado de erro genérico — campo obrigatório vazio (reaproveita `validate()` existente)
- [x] Estado de loading — "verificando" (spinner discreto, não bloqueia outros campos)
- [x] Estado de sucesso silencioso — CPF novo, sem alarde visual
- [x] Estado de autopreenchimento — Nome/E-mail/Telefone com selo + borda accent, editáveis
- [x] Estado de campo "tocado após autopreenchimento" — selo some ao primeiro caractere editado manualmente
- [x] Estado de bloqueio — modal de limite atingido (Cenário 4)
- [x] Estado de reset — "Próximo participante" limpa CPF, demais campos e selos, mantém o operador na mesma tela do formulário (ver Decisão #7)
- [x] Estado vazio — N/A (não há "sem dados" nesta UI, é um formulário de entrada)
- [ ] Indicador de conectividade — opcional, ver §7 (sujeito a decisão do PO, não bloqueia esta spec)

---

## 5. Decisões de design (com justificativa, para orientar Tech Lead/Dev Front/QA)

1. **Não validar o dígito verificador enquanto o CPF está incompleto.** Só valida (e só dispara a consulta) quando os 11 dígitos estão preenchidos. Evita mostrar erro "piscando" a cada dígito digitado — reduz ansiedade na fila (requisito 6).
2. **A consulta é automática, sem botão "buscar".** Assim que o CPF completa 11 dígitos válidos, a busca dispara sozinha. Isso é consistente com o restante do form, que já é "sem fricção extra" (sem passos de confirmação intermediários).
3. **Feedback de "verificando" é só o spinner + `aria-live`, sem texto visível permanente.** Texto tipo "Verificando..." abaixo do campo, criado e removido em até 3s, tende a "piscar" e parecer instável numa fila rápida. O spinner é um padrão universal reconhecível e mais discreto; o `aria-live` cobre quem usa leitor de tela.
4. **Campos autopreenchidos permanecem editáveis (não `readOnly`).** Dados de cadastros antigos podem estar desatualizados (telefone trocado, e-mail antigo) — bloquear o campo forçaria o operador a apagar/corrigir um cadastro via canal fora do totem. Editável com sinalização clara ("veio do cadastro") é mais seguro para dado bom sem confundir "quem digitou o quê".
5. **Editar o CPF depois de um autopreenchimento invalida os campos autopreenchidos.** Se o operador corrige o CPF (ex.: erro de digitação identificado após o autopreenchimento), o Nome/E-mail/Telefone que vieram do cadastro anterior **devem ser limpos e os selos removidos**, disparando nova consulta para o novo CPF. Sem isso, corre-se o risco real de salvar um lead com Nome/E-mail de uma pessoa errada vinculado ao CPF de outra — é uma questão de integridade de dado, não só de UX. **Flag para o Tech Lead:** este comportamento precisa estar no critério de aceite técnico (a issue não descreve esse caso explicitamente).
6. **Modal de limite: toda via de saída leva à mesma ação.** Ver §3.3 — sem "cancelar e continuar tentando" e sem "fechar sem fazer nada"; isso não é um dark pattern (a issue pede explicitamente "sem viés a favor/contra continuar tentando") — é simplesmente não ter uma segunda via, porque só existe uma ação válida.
7. **"Próximo participante" reseta o formulário no lugar, sem passar pela splash.** A issue pede "retorna ao formulário vazio, pronto para o próximo cadastro" — ou seja, permanece na tela do form, diferente do fluxo do `ResultScreen` (que hoje volta para `'splash'`). **Flag para o Tech Lead/PO:** confirmar se esse desvio do padrão (`ResultScreen` exige um toque na splash para começar; aqui o form já reabre pronto) é intencional — do ponto de vista de fila, evitar o passo extra da splash faz sentido (o participante já estava no meio do cadastro, não "terminou" nada), mas é uma decisão de fluxo, não só de tela, então registro aqui para validação e não decido unilateralmente.
8. **Autopreenchimento não sobrescreve o que o operador já digitou.** Se, enquanto a consulta ainda está em andamento, o operador já começou a digitar em Nome/E-mail/Telefone, a resposta da consulta **não deve sobrescrever** o que já foi digitado manualmente naquele campo específico — só preenche os campos que continuam vazios/intocados no momento em que a resposta chega. Evita o efeito "digitei e sumiu" caso o autopreenchimento responda tarde. **Flag para o Tech Lead:** implica um estado por campo tipo `touchedByUser`, análogo ao `autofilled` — mesma granularidade por campo, não um flag único do formulário.
9. **Nenhuma cor nova é introduzida.** Todo estado novo usa exclusivamente `#0333BD`, `#FCFC30`, branco e `#FFC7C7`/`#EF4444` (erro) — já existentes no `LeadForm`/`TermsModal`. Consistência com o Design System tem prioridade sobre "ficaria mais bonito com uma cor de sucesso dedicada".

---

## 6. Acessibilidade (WCAG 2.1 AA — mínimo)

- **Contraste:** todos os textos/estados novos reaproveitam combinações já validadas no produto — `#FFC7C7` sobre `#0333BD` (mensagens de erro, herdado de HUB-67), branco sobre `#0333BD` (labels, selo de autopreenchimento), `#0333BD` sobre `#FCFC30` (ícone de check do modal, botão "Próximo participante") — todas ≥ 4.5:1, a maioria bem acima. Nenhuma combinação nova precisa de checagem adicional porque nenhuma cor nova é introduzida (Decisão #9).
- **Alvo de toque mínimo:** campo CPF segue o padrão de 56px de altura já usado em todos os inputs; o botão "Próximo participante" do modal segue o padrão de 56px do `ResultScreen`. Nada abaixo de 44×44px.
- **Navegação por teclado/foco:**
  - Campo CPF participa do mesmo fluxo de foco do teclado virtual (`activateField`) já existente — nenhuma mudança de mecanismo, só passa a ser o primeiro campo da lista.
  - Modal de limite: foco vai automaticamente para o botão único ao abrir; `Tab`/`Shift+Tab` não escapam (único elemento focável, então o "trap" é trivial); `Esc` e clique no backdrop disparam a mesma ação do botão (Decisão #6) — nunca deixam o foco preso sem saída (WCAG 2.1.2, sem armadilha de teclado).
- **Labels ARIA necessárias:**
  - Campo CPF: `aria-invalid` + `aria-describedby` apontando para a mensagem de erro específica, exatamente como os demais campos hoje (`aria-describedby={hasError ? '${field.id}-error' : undefined}`).
  - Região de status da verificação: um elemento `aria-live="polite"` (visualmente oculto, `sr-only`, seguindo o padrão do `PreviewBanner`) anunciando, em sequência: **"Verificando CPF"** → (quando resolve) **"CPF localizado, dados preenchidos automaticamente"** *ou* nenhum anúncio adicional quando o CPF é novo (silêncio = não há nada de especial a comunicar, evita ruído desnecessário no leitor de tela).
  - Selo "Preenchido automaticamente": associado ao campo via `aria-describedby` no próprio input (além do texto visível), para quem usa leitor de tela saber que aquele valor não foi digitado por ele antes de editar.
  - Modal de limite: `role="dialog"` + `aria-modal="true"` + `aria-labelledby` no título ("Você já participou!"), mesmo padrão do `TermsModal`. Adicionalmente, um `aria-live="polite"` (pode ser o próprio título ou uma região irmã oculta) anunciando a abertura do modal ao leitor de tela — seguindo explicitamente o mesmo padrão já usado em `consentError` (`aria-live="polite"`), conforme pedido no requisito.
- **Leitor de tela — comportamento esperado:** ao completar o CPF, o participante/operador ouve "Verificando CPF"; ao final, ou nada (CPF novo/offline — mesmo tratamento silencioso do Cenário 6) ou "CPF localizado, dados preenchidos automaticamente" (autopreenchimento) ou o anúncio do modal (bloqueio). Erros de validação (obrigatório/dígito inválido) seguem exatamente o padrão sonoro que os demais campos já têm hoje (mensagem lida via `aria-describedby`, sem anúncio ativo adicional — comportamento herdado, não é uma decisão nova).
- **Sem dependência só de cor:** o estado de erro do CPF tem texto específico (não só borda vermelha); o autopreenchimento tem selo textual (não só a borda accent); o modal de bloqueio tem texto completo (não só o ícone de check).

---

## 7. Indicador de conectividade — recomendação opcional (não bloqueia esta spec)

Conforme pedido, verifiquei o produto inteiro e **não existe hoje nenhum indicador visual de status online/offline** — só um campo de dado (`synced_from`) gravado no banco e mostrado como texto puro numa tabela do `AdminPanel`, sem nenhuma superfície de UI dedicada a comunicar conectividade ao operador em tempo real.

Como o requisito da issue já resolve o Cenário 6 (offline) de forma **transparente ao participante** — sem exigir UI nova — e o pedido de indicador é explicitamente condicional ("se já existir um padrão... pode se beneficiar"), **não estou criando um componente novo por padrão**, para não expandir escopo sem necessidade (YAGNI) numa entrega que já é grande (a própria issue recomenda quebrar em sub-issues).

Se o PO/Tech Lead decidirem que vale a pena um sinal discreto para o operador (não para o participante), a recomendação de design, caso seja aprovada como item futuro, seria:

- Um ponto pequeno (8–10px, canto superior do totem, fora da área de toque do form) — verde/accent quando `navigator.onLine` e a última consulta respondeu a tempo, cinza/opaco quando em modo offline — sem texto, sem bloquear nada, visível só de perto (operador), não teria o mesmo peso visual do restante da tela.
- Isso **não é parte do Definition of Done desta feature** — registro aqui só para não ignorar o pedido de verificação, e para não fechar a porta caso vire uma issue própria depois.

---

## 8. Responsividade (totem retrato — mesma referência de HUB-57/HUB-65)

| Breakpoint | Comportamento |
|---|---|
| **Mobile / totem estreito (320–768px lógicos, base do form atual)** | CPF ocupa a largura total do form (`w-full`, `px-[8%]` herdado), mesma pilha vertical dos demais campos. Selo "Preenchido automaticamente" quebra para baixo do label quando não couber ao lado (ver §3.2). Modal de limite: card `w-[80%]` (mesma proporção do `TermsModal`), conteúdo curto o suficiente para nunca precisar de scroll interno nesta largura. |
| **Tablet (768px+)** | Sem mudança estrutural — o form já usa `max-w-lg` centralizado; CPF e selo seguem a mesma proporção, com mais respiro lateral natural do próprio `max-w-lg`. |
| **Desktop / totem grande (1280px+)** | Mesmo comportamento do restante do form hoje (não há breakpoint dedicado a desktop no LeadForm atual — é um totem de orientação fixa retrato); nenhuma adaptação nova é necessária além do que HUB-57 já cobre para o teclado virtual em telas maiores. |

Compatibilidade com o teclado virtual: o campo CPF usa o teclado `numeric` (dialpad, 3 colunas) já existente e testado com o campo Telefone — nenhuma mudança de layout de teclado, apenas mais um campo apontando para o mesmo `keyboardLayout: 'numeric'`.

---

## 9. Componentes do Design System

**Reaproveitados sem alteração de estilo (só de posição/config):**
- Input pill padrão do `LeadForm` (`min-h-[56px]`, `text-20px`, bordas accent/ativo/erro)
- Teclado virtual numérico (`numeric` layout, `keyboardLayouts.ts`)
- Estrutura de modal acessível do `TermsModal` (backdrop, card branco, `role="dialog"`, focus handling, scroll-lock)
- Botão "Próximo participante" (`ResultScreen.tsx`) — reaproveitado literalmente, mesmo texto e estilo

**Novos elementos (a documentar no Design System quando implementados):**
- **Selo "Preenchido automaticamente"** — chip textual pequeno + borda esquerda accent no input; variante reutilizável para qualquer campo autopreenchido por integração (não é exclusivo de CPF, pode servir a features futuras de autopreenchimento).
- **Indicador de "verificando" inline em input** — spinner discreto posicionado dentro de um campo de texto, com anúncio via `aria-live` associado; candidato a virar um padrão reutilizável para qualquer busca assíncrona disparada por digitação (ex.: se o produto ganhar outros campos com lookup no futuro).
- **`LeadLimitModal`** (nome sugerido) — variante de modal "somente-confirmação" (um único CTA, sem X, sem fechar sem ação) derivada da mesma base de acessibilidade do `TermsModal`, mas mais enxuta. Recomendo ao Tech Lead avaliar se compensa extrair uma base comum de modal (`role="dialog"` + focus-trap + scroll-lock) reutilizada por `TermsModal` e `LeadLimitModal`, em vez de duplicar a lógica de acessibilidade — decisão de arquitetura, não de design.

Cada novo componente deve ser documentado, ao ser implementado, com: variações, props, estados e checagem de acessibilidade isolada, conforme a regra do Design System.

---

## 10. Itens deixados para a Spec Técnica (Tech Lead)

- Nome/formato exato do campo CPF em `config.leadForm.fields` (tipo `text` com `mask`/`keyboardLayout: 'numeric'` override, ou um tipo novo `cpf`) — decisão técnica, fora do escopo de design.
- Algoritmo de validação de dígito verificador (função pura, testável, no mesmo espírito de `phoneMask.ts`).
- Endpoint/estratégia de consulta, cache, timeout de 3s e critério de "não respondeu a tempo" (Cenário 6) — cabe à spec técnica.
- Implementação dos flags por campo `autofilled`/`touchedByUser` (Decisões #4/#5/#8) — estado local do `LeadForm`, análogo ao `errors`/`caretPos` já existentes.
- Tempo mínimo de exibição do spinner (recomendação de UX: mesmo que a consulta responda em <300ms, manter o spinner visível por um piso mínimo de ~300ms evita um "flash" que pareça instável/bugado numa fila — decisão de polish, não bloqueante).
- Onde/como o resultado do Cenário 7 (reconciliação informativa) é exposto — hoje não há UI prevista; se o time quiser um relatório no `AdminPanel` no futuro, é uma issue própria, não parte desta spec de design.

---

## 11. Critérios de aceite de UX (complementam os 8 cenários da issue)

- [ ] Campo CPF é visualmente o primeiro do formulário, mesmo estilo de input dos demais campos.
- [ ] Erro de dígito verificador inválido usa uma mensagem de texto **diferente** de "CPF é obrigatório", mesmo padrão visual (borda + `text-[#FFC7C7]`) dos demais erros de campo.
- [ ] Erro de CPF só aparece quando os 11 dígitos estão completos — nunca "pisca" erro enquanto o operador ainda está digitando.
- [ ] Estado de "verificando" é visível (spinner) mas não bloqueia nenhum outro campo do formulário para digitação.
- [ ] Estado de "verificando" nunca ultrapassa visualmente os 3s de timeout de negócio — some sempre com uma resolução (novo, autopreenchido, bloqueado, ou silenciosamente liberado no fallback offline).
- [ ] Campos autopreenchidos têm sinalização visual clara (selo + borda) e continuam editáveis por toque/teclado virtual normalmente.
- [ ] Editar um campo autopreenchido remove o selo **só daquele campo**, sem afetar os demais.
- [ ] Editar o CPF depois de um autopreenchimento limpa os campos autopreenchidos e seus selos (Decisão #5).
- [ ] Modal de limite atingido tem exatamente um botão de ação; `Esc`/backdrop produzem o mesmo efeito do botão — nenhuma via de saída deixa o operador "preso" sem ação nem oferece um caminho alternativo de continuar tentando.
- [ ] Modal de limite é anunciado por leitor de tela via `aria-live`/`role="dialog"`/`aria-labelledby`, seguindo o mesmo padrão já usado em `consentError`.
- [ ] Nenhuma cor fora da paleta já existente (`#0333BD`, `#FCFC30`, branco, `#FFC7C7`/`#EF4444`) é usada em qualquer estado novo.
- [ ] Contraste de todo texto novo ≥ 4.5:1 (validado por reaproveitar combinações já em produção — sem combinação nova a testar).
- [ ] Alvo de toque de todo elemento interativo novo ≥ 44×44px (botão do modal segue os 56px já padrão).
- [ ] Fallback offline (Cenário 6) é indistinguível, para o participante, do fluxo de CPF novo (Cenário 2) — nenhuma mensagem de erro/alerta aparece.
