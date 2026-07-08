# ADR-015 — `admin_purge_leads`: exclusão via `DELETE ... RETURNING` atômico + trilha de auditoria independente

**Data:** 2026-07-07
**Status:** Proposto (a validar pelo PO/stakeholder antes do início da implementação da HUB-YYY — ver
"Decisão do stakeholder — PENDENTE" abaixo)

## Contexto

A Story 2 (HUB-YYY, "Limpeza de Leads") introduz a **primeira operação de exclusão definitiva (`DELETE`)** do
projeto sobre a tabela `leads`. Até aqui, todo objeto de banco `SECURITY DEFINER` do projeto
(`check_cpf_participation`, ADR-011; `admin_list_leads`, ADR-012) é **somente leitura** — nenhum precedente de
exclusão existe. Isso muda a natureza do risco: um bug ou race condition aqui **destrói dado real e
irreversível**, não apenas vaza leitura.

O pedido do PO descreve a sequência como dois passos distintos e ordenados: "(1) gera automaticamente um
export CSV completo do evento atual — a deleção só inicia se esse export concluir com sucesso; (2) a deleção
remove os leads". Uma implementação literal disso como **duas chamadas de rede sequenciais** (ex.: reutilizar
`admin_list_leads` para o export, depois uma segunda RPC `admin_purge_leads` só para deletar) tem uma falha de
concorrência real:

> Entre a primeira chamada (lista os leads para exportar) e a segunda (deleta), existe uma janela de tempo
> em que uma nova captura de lead pode ser inserida (o app está desenhado para captura contínua e concorrente,
> `leadsSync.ts`/INSERT anônimo). Uma linha inserida **nessa janela** não apareceria no CSV (já foi gerado
> antes dela existir) mas **seria apagada** pelo segundo `DELETE` (que reavalia `WHERE event_id = ...` no
> momento da própria execução) — perda de dado sem exportação, exatamente o que a sequência bloqueante do PO
> pretende impedir.

## Alternativas Consideradas

### (a) Duas RPCs sequenciais — export-then-delete (rejeitada)

Reaproveitar `admin_list_leads` (ou uma cópia) para o export e criar uma segunda RPC `admin_purge_leads` só
para o `DELETE`, chamadas em sequência pelo cliente.

- **A favor:** mapeamento literal e direto da redação do PO; reaproveita a RPC de leitura já existente sem
  modificação.
- **Contra:** janela de corrida entre as duas chamadas de rede (~dezenas a centenas de ms) permite perda
  silenciosa de dado exatamente no caso que a sequência pretende evitar (ver Contexto). Dois round-trips onde
  um resolveria; mais um ponto de falha parcial para tratar no cliente (o que fazer se o 1º call sucede e o 2º
  falha, ou vice-versa).

### (b) RPC única, atômica, via `WITH deleted AS (DELETE ... RETURNING *) ...` (escolhida)

Uma única função `admin_purge_leads` que, **dentro do mesmo statement SQL**, deleta as linhas do evento e
retorna exatamente as linhas deletadas — nunca há um "SELECT" separado de um "DELETE" separado; é uma única
instrução `DELETE ... RETURNING` (encadeada via CTE de escrita) que define atomicamente "o que foi apagado" =
"o que será exportado". A auditoria é gravada na **mesma** CTE, então logging e exclusão nunca divergem (ou
os dois acontecem, ou nenhum, porque são a mesma transação implícita da função).

- **A favor:** elimina inteiramente a janela de corrida da alternativa (a) — não existe instante entre "ver os
  dados" e "apagar os dados", são a mesma operação atômica no MVCC do Postgres. Uma única chamada de rede
  (menos superfície de falha parcial no cliente). Qualquer erro **depois** do `DELETE` dentro da função (ex.:
  falha ao inserir a linha de auditoria) desfaz a transação inteira, inclusive o `DELETE` — a garantia
  transacional do Postgres é mais forte do que a sequência bloqueante pedida pelo PO (lá, uma falha no passo 1
  apenas *evita iniciar* o passo 2; aqui, uma falha em qualquer parte do único statement desfaz tudo).
  Reaproveita o padrão já aceito de `SECURITY DEFINER` + segredo bcrypt + `search_path` fixo (ADR-011/012) —
  nenhum novo tipo de credencial.
- **Contra:** muda a sequência **literal** pedida pelo PO — a exclusão remota já ocorre (commitada) no momento
  em que a RPC responde; a montagem/download do CSV acontece **depois**, no cliente, a partir das linhas já
  retornadas (não de uma nova consulta). Se a montagem do CSV falhar no cliente **depois** da RPC responder
  (cenário raro: falha de `Blob`/`URL.createObjectURL`/DOM), os dados já foram apagados do servidor — mas
  continuam disponíveis em memória no estado do componente (payload já recebido), permitindo um botão "tentar
  exportar novamente" sem nova chamada de rede. Ou seja: **o que a alternativa (b) garante é "nunca deleta sem
  ter capturado os dados para export"; o que ela não garante literalmente é "o arquivo já está no disco do
  operador antes do delete completar no servidor"** — essa garantia, à parte, é tecnicamente impossível de
  qualquer forma (ver "Não-objetivos" abaixo).

