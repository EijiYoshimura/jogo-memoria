# ADR-013 — CPF completo (não mascarado) no CSV de export do Admin

**Data:** 2026-07-03
**Status:** Aceito (decisão do stakeholder registrada em 2026-07-03 — ver seção "Decisão do stakeholder")

## Contexto

A HUB-87 (antifraude) introduziu o CPF como identificador de participação por evento, e a HUB-92
implementou a persistência, a reconciliação offline e o CSV/relatório no AdminPanel. Nessa entrega ficaram
definidos **dois tratamentos distintos** para o mesmo dado:

- **UI de reconciliação** (AdminPanel, online): o CPF é exibido **mascarado** — `123.***.**9-00` — porque a
  tela serve apenas para o operador identificar *quais* CPFs excederam o limite; ver
  `docs/guia-operador.md`, seção "Reconciliação de participações".
- **CSV de export** (`src/standalone/lib/leadsCsv.ts`, coluna `cpf`): o CPF sai **completo**, 11 dígitos, sem
  mascaramento.

A spec técnica da HUB-87 deixou o tratamento do CPF no arquivo exportado **explicitamente em aberto**, no
"Fora de Escopo" (`docs/specs/HUB-87-cpf-antifraude.md`, linhas 536–538): mascarar em tela/CSV era
"recomendado para a seção de reconciliação e para o CSV de export, mas a decisão final de UX/compliance fica
com Designer/PO/PM". A HUB-96 é a issue que fecha formalmente esse ponto para o **CSV** (a máscara na UI de
reconciliação já está decidida e implementada).

O CSV é a **ferramenta operacional** com que o operador do evento executa a apuração do sorteio: cruzar as
participações, deduplicar por CPF e identificar/decidir sobre CPFs que excederam `leadForm.maxParticipations`.
Essa apuração é a própria razão de o projeto coletar CPF (o objetivo antifraude validado pelo PM). O código
que gera o CSV já documenta a pendência desta decisão em comentário (`FIXED_HEADERS`, `leadsCsv.ts`).

## Alternativas Consideradas

### (a) CPF completo no CSV (escolhida)

Manter o comportamento atual: a coluna `cpf` sai com os 11 dígitos.

- **A favor:** o CSV cumpre seu único propósito — apuração antifraude do sorteio. Dedup e reconciliação
  exigem o identificador **inteiro**: dois CPFs distintos podem compartilhar os mesmos dígitos visíveis de
  uma máscara, e a decisão humana sobre um CPF excedente (desclassificar do sorteio) precisa do número
  completo para ser auditável e defensável. Zero mudança de código — preserva a entrega da HUB-92 já
  validada. Alinhado ao objetivo de negócio (o CPF foi coletado justamente para permitir essa apuração).
- **Contra:** o arquivo exportado passa a conter dado pessoal de alta sensibilidade (identificador único de
  pessoa física perante o Estado) fora da fronteira controlada do sistema. Uma vez baixado, o arquivo escapa
  de qualquer controle técnico do app (RLS, hash, `SECURITY DEFINER` do ADR-011/ADR-012) e passa a depender
  **inteiramente de controle organizacional/processual** — daí a orientação LGPD ser parte obrigatória desta
  decisão (ver "Consequências / Mitigações LGPD").

### (b) Mascarar o CPF no CSV (rejeitada)

Exportar `123.***.**9-00` também no arquivo, como na UI de reconciliação.

- **Rejeitada porque quebra a apuração.** Um CPF mascarado não deduplica de forma confiável (colisão de
  dígitos visíveis) e não sustenta uma decisão humana auditável de desclassificação. Mascarar o CSV
  inviabilizaria o propósito antifraude — seria exportar um arquivo que não serve para aquilo que justifica
  sua existência. A máscara faz sentido na **tela** (onde só se identifica o caso), não no **artefato de
  apuração**.

### (c) Máscara configurável por evento (rejeitada agora)

Um flag em `config.json` (ex.: `leadForm.maskCpfInCsv`) decidindo por evento se o CSV sai mascarado ou
completo.

- **Rejeitada por complexidade sem benefício claro no momento.** Adiciona superfície de configuração,
  validação no `ConfigLoader`, ramo de código no gerador de CSV e um novo caminho de teste — para resolver
  uma variação de requisito que **não existe hoje** (YAGNI). Todos os eventos atuais precisam do CPF completo
  para apurar. Fica registrada como caminho futuro caso surja um evento cujo processo de apuração aceite (ou
  exija) máscara — aí a decisão volta à mesa com um requisito concreto.

## Decisão

Adotar a **opção (a)**: **o CPF continua saindo completo (11 dígitos) na coluna `cpf` do CSV de export**,
mantendo o comportamento atual da HUB-92. **Nenhuma mudança de código** decorre desta decisão.

