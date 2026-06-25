# HUB-57 — Teclado virtual on-screen para formulário de lead (totem retrato, touch)

- **Issue:** [HUB-57](https://linear.app/hub-de-ativacoes/issue/HUB-57)
- **Fase:** Discovery
- **Autor desta seção:** Product Manager
- **Data:** 2026-06-25

---

## Discovery de Negócio — PM

### 1. Problema e impacto no negócio

A ativação roda em **totem retrato, touch, sem teclado físico**. O teclado nativo do SO ou **sobrepõe** o formulário ou **empurra/quebra o layout**. Na prática, o participante chega à tela de captura de lead (`LeadForm.tsx`: nome, e-mail, WhatsApp) e **não consegue digitar de forma confiável**.

O `LeadForm` é a **porta de entrada obrigatória da experiência**: sem preencher e enviar o form, o participante não joga (`onSubmit` libera o jogo). Logo, qualquer fricção aqui não é cosmética — ela **bloqueia a captação de leads**, que é o único objetivo de negócio da ativação no evento. Os campos mais sensíveis são exatamente os que dependem de digitação livre: **e-mail** (precisa de `@`, `.`, sem autocorreção) e **nome** (acentos pt-BR). Telefone já tem `inputMode="numeric"` e máscara, mas ainda depende de um teclado utilizável.

**Impacto direto:** cada participante que desiste no preenchimento é um **lead perdido e não recuperável** (a janela é o tempo presencial no estande). Em evento, o custo de aquisição daquele contato já foi pago (espaço, equipe, brinde/jogo); falhar na captura desperdiça todo o investimento a montante.

### 2. Objetivo / valor esperado e alinhamento estratégico

**Objetivo:** garantir que 100% dos participantes que iniciam o formulário consigam digitar e concluir, eliminando a dependência do teclado do SO.

**Valor esperado:** maximizar **leads válidos capturados por hora de evento** — o KPI-mãe da ativação. A feature é um **viabilizador de go-live**, não um incremento incremental: sem ela, o totem não é confiável em produção real de evento.

**Alinhamento estratégico:** a ativação existe para **gerar leads qualificados em evento**. Esta feature ataca diretamente o gargalo de conversão na etapa de captura, que é onde o funil inteiro pode vazar.

### 3. Métricas de sucesso (mensuráveis)

| Métrica | Definição | Meta |
|---|---|---|
| **Taxa de conclusão do form** | forms enviados com sucesso ÷ forms iniciados (primeiro foco em campo) | ≥ 95% |
| **Taxa de abandono** | sessões que focam um campo e não enviam | ≤ 5% |
| **Tempo médio de preenchimento** | do primeiro foco até submit válido | ≤ 45s |
| **Leads válidos / hora** | leads com e-mail em formato válido por hora de operação | aumentar vs. baseline com teclado do SO |
| **Taxa de e-mail inválido** | submits barrados pela validação de e-mail | reduzir (proxy de fricção de digitação) |

> Observação: hoje não há instrumentação dessas métricas no código. **Recomendo tratar a telemetria mínima (form iniciado / enviado / abandonado) como item de discovery do PO/Tech Lead**, pois sem ela não conseguimos provar o sucesso da feature em campo.

### 4. Prioridade recomendada e justificativa

**Prioridade: ALTA (bloqueante para go-live real).** Mantém o `High` já atribuído na issue.

Justificativa: é um **bloqueador de operação** — sem teclado confiável, o totem não captura leads de forma previsível, o que invalida a razão de existir da ativação. Pelo critério impacto × esforço, o **impacto é máximo** (afeta 100% dos leads) e o problema é **recorrente e já observado em campo pelo operador (25/06)**. Deve ser a próxima feature a entrar em desenvolvimento após spec aprovada.

**Pergunta crítica de timing:** confirmar a **data do próximo evento**. Se houver evento agendado nas próximas 1–2 semanas, isto é a prioridade #1 absoluta da sprint e qualquer outra coisa cede espaço.

### 5. Riscos de negócio e de UX se NÃO fizermos

- **Perda direta de leads:** participantes desistem no formulário → funil vaza na entrada.
- **Operação não confiável:** operador precisa intervir manualmente (apontar, corrigir), criando fila e degradando a experiência de marca no estande.
- **Dados sujos:** digitação ruim de e-mail/telefone → leads inválidos → base de remarketing inutilizável e custo de limpeza posterior.
- **Risco de imagem:** totem que "trava" ou mostra teclado do SO sobreposto passa amadorismo na frente do público do evento.
- **ROI do evento comprometido:** todo o custo presencial (espaço, equipe, brinde) sem o retorno em base de contatos.

### 6. Premissas e perguntas em aberto (operador/cliente)

**Premissas assumidas (validar):**
- Idioma de operação é **português do Brasil**; nomes exigem **acentuação pt-BR** (á, ã, ç, é...).
- Os 3 campos atuais (nome, e-mail, WhatsApp) são o escopo; o form é configurável via `config.json`.
- Totem é **single-purpose** (kiosk) — bloquear o teclado do SO não prejudica outros usos.

**Perguntas para o operador/cliente:**
1. **Quando é o próximo evento?** (define se é go-live iminente ou planejável)
2. **Acentos pt-BR são obrigatórios** no teclado virtual, ou nome sem acento é aceitável para a base?
3. O conjunto de campos vai **crescer/mudar** (ex.: empresa, cargo, CPF)? Isso afeta quantos layouts de teclado precisamos suportar.
4. Há necessidade de **outros idiomas** (evento internacional) ou apenas pt-BR?
5. O e-mail precisa de **atalhos** (domínios comuns `@gmail.com`, `.com.br`) para acelerar — há preferência?
6. Há **meta numérica de leads** por evento/hora que sirva de baseline e alvo?
7. Podemos **instrumentar telemetria mínima** (iniciado/enviado/abandonado) para medir sucesso, respeitando a LGPD já presente no config?

### 7. Recomendação

**SEGUIR — aprovado para avançar no discovery.** Veredito de negócio: feature de **alto valor e bloqueante para go-live real** da ativação.

**Ordem recomendada:**
1. PO confirma com o operador as perguntas de timing (#1) e acentos pt-BR (#2) — definem escopo mínimo.
2. PO escreve user story + critérios de aceite (incluindo layouts por tipo de campo e bloqueio do teclado do SO).
3. Designer define UX em retrato (posição abaixo do form, sem deslocar layout, áreas de toque ≥ alvo touch).
4. Tech Lead decide build custom vs. biblioteca e escreve spec técnica.
5. Incluir **telemetria mínima** no escopo para que as métricas de sucesso sejam verificáveis em campo.

**Escopo mínimo para o primeiro evento (MVP):** teclado alfabético pt-BR com acentos (nome), layout e-mail com `@`/`.`, layout numérico (telefone), bloqueio do teclado do SO. Atalhos de domínio e idiomas extras são incrementos posteriores.

---

## Discovery Funcional — PO

- **Autor desta seção:** Product Owner
- **Data:** 2026-06-25

### User Story

**Como** participante do evento diante de um totem touch em retrato (sem teclado físico),
**quero** digitar meu nome, e-mail e WhatsApp usando um teclado virtual na própria tela, posicionado abaixo do formulário,
**para que** eu consiga preencher e enviar meus dados de forma confiável e iniciar o jogo, sem que o teclado do sistema operacional apareça, cubra ou quebre o layout.

### Critérios de Aceite (Given/When/Then)

**Cenário 1: Teclado nativo do SO não aparece**
- **Dado** que estou na tela do `LeadForm` em um totem touch
- **Quando** toco em qualquer campo (nome, e-mail ou phone)
- **Então** o teclado nativo do SO **não** é exibido em nenhum momento
- **E** o campo não recebe foco de digitação nativo (entrada de texto ocorre **exclusivamente** pelo teclado virtual da aplicação).

**Cenário 2: Teclado virtual aparece e fica ativo ao selecionar um campo**
- **Dado** que a tela do formulário está visível
- **Quando** toco em um campo
- **Então** o teclado virtual é exibido **dentro do layout, abaixo do formulário**
- **E** o campo selecionado fica visualmente marcado como ativo
- **E** as teclas que eu toco inserem caracteres no campo ativo.

**Cenário 3: Layout alfabético pt-BR para o campo nome**
- **Dado** que o campo ativo é `nome`
- **Quando** o teclado virtual é exibido
- **Então** vejo um layout alfabético em português do Brasil
- **E** consigo digitar letras e espaço; acentuação pt-BR (á, ã, ç, é, í, ó, ú...) está disponível **se confirmada pelo cliente** (ver Dependências — pergunta #2 do PM)
- **E** existe alternância maiúscula/minúscula que altera o caractere efetivamente inserido.

**Cenário 4: Layout de e-mail com `@` e `.`**
- **Dado** que o campo ativo é `email`
- **Quando** o teclado virtual é exibido
- **Então** as teclas `@` e `.` estão visíveis e acessíveis sem trocar de página de teclado
- **E** não há autocorreção/capitalização automática alterando o que digito
- **E** (se confirmado pelo cliente) atalhos de domínio comuns (`@gmail.com`, `.com.br`) aceleram o preenchimento (ver Dependências — pergunta #5 do PM).

**Cenário 5: Layout numérico para o campo phone respeitando a máscara**
- **Dado** que o campo ativo é `phone`
- **Quando** o teclado virtual é exibido
- **Então** vejo um layout numérico (0–9)
- **E** ao digitar os dígitos, a máscara `(99) 99999-9999` é aplicada progressivamente (mesmo comportamento atual de `applyPhoneMask`)
- **E** dígitos além de 11 são ignorados.

**Cenário 6: Posicionamento em retrato sem cobrir nem deslocar**
- **Dado** que o totem está em orientação retrato
- **Quando** o teclado virtual está visível com qualquer campo ativo
- **Então** o teclado fica abaixo do formulário, **sem cobrir o campo ativo** nem o botão de envio relevante
- **E** o layout do formulário **não é deslocado, redimensionado nem quebrado** pela exibição do teclado
- **E** todos os 3 campos e o botão "Jogar" permanecem acessíveis (com rolagem interna controlada, se necessário, sem depender do teclado do SO).

**Cenário 7: Teclas mínimas de controle**
- **Dado** que o teclado virtual está ativo
- **Quando** olho as teclas disponíveis
- **Então** existem, no mínimo: **backspace** (apaga o último caractere), **limpar** (esvazia o campo ativo), **espaço** e **alternar maiúscula/minúscula**
- **E** ao tocar **backspace** no campo `phone`, a máscara é recalculada corretamente após a remoção.

**Cenário 8: Troca de campo mantém o teclado adequado ao tipo**
- **Dado** que estou digitando em um campo
- **Quando** seleciono outro campo de tipo diferente
- **Então** o teclado virtual troca para o layout correspondente ao novo tipo (alfabético / e-mail / numérico)
- **E** o conteúdo já digitado em cada campo é preservado.

**Cenário 9: Alvos de toque acessíveis e feedback visual**
- **Dado** o teclado virtual exibido
- **Quando** observo e toco as teclas
- **Então** cada tecla tem alvo de toque com tamanho mínimo acessível (referência ≥ 44×44px; valor final definido pelo Designer)
- **E** ao tocar uma tecla há feedback visual imediato (estado pressionado/realce).

**Cenário 10: Validação existente continua funcionando**
- **Dado** que preenchi os campos pelo teclado virtual
- **Quando** tento enviar
- **Então** as validações atuais permanecem ativas: campo obrigatório vazio bloqueia e exibe mensagem; e-mail em formato inválido (regex atual) bloqueia e exibe "E-mail inválido"
- **E** as mensagens de erro são exibidas como hoje.

**Cenário 11: Botão "Jogar" só submete com campos válidos**
- **Dado** que estou no formulário
- **Quando** toco em "Jogar"
- **Então** o jogo só inicia (`onSubmit`) se todos os campos obrigatórios estiverem preenchidos e o e-mail for válido
- **E** caso contrário, o envio é bloqueado e os erros são apresentados, mantendo o teclado virtual disponível para correção.

### Fora de Escopo

- Suporte a **outros idiomas** além de pt-BR (multi-idioma) — incremento posterior.
- **Campos além dos 3 atuais** (nome, e-mail, phone), ex.: empresa, cargo, CPF — só entram se o cliente confirmar (pergunta #3 do PM).
- Decisão técnica de **build custom vs. biblioteca**, escolha de componentes e arquitetura — responsabilidade do Tech Lead na spec técnica.
- **Telemetria/instrumentação** das métricas de sucesso — tratada como item próprio de discovery (recomendação do PM); não bloqueia esta US, mas deve ser issue paralela.
- Predição de texto / autocomplete inteligente além dos atalhos de domínio.

### Definition of Done funcional

- Os 11 cenários de aceite acima passam em validação do QA, em totem (ou emulação) **retrato touch**.
- O teclado do SO **comprovadamente não aparece** ao interagir com qualquer campo.
- Os 3 layouts (alfabético pt-BR, e-mail, numérico) funcionam e trocam corretamente conforme o campo ativo.
- A máscara de telefone e as validações de obrigatório/e-mail continuam idênticas ao comportamento atual.
- Layout em retrato não é deslocado nem coberto pelo teclado em nenhum dos campos.
- Spec funcional **aprovada explicitamente pelo PO**, com alinhamento de negócio validado pelo PM e testabilidade confirmada pelo QA, antes de iniciar implementação.

### Dependências / perguntas em aberto que travam a aprovação da spec

Bloqueiam o fechamento do escopo mínimo (referência às perguntas do PM, seção 6):

1. **Acentos pt-BR são obrigatórios** no teclado de `nome`? (PM #2) — define o layout alfabético do Cenário 3. Sem resposta, assumimos **com acentos** no MVP, sujeito a confirmação.
2. **Conjunto de campos vai mudar/crescer** (empresa, cargo, CPF)? (PM #3) — define quantos layouts e se há novo tipo de teclado; hoje a US cobre apenas os 3 campos atuais.
3. **Atalhos de domínio de e-mail** (`@gmail.com`, `.com.br`) são desejados no MVP? (PM #5) — Cenário 4 trata como opcional dependente desta resposta.
4. **Idioma único pt-BR** confirmado? (PM #4) — multi-idioma está fora de escopo até confirmação.
5. **Data do próximo evento** (PM #1) — define a urgência de fechar a spec; não muda o escopo funcional, mas prioriza a aprovação.

> Itens 1–4 precisam de resposta do operador/cliente para o PO **aprovar a spec funcional** sem ambiguidade. Na ausência das respostas, vale o MVP assumido pelo PM (alfabético pt-BR com acentos + e-mail com `@`/`.` + numérico), explicitamente marcado como premissa a validar.