### (c) Soft delete (flag `deleted_at` em vez de `DELETE` físico) — rejeitada

Marcar as linhas como excluídas em vez de removê-las fisicamente.

- **Rejeitada:** contraria o objetivo de negócio explícito da feature (reduzir retenção de dado pessoal depois
  da apuração do sorteio — LGPD). Um soft delete manteria o CPF completo e demais PII no banco indefinidamente,
  exigindo ainda filtrar `deleted_at IS NULL` em toda leitura futura (`admin_list_leads`,
  `check_cpf_participation`) — mais superfície de bug (esquecer o filtro em algum ponto reabriria acesso a
  dado que deveria estar apagado) para resolver um problema que o PO não pediu (não há requisito de
  "recuperar" leads depois da limpeza).

## Decisão

Adotar a **alternativa (b)**.

1. **Nova tabela `leads_purge_audit`**, independente de `leads` (sobrevive à exclusão), sem policies de
   acesso direto (mesmo padrão de `admin_secrets`, ADR-012) — só a função `SECURITY DEFINER` escreve:

   ```sql
   CREATE TABLE IF NOT EXISTS leads_purge_audit (
     id               uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
     event_id         text        NOT NULL,
     purged_count     integer     NOT NULL,
     device_id        text        NOT NULL,
     export_filename  text,
     purged_at        timestamptz NOT NULL DEFAULT now()
   );
   ALTER TABLE leads_purge_audit ENABLE ROW LEVEL SECURITY;
   REVOKE ALL ON leads_purge_audit FROM anon, authenticated;
   ```

2. **RPC `admin_purge_leads(p_event_id, p_secret, p_device_id, p_export_filename)`**, `SECURITY DEFINER`,
   `search_path` fixo, verificação do segredo **antes** de qualquer `DELETE` (mesma disciplina de ADR-011/012):

   ```sql
   CREATE OR REPLACE FUNCTION public.admin_purge_leads(
     p_event_id        text,
     p_secret          text,
     p_device_id       text,
     p_export_filename text DEFAULT NULL
   )
   RETURNS SETOF leads
   LANGUAGE plpgsql
   VOLATILE
   SECURITY DEFINER
   SET search_path = public
   AS $$
   DECLARE
     v_hash text;
   BEGIN
     SELECT secret_hash INTO v_hash FROM admin_secrets WHERE event_id = p_event_id;
     IF v_hash IS NULL OR extensions.crypt(p_secret, v_hash) <> v_hash THEN
       RAISE EXCEPTION 'unauthorized' USING errcode = '28000';
     END IF;

     IF p_device_id IS NULL OR length(trim(p_device_id)) = 0 THEN
       RAISE EXCEPTION 'invalid device id' USING errcode = '22023';
     END IF;

     RETURN QUERY
     WITH deleted AS (
       DELETE FROM leads
       WHERE event_id = p_event_id
       RETURNING *
     ),
     logged AS (
       INSERT INTO leads_purge_audit (event_id, purged_count, device_id, export_filename)
       SELECT p_event_id, count(*), p_device_id, p_export_filename FROM deleted
       RETURNING 1
     )
     SELECT * FROM deleted;
   END;
   $$;

   REVOKE ALL ON FUNCTION public.admin_purge_leads(text, text, text, text) FROM PUBLIC;
   GRANT  EXECUTE ON FUNCTION public.admin_purge_leads(text, text, text, text) TO anon;
   ```

   A auditoria é gravada **mesmo quando `purged_count = 0`** (evento já vazio) — `count(*)` sobre um CTE vazio
   ainda produz uma linha com valor `0`, então toda tentativa de limpeza fica registrada, inclusive as que não
   apagaram nada.

3. **Escopo estritamente por `event_id`** — não existe (e não deve existir) nenhuma variante da função que
   aceite "apagar tudo" ou opere sem filtro de evento. Mesmo um `p_event_id` incorreto só afeta aquele evento.

4. **`device_id` é gerado e persistido no cliente** (`localStorage`, UUID v4), não é identidade de usuário —
   documentar explicitamente a limitação já aceita em ADR-012 (acesso por segredo compartilhado, sem usuário
   nomeado): o campo identifica **o navegador/dispositivo**, não uma pessoa.

### Não-objetivos e esclarecimentos

