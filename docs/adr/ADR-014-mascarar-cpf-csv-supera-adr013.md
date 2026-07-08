# ADR-014 — Mascarar CPF em todo export de CSV (supera e reverte a ADR-013)

**Data:** 2026-07-07
**Status:** Aceito (decisão do stakeholder). **Esta ADR supera formalmente a
`docs/adr/ADR-013-cpf-completo-csv-export.md`, cujo status passa a "Substituído por ADR-014".**

## Contexto

A ADR-013 (2026-07-03) decidiu manter o CPF **completo** (11 dígitos) na coluna `cpf` de todo CSV gerado
pelo `AdminPanel` (`src/standalone/lib/leadsCsv.ts`), com o argumento central: o arquivo é a ferramenta
operacional de apuração do sorteio (dedup + identificação de CPFs excedentes), e uma máscara "inviabilizaria
essa apuração" (ADR-013, alternativa (b), rejeitada).

Essa decisão está sendo **revertida** por decisão de negócio do stakeholder, registrada nesta issue:
**uma vez que o CSV é exportado (baixado pelo operador), o arquivo é entregue ao cliente do evento e o app
não mantém nenhuma custódia ou cópia do artefato a partir daí** (não há upload/armazenamento server-side do
CSV — é gerado em memória no browser via `Blob`/`URL.createObjectURL` e baixado direto, ADR-006). Não existe,
portanto, necessidade de negócio para reter o identificador mais sensível do sistema (CPF completo) dentro de
um artefato que sai imediatamente do perímetro controlado pelo app.

### O argumento da ADR-013 estava parcialmente equivocado — e é isso que esta ADR corrige

A alternativa (b) da ADR-013 foi rejeitada com o argumento de que mascarar "quebra a apuração" porque "dedup e
reconciliação exigem o identificador inteiro". Revisitando o código real:

- `check_cpf_participation` (RPC, ADR-011) já faz a contagem/dedup **inteiramente no servidor**, comparando
  `cpf` completo armazenado em `leads`. Nunca usa nem depende de nenhum arquivo exportado.
- `findParticipationOverages` (`src/standalone/lib/reconciliation.ts`) agrupa por `(eventId, cpf)` usando o
  **CPF completo em memória** (`lead.cpf`, nunca a versão mascarada) — a máscara só é aplicada no **último
  passo de renderização** (`maskCpfForDisplay(overage.cpf)` em `AdminPanel.tsx`), depois que o agrupamento e a
  contagem já aconteceram.
- Ou seja: **a apuração antifraude nunca dependeu do arquivo CSV** — ela já roda inteiramente dentro do
  sistema (Supabase + IndexedDB), com o CPF completo, antes de qualquer export existir. O CSV era, na prática,
  um artefato de **relato/handoff** para a equipe do sorteio, não a ferramenta que calculava o dedup.
- A tela de Reconciliação (mesma HUB-92) já mascara o CPF na UI **sem que isso jamais tenha sido apontado como
  quebra de apuração** — a ADR-013 tratou de forma inconsistente a mesma máscara em dois lugares (aceita na
  tela, rejeitada no arquivo), quando o dado subjacente ao cálculo é idêntico nos dois casos (CPF completo em
  memória, nunca a string mascarada).

Isso não elimina 100% do valor operacional do CPF completo no CSV: se a equipe do sorteio precisar, num caso
pontual, **confirmar/desclassificar uma pessoa específica** por CPF exato (ex.: cruzar com documento físico no
momento do sorteio), o CSV mascarado sozinho não sustenta essa conferência com certeza absoluta (colisão nos
dígitos visíveis entre CPFs diferentes é matematicamente possível). Esse canal continua existindo — só deixa
de ser o CSV. Ver "Consequências / Negativas" abaixo.

## Decisão

1. **Toda coluna `cpf` de todo CSV gerado pelo sistema sai mascarada** no mesmo padrão já usado na tela de
   Reconciliação do Admin: `123.***.**9-00` (3 primeiros + 3 últimos dígitos visíveis, miolo com `*`).
   Vale para os três geradores de CSV: export online (`AdminPanel`, RPC `admin_list_leads`), export offline
   (`offlineExportPin`, leads do IndexedDB local) e o futuro export automático que antecede a exclusão de
   leads (HUB-YYY / ADR-015).
2. **CPF nulo/vazio permanece vazio** na célula — sem lançar erro, sem `00.***.**0-00` nem qualquer valor
   sintético.
3. **O código sentinela de participante estrangeiro** `111.111.111-11` (HUB-109) é mascarado exatamente pela
   mesma regra dos demais CPFs — nenhum branch especial é introduzido (defesa em profundidade contra um futuro
   dev "otimizar" isso com um caso especial).
4. **Cabeçalho do CSV não muda** — só o valor da célula.
5. **A função de máscara é extraída para um módulo puro compartilhado**
   (`src/lead-capture/mask/cpfRedaction.ts`, `maskCpfForDisplay(cpf: string): string`), reaproveitado por
   `AdminPanel.tsx` (tela de Reconciliação, comportamento inalterado) e por `leadsCsv.ts` (nova aplicação, na
   construção da célula `cpf`) — elimina a duplicação que existiria se cada arquivo implementasse sua própria
   máscara.
