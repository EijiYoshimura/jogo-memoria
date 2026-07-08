# ADR-014 — Formatar CPF com pontuação padrão em todo export de CSV (complementa a ADR-013)

**Data:** 2026-07-07
**Status:** Aceito (decisão do stakeholder). **Complementa `docs/adr/ADR-013-cpf-completo-csv-export.md` —
não a reverte.** O CPF continua saindo **completo** (11 dígitos, nenhum caractere oculto ou substituído) em
todo CSV, exatamente como a ADR-013 decidiu; esta ADR apenas padroniza a formatação da célula com pontuação
(`123.456.789-00`).

> **Nota sobre o título/arquivo:** este ADR nasceu com uma premissa equivocada. Uma primeira leitura do pedido
> do stakeholder ("mascarar o CPF no CSV") foi interpretada como redação parcial — o mesmo padrão usado na
> tela de Reconciliação (`123.***.**9-00`) — o que teria, de fato, revertido a ADR-013. O stakeholder corrigiu
> isso explicitamente: o pedido sempre foi apenas **formatação com pontuação**, sem ocultar nenhum dígito. O
> nome do arquivo (`ADR-014-mascarar-cpf-csv-supera-adr013.md`) é mantido por estabilidade de link/histórico,
> mas o conteúdo abaixo reflete a decisão corrigida — esta ADR não "mascara" nem "supera" a ADR-013.

## Contexto

A ADR-013 (2026-07-03) decidiu manter o CPF **completo** (11 dígitos) na coluna `cpf` de todo CSV gerado pelo
`AdminPanel` (`src/standalone/lib/leadsCsv.ts`), sem nenhuma formatação de exibição — a coluna sai como a
string crua armazenada (ex.: `12345678900`). **Essa decisão permanece vigente e não é alterada por esta ADR.**

O que esta ADR decide é mais estreito: aplicar à célula `cpf` do CSV a mesma formatação com pontuação padrão
(`123.456.789-00`) já produzida pela máscara de **digitação** do formulário de captura (`applyCpfMask`,
`src/lead-capture/mask/cpfMask.ts`) — sem ocultar, substituir ou remover nenhum dos 11 dígitos originais.

### Por que formatar, se não é para reduzir exposição de PII?

Nenhuma formatação de pontuação reduz a sensibilidade do dado — os 11 dígitos completos continuam presentes e
recuperáveis no arquivo, exatamente como na ADR-013. Esta ADR **não** move o CPF para dentro de nenhuma
fronteira de proteção adicional nem diminui o risco de LGPD do arquivo exportado (a análise de
"Mitigações LGPD" da ADR-013 continua valendo integralmente, sem nenhuma redução de severidade a anunciar).

A justificativa real é de **usabilidade/legibilidade operacional**: quem confere o CSV manualmente durante a
apuração do sorteio (cruzar CPFs, identificar excedentes, comparar com documento físico) lê e digita com mais
confiabilidade um CPF pontuado do que 11 dígitos corridos — é mais fácil de escanear visualmente e reduz erro
de transcrição humana. Esse ganho é modesto e não deve ser confundido, em nenhuma comunicação futura, com
redução de risco de dado pessoal.

### Correção de uma versão anterior desta ADR

Uma primeira versão desta entrega tratou o pedido como redação parcial (mesma regra da tela de Reconciliação,
`maskCpfForDisplay`, `123.***.**9-00`) e chegou a formalizar isso como reversão da ADR-013, com uma alegação de
"redução de exposição de PII". O stakeholder corrigiu essa leitura explicitamente: o pedido nunca foi ocultar
dígitos. Essa correção **invalida** a alegação anterior de redução de risco — removida desta versão da ADR
(ver "Consequências" abaixo, que já reflete apenas o que de fato muda: legibilidade, não segurança).

## Decisão

1. **Toda coluna `cpf` de todo CSV gerado pelo sistema sai formatada com pontuação padrão**
   (`123.456.789-00`) — os 11 dígitos originais permanecem 100% visíveis e completos; nenhum caractere é
   ocultado, substituído por `*` ou removido. Vale para os três geradores de CSV: export online (`AdminPanel`,
   RPC `admin_list_leads`), export offline (`offlineExportPin`, leads do IndexedDB local) e o export automático
   que antecede a exclusão de leads (Story 2, HUB-150, ver ADR-015).
2. **CPF nulo/vazio permanece vazio** na célula — sem lançar erro, sem valor sintético.
3. **O código sentinela de participante estrangeiro** `111.111.111-11` (HUB-109) recebe a mesma formatação dos
   demais — nenhum branch especial é introduzido.