- **Esta ADR não garante que o arquivo chegou ao disco do operador antes do `DELETE` ser commitado no
  servidor** — essa garantia é tecnicamente inatingível em um SPA: o browser não expõe nenhum evento "o
  download terminou de gravar" depois de `<a download>.click()`/`URL.createObjectURL`. O que a alternativa (b)
  garante — e é o que importa para o objetivo de negócio — é que **as linhas deletadas e as linhas
  disponíveis para exportar são exatamente as mesmas**, sem risco de omissão por corrida. "Sucesso do export"
  é definido operacionalmente como: RPC respondeu com sucesso → `Blob` construído → download disparado sem
  lançar exceção. Isso deve estar refletido nos critérios de aceite testáveis pelo QA (não pedir um teste de
  "arquivo confirmadamente salvo em disco" — não observável).
- **Não introduz rate limiting/nonce/replay-protection na RPC.** Segue o modelo já aceito na ADR-012
  (b-TOKEN): quem possui o segredo pode chamar a função quantas vezes quiser; a operação é idempotente no
  resultado (uma segunda chamada após novas capturas apenas apura essas novas linhas e grava uma nova entrada
  de auditoria — não é uma falha de segurança nova, é a mesma superfície de privilégio já aceita para
  `admin_list_leads`).
- **Não resolve a consistência entre múltiplos dispositivos/totens do mesmo evento.** A exclusão local
  (IndexedDB) só afeta o dispositivo que executa a limpeza (ver spec técnica, seção de Segurança/Riscos da
  Story 2, e `docs/adr/ADR-002-indexeddb-offline-buffer.md`) — outro totem do mesmo evento com leads locais
  ainda não sincronizados **vai sincronizá-los normalmente depois da limpeza**, reintroduzindo dados que o
  operador acreditava apagados. Mitigação adotada: **operacional**, não técnica — orientar no
  `guia-operador.md` a sincronizar (Forçar Sync) todos os totens do evento antes de rodar a Limpeza de Leads.
  Uma solução técnica completa (lock distribuído por evento) é explicitamente **fora de escopo/YAGNI** dado o
  padrão de uso atual do projeto (poucos totens por evento).

### Decisão do stakeholder — PENDENTE

Diferente de ADR-011/012/013, esta ADR ainda **não** tem decisão de stakeholder registrada — está sendo
proposta juntamente com a spec técnica da HUB-YYY (`docs/specs/mascarar-cpf-csv-limpeza-leads.md`) e deve ser
formalmente aceita (ou emendada) pelo PO/stakeholder **antes** de qualquer worktree de implementação ser
aberto, conforme a regra do projeto ("Mudanças de arquitetura passam pelo Tech Lead antes de qualquer
implementação" + "Mudanças de arquitetura precisam de ADR antes da implementação").

## Consequências

### Positivas

- Elimina por construção a janela de corrida entre "o que é exportado" e "o que é apagado" — a garantia mais
  forte que a sequência bloqueante literal do PO pretendia obter.
- Uma única chamada de rede em vez de duas — menos superfície de falha parcial e menos estados intermediários
  para o cliente tratar.
- Reaproveita integralmente o padrão de segurança já aceito (`SECURITY DEFINER` + segredo bcrypt +
  `search_path` fixo, ADR-011/012) — nenhuma nova classe de credencial ou de ataque introduzida.
- Trilha de auditoria (`leads_purge_audit`) sobrevive à exclusão de `leads` por construção (tabela
  independente) e é gravada atomicamente junto com o `DELETE` — nunca diverge (ou os dois acontecem, ou
  nenhum).
- Escopo por `event_id` obrigatório no contrato da função — não existe caminho de código que apague
  cross-evento.

### Negativas / Trade-offs

- Primeira operação destrutiva do projeto sobre `leads` — exige rigor extra de code review (o Tech Lead deve
  vetar qualquer refactor futuro que separe o `SELECT`/export do `DELETE` em dois statements, reabrindo a
  janela de corrida que esta ADR fecha).
- A garantia de atomicidade é **apenas** entre "o que é apagado" e "o que é retornado para exportar" — não
  cobre a consistência entre dispositivos (ver "Não-objetivos"), que permanece um risco residual mitigado só
  operacionalmente.
- Reintroduz, em maior escala, a fragilidade já conhecida do projeto de não versionar `supabase/migrations`
  (mesma nota negativa já registrada em ADR-011/012) — mais um objeto de banco sensível documentado apenas em
  `docs/services-checklist.md`.
- `device_id` gerado por `localStorage` é trivialmente falsificável/limpável pelo próprio operador do
  dispositivo — a trilha de auditoria é, portanto, informativa/best-effort quanto à origem do dispositivo, não
  uma prova forense forte. Suficiente para o objetivo declarado (registro mínimo de rastreabilidade), não para
  disputa jurídica.