A contrapartida obrigatória — e a razão de esta decisão não ser apenas "não fazer nada" — é a **orientação
LGPD do arquivo exportado**, documentada no `guia-operador.md` (ver "Consequências / Mitigações LGPD" e a
seção "LGPD — o arquivo de leads exportado" do guia). O controle do dado, que dentro do sistema é técnico,
passa a ser **organizacional** a partir do download; essa transferência de responsabilidade tem de estar
escrita e ser conhecida pelo operador.

A máscara na **UI de reconciliação** permanece inalterada (decisão anterior, HUB-92) — esta ADR trata
exclusivamente do **CSV**.

## Decisão do stakeholder — RESOLVIDA (2026-07-03)

**Resolução:** o stakeholder escolheu **manter o CPF completo no CSV** e **documentar a orientação LGPD do
arquivo exportado**. A alternativa de mascarar o CSV foi descartada por inviabilizar a apuração; a de tornar
configurável por evento foi descartada por complexidade sem benefício atual. A identidade do controlador de
dados citado na orientação está **pendente de confirmação jurídica** (ver HUB-95) — quando confirmada, esta
política de export deve ser revista (ver "Consistência com HUB-95").

## Consequências

### Positivas

- O CSV segue cumprindo seu propósito antifraude — dedup e apuração do sorteio com o identificador completo,
  auditável e defensável.
- Zero mudança de código: nenhuma regressão sobre a entrega já validada da HUB-92; nenhum novo caminho de
  teste ou de configuração a manter.
- A decisão fica **registrada e rastreável** (fecha o "Fora de Escopo" da HUB-87) em vez de permanecer um
  comportamento implícito não decidido.
- A responsabilidade pelo dado após o download deixa de ser tácita: passa a ser explícita e conhecida pelo
  operador via `guia-operador.md`.

### Negativas / Trade-offs

- O dado mais sensível do sistema (CPF completo) sai da fronteira controlada pelo app no momento do export. A
  partir daí, **nenhum controle técnico** do app protege o arquivo — a proteção é 100% organizacional
  (controle de acesso, retenção, descarte, não redistribuição). É um trade-off aceito conscientemente: o
  benefício operacional da apuração justifica, desde que a orientação LGPD seja seguida.
- A eficácia da mitigação depende de **disciplina humana** do operador, não de código. O guia-operador é o
  único ponto de reforço — por isso a orientação foi escrita de forma curta e acionável, não como texto
  jurídico extenso.

### Mitigações LGPD (contrapartida obrigatória da decisão)

Registradas em `docs/guia-operador.md`, seção **"LGPD — o arquivo de leads exportado"**, e resumidas aqui:

1. **Natureza do arquivo:** o CSV contém dado pessoal — CPF completo, além de nome, e-mail e demais campos do
   `leadForm`. Trata-se de arquivo de dados pessoais sujeito à LGPD, não de um relatório anônimo.
2. **Controle de acesso:** apenas quem tem a senha do Admin online (ou o `offlineExportPin`, offline) pode
   gerar o arquivo — os controles técnicos de leitura seguem os ADR-011/ADR-012. Após o download, o acesso ao
   arquivo deve ser restrito às pessoas envolvidas na apuração do sorteio; não deixar em pasta compartilhada
   aberta, e-mail sem proteção ou dispositivo do totem.
3. **Responsabilidade após o download:** quem baixa o arquivo torna-se responsável por sua guarda; o dado sai
   do escopo de proteção técnica do app e passa a depender de controle organizacional.
4. **Retenção e descarte:** manter o arquivo apenas pelo tempo necessário à apuração do sorteio e **descartar
   com segurança** (exclusão definitiva das cópias) após concluída — a finalidade declarada ao titular é o
   controle de participações/elegibilidade, não retenção indefinida.
5. **Não redistribuir:** o arquivo não deve ser encaminhado, copiado ou compartilhado além do estritamente
   necessário à apuração.

## Consistência com HUB-95

A orientação LGPD deste export deve nomear corretamente o **controlador de dados** (LGPD, Art. 9º). Hoje há
uma **inconsistência de controlador não resolvida** — `lgpd.dataController` diverge do corpo dos textos de
consentimento, com CNPJs distintos — registrada na **HUB-95** e **pendente de confirmação jurídica**.

Por isso, esta política de export é **provisória quanto à identidade do controlador**: quando a HUB-95 for
concluída e o controlador único for confirmado por jurídico, esta ADR e a seção "LGPD — o arquivo de leads
exportado" do `guia-operador.md` **devem ser revisadas** para (a) refletir o controlador correto como
responsável final pelo tratamento e (b) confirmar que a orientação de retenção/descarte está alinhada à
política do controlador. A decisão sobre **CPF completo no CSV** em si (esta ADR) não depende da HUB-95 —
apenas a atribuição de responsabilidade ao controlador depende.