4. **Cabeçalho do CSV não muda** — só o valor da célula.
5. **A formatação reaproveita a função de máscara de digitação já existente** — `applyCpfMask`,
   `src/lead-capture/mask/cpfMask.ts` — chamada com o CPF completo já armazenado (`applyCpfMask(cpf ?? '')`).
   **Nenhum módulo novo é criado.** Diferente de uma versão anterior desta ADR, não há extração de
   `maskCpfForDisplay` para um módulo compartilhado, porque CSV e tela de Reconciliação passam a usar **funções
   diferentes**, cada uma com seu propósito: a tela continua com redação parcial (`maskCpfForDisplay`,
   inalterada, privada a `AdminPanel.tsx`); o CSV usa formatação completa (`applyCpfMask`).
6. **A tela de Reconciliação do Admin não muda em nada** — continua usando `maskCpfForDisplay` (redação
   parcial), sem nenhuma alteração de comportamento, arquivo ou import.
7. **A apuração antifraude (dedup, contagem, identificação de excedentes) não é afetada** — já operava (e
   continua operando) sobre o CPF completo em memória/banco (RPC `check_cpf_participation`, RPC
   `admin_list_leads`, `IndexedDB` local, `findParticipationOverages`); a formatação é aplicada só no último
   passo de escrita da célula do CSV, nunca antes.
8. `docs/adr/ADR-013-cpf-completo-csv-export.md` tem seu `Status` atualizado para refletir que continua **em
   vigor** (não substituído) e é **complementado** por esta ADR — a ADR-013 continua sendo a decisão de fundo
   (CPF completo no CSV); esta ADR só acrescenta a formatação.

## Consequências

### Positivas

- Legibilidade/usabilidade um pouco melhor para quem confere o CSV manualmente na apuração (CPF pontuado é
  mais fácil de ler/digitar do que 11 dígitos corridos) — ganho modesto e explicitamente **não** de segurança.
- Reaproveita 100% uma função já existente e testada (`applyCpfMask`) — zero lógica de máscara nova a
  escrever/testar; menor superfície de mudança do que a extração de módulo cogitada anteriormente teria
  exigido.
- Fecha uma pequena inconsistência de apresentação: a tela de Reconciliação já mostra o CPF formatado (ainda
  que parcialmente) e o CSV, até então, saía sem nenhuma pontuação ("cru").
- **Não introduz nenhuma lacuna operacional nova.** Como o CPF continua 100% completo no arquivo, não existe
  necessidade de nenhum canal alternativo (ex.: Supabase Table Editor) para casos de desclassificação por CPF
  exato — o CSV sozinho já sustenta essa conferência, exatamente como a ADR-013 original previa. A "lacuna do
  Table Editor" cogitada numa versão anterior desta ADR **não existe** com a decisão corrigida.
- **Resolve por completo um risco identificado para a Story 2 (Limpeza de Leads, HUB-150):** o export
  automático que antecede a exclusão de leads (HUB-153) usa a mesma formatação (não redação) desta ADR. Como o
  CPF completo permanece no arquivo de arquivamento gerado no momento da limpeza, **não há perda de capacidade
  de apuração/desclassificação por CPF exato** depois que os leads são apagados do banco — o arquivo continua
  sendo uma trilha completa e recuperável, não uma trilha parcial/mascarada. Ver
  `docs/specs/mascarar-cpf-csv-limpeza-leads.md`, seção "Riscos Técnicos Transversais".

### Negativas / Trade-offs

- **Nenhuma redução de exposição de PII ou de risco LGPD.** O CPF completo continua saindo do perímetro
  controlado pelo app no momento do download, exatamente como na ADR-013. A orientação LGPD do
  `guia-operador.md` (seção "LGPD — o arquivo de leads exportado") **não precisa de reescrita de fundo** — no
  máximo recebe uma nota de que a célula agora vem pontuada (mesmos 11 dígitos, mesma política de retenção e
  descarte da ADR-013). Não há novo "canal" a documentar, nem redução de severidade a anunciar.
- Disciplina de code review: qualquer novo gerador de CSV introduzido no futuro precisa lembrar de aplicar
  `applyCpfMask` à célula `cpf` — não há um "único ponto de entrada" garantido no nível de tipos. Mitigação:
  `buildLeadsCsv` é hoje o único construtor de CSV do projeto; qualquer novo gerador deve reutilizá-lo em vez
  de montar linhas manualmente.
- Dois pontos de código tratam o mesmo dado (`cpf`) de duas formas diferentes por design (tela = redação
  parcial via `maskCpfForDisplay`; CSV = formatação completa via `applyCpfMask`) — um futuro dev que não ler
  esta ADR pode confundir os dois e "corrigir" um para bater com o outro. Mitigação: comentário explícito em
  ambos os call sites apontando para esta ADR.

## Consistência com HUB-95

O texto da ADR-013 já registrava a HUB-95 (identidade do controlador de dados pendente de confirmação
jurídica) como pendência que exigiria revisão futura da orientação LGPD do export. Esta ADR **não depende** da
HUB-95 (é uma decisão de formatação, ortogonal à identidade do controlador e à quantidade de PII exposta) e
**não altera em nada** o texto já registrado na ADR-013 sobre essa pendência.