6. **A apuração antifraude (dedup, contagem, identificação de excedentes) continua operando sobre o CPF
   completo dentro do sistema** (RPC `check_cpf_participation`, RPC `admin_list_leads`, `IndexedDB` local, e o
   agrupamento em memória de `findParticipationOverages`) — nenhuma dessas rotinas lê ou depende do arquivo
   exportado. Isso resolve formalmente a objeção original da ADR-013.
7. `docs/adr/ADR-013-cpf-completo-csv-export.md` tem seu cabeçalho de `Status` atualizado para
   `Substituído por ADR-014` (edição feita nesta mesma entrega, ver rodapé daquele arquivo).

### Contrapartida obrigatória — atualização da orientação LGPD e do canal de CPF completo

Assim como a ADR-013 exigiu a seção "LGPD — o arquivo de leads exportado" (`docs/guia-operador.md`) como
contrapartida da decisão anterior, esta reversão exige **reescrever** a mesma seção (não removê-la — o CSV
mascarado ainda contém nome, e-mail, telefone e demais campos do `leadForm`, que seguem sendo dado pessoal
sujeito à LGPD; a severidade cai, não zera). A seção revisada deve deixar claro:

- O CPF no arquivo agora sai **parcialmente mascarado** — o risco de reidentificação por CPF cai
  drasticamente, mas o arquivo **continua** sendo um artefato de dados pessoais (nome/e-mail/telefone) e as
  mesmas práticas de controle de acesso, retenção e descarte da orientação anterior continuam válidas.
- **Novo canal para conferência de CPF exato:** quando a equipe do sorteio precisar confirmar/desclassificar
  uma pessoa por CPF completo (caso pontual, não o fluxo padrão), o caminho passa a ser o **Supabase Table
  Editor** (acesso de dono do projeto, já documentado em `docs/services-checklist.md`, seção "Acesso admin aos
  leads (após o evento)") — não mais o CSV. **Isto é uma lacuna operacional que esta ADR não fecha sozinha:**
  o Tech Lead recomenda que o PO/stakeholder decida explicitamente **quem** detém acesso ao Supabase Table
  Editor durante um evento ao vivo, para que a equipe de sorteio não fique bloqueada num caso de
  desclassificação. Ver recomendação equivalente na spec técnica (`docs/specs/mascarar-cpf-csv-limpeza-leads.md`).

## Consequências

### Positivas

- O identificador mais sensível do sistema deixa de sair, em texto completo, em um artefato que escapa de todo
  controle técnico do app no momento do download — reduz a superfície de exposição de PII de alta
  sensibilidade sem custo de funcionalidade (a apuração dentro do app é preservada 1:1).
- Reaproveitamento de uma única função de máscara (`cpfRedaction.ts`) elimina divergência futura entre a regra
  aplicada na tela e a aplicada no CSV — antes da extração, a lógica só existia dentro de `AdminPanel.tsx` e
  não era reaproveitável sem duplicação.
- Fecha, de forma consistente e não contraditória, o tratamento do CPF em **todos** os pontos de saída do
  dado (tela e arquivo) com a mesma regra — remove a inconsistência apontada acima entre a ADR-013 e o
  comportamento já aceito da UI de Reconciliação.
- Pré-requisito necessário e habilitador da Story 2 (Limpeza de Leads, HUB-YYY/ADR-015): o export automático
  que antecede a exclusão de leads herda a máscara "de graça", sem branch condicional a mais.

### Negativas / Trade-offs

- **Lacuna operacional new:** casos pontuais de desclassificação por CPF exato exigem agora acesso ao Supabase
  Table Editor (fora do app), um canal que nem todo operador de evento possui hoje. Precisa de decisão de
  processo do PO/stakeholder sobre quem detém esse acesso durante eventos ao vivo — **não resolvido por esta
  ADR**, apenas identificado.
- Qualquer processo externo ao app que hoje dependa de rodar dedup **a partir do CSV** (ex.: planilha de
  terceiros que compara os 11 dígitos completos) deixa de funcionar como antes — se esse processo existir na
  prática (fora do código do app, portanto não visível ao Tech Lead), precisa ser identificado e ajustado pelo
  PO/operador antes do rollout.
- Disciplina de code review: qualquer novo gerador de CSV introduzido no futuro precisa lembrar de aplicar
  `maskCpfForDisplay` — não há um "único ponto de entrada" enforced no nível de tipos (é uma convenção de uso
  da função compartilhada, não uma garantia de compilador). Mitigação: `buildLeadsCsv` é hoje o único
  construtor de CSV do projeto; qualquer novo gerador deve reutilizá-lo em vez de montar linhas manualmente.

## Consistência com HUB-95

O texto da ADR-013 já registrava a HUB-95 (identidade do controlador de dados pendente de confirmação
jurídica) como pendência que exigiria revisão futura da orientação LGPD do export. Esta ADR **não depende**
da HUB-95 para ser adotada (é uma decisão de minimização de dado no artefato, ortogonal à identidade do
controlador), mas a reescrita da seção "LGPD — o arquivo de leads exportado" (contrapartida obrigatória acima)
deve continuar registrando a mesma pendência até a HUB-95 ser concluída.
