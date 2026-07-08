# ADR-015 — `admin_purge_leads`: exclusão via duas chamadas sequenciais (export então delete)

**Data:** 2026-07-07
**Status:** Aceita (decisão explícita do stakeholder, 2026-07-07). O stakeholder optou pela **alternativa (a)**
abaixo — duas chamadas de rede sequenciais — mesmo ciente do risco de janela de corrida que ela reabre (ver
"Consequências / Negativas", risco residual **aceito conscientemente**, não eliminado).

> **Nota sobre o título/arquivo:** este ADR foi originalmente proposto com a alternativa (b) — uma RPC única e
> atômica (`DELETE ... RETURNING`) — como recomendação do Tech Lead, por eliminar a janela de corrida. O
> stakeholder, consultado, **rejeitou explicitamente essa recomendação** e escolheu manter o design de duas
> chamadas sequenciais (alternativa (a)), priorizando a fidelidade literal ao pedido original ("primeiro
> exporta, depois apaga, como dois passos distintos") sobre a eliminação técnica da janela de corrida. O nome
> do arquivo (`ADR-015-admin-purge-leads-rpc-atomica.md`) é mantido por estabilidade de link/histórico; o
> conteúdo abaixo reflete a decisão real.

## Contexto

A Story 2 (HUB-150, "Limpeza de Leads") introduz a **primeira operação de exclusão definitiva (`DELETE`)** do
projeto sobre a tabela `leads`. Até aqui, todo objeto de banco `SECURITY DEFINER` do projeto
(`check_cpf_participation`, ADR-011; `admin_list_leads`, ADR-012) é **somente leitura** — nenhum precedente de
exclusão existe. Isso muda a natureza do risco: um bug ou race condition aqui **destrói dado real e
irreversível**, não apenas vaza leitura.

O pedido do PO descreve a sequência como dois passos distintos e ordenados: "(1) gera automaticamente um
export CSV completo do evento atual — a deleção só inicia se esse export concluir com sucesso; (2) a deleção
remove os leads". Uma implementação literal disso como **duas chamadas de rede sequenciais** (reutilizar
`admin_list_leads`/`listAdminLeads` para o export, depois uma segunda RPC `admin_purge_leads` só para deletar)
tem uma falha de concorrência real:

> Entre a primeira chamada (lista os leads para exportar) e a segunda (deleta), existe uma janela de tempo
> em que uma nova captura de lead pode ser inserida (o app está desenhado para captura contínua e concorrente,
> `leadsSync.ts`/INSERT anônimo). Uma linha inserida **nessa janela** não apareceria no CSV (já foi gerado
> antes dela existir) mas **seria apagada** pelo segundo `DELETE` (que reavalia `WHERE event_id = ...` no
> momento da própria execução) — perda de dado sem exportação, exatamente o que a sequência bloqueante do PO
> pretende impedir.

O Tech Lead apresentou essa mecânica ao stakeholder com o mesmo nível de detalhe registrado acima, junto com a
alternativa (b) que a eliminaria por construção. **O stakeholder optou, ainda assim, por manter a alternativa
(a)** — ver "Decisão do stakeholder" abaixo.

## Alternativas Consideradas

### (a) Duas RPCs sequenciais — export-then-delete (escolhida)

Reaproveitar `admin_list_leads`/`listAdminLeads` (sem nenhuma modificação) para o export e criar uma segunda
RPC `admin_purge_leads`, agora **só de exclusão** (sem retornar linhas — o cliente já as tem da chamada de
leitura anterior), chamadas em sequência pelo cliente.

- **A favor:** mapeamento literal e direto da redação do PO; reaproveita 100% a RPC de leitura já existente e
  testada, sem nenhuma modificação; a RPC de exclusão fica mais simples e estritamente focada (delete +
  contagem + auditoria), sem precisar retornar `SETOF leads` nem o cliente lidar com o shape de `RemoteLead`
  numa resposta de delete. Se a montagem/disparo do download falhar no cliente **antes** da segunda chamada
  (cenário raro: falha de `Blob`/DOM), nada foi apagado ainda — o operador pode tentar de novo sem qualquer
  perda de dado (melhora em relação à alternativa (b), onde o `DELETE` já teria sido commitado nesse mesmo
  ponto de falha).
- **Contra:** janela de corrida entre as duas chamadas de rede (~dezenas a centenas de ms, mais o tempo de
  processamento client-side entre elas) permite perda silenciosa de dado exatamente no caso que a sequência
  pretende evitar (ver Contexto). Dois round-trips onde um resolveria; mais um ponto de falha parcial para
  tratar no cliente (o que fazer se a 1ª chamada sucede e a 2ª falha) — mitigado pelos estados (C)/(E) já
  previstos no design do modal (ver spec técnica).

### (b) RPC única, atômica, via `WITH deleted AS (DELETE ... RETURNING *) ...` (considerada e não escolhida)

Uma única função `admin_purge_leads` que, **dentro do mesmo statement SQL**, deleta as linhas do evento e
retorna exatamente as linhas deletadas — nunca há um "SELECT" separado de um "DELETE" separado; é uma única
instrução `DELETE ... RETURNING` (encadeada via CTE de escrita) que define atomicamente "o que foi apagado" =
"o que será exportado". A auditoria seria gravada na **mesma** CTE, então logging e exclusão nunca divergiriam.

```sql
-- Desenho não escolhido — mantido aqui apenas como registro do que foi avaliado e por quê
-- o risco de janela de corrida da alternativa (a) existe e foi conscientemente aceito.
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
```

- **A favor (por que o Tech Lead recomendou):** elimina inteiramente a janela de corrida da alternativa (a) —
  não existe instante entre "ver os dados" e "apagar os dados", são a mesma operação atômica no MVCC do
  Postgres. Uma única chamada de rede (menos superfície de falha parcial no cliente). Qualquer erro **depois**
  do `DELETE` dentro da função (ex.: falha ao inserir a linha de auditoria) desfaz a transação inteira,
  inclusive o `DELETE` — garantia transacional mais forte do que a sequência bloqueante pedida pelo PO.
- **Contra (por que o stakeholder não escolheu):** muda a sequência **literal** pedida pelo PO — a exclusão
  remota já ocorre (commitada) no momento em que a RPC responde; a montagem/download do CSV acontece
  **depois**, no cliente, a partir das linhas já retornadas. Se a montagem do CSV falhar no cliente **depois**
  da RPC responder, os dados já foram apagados do servidor (mitigável via estado em memória, mas ainda assim
  uma inversão da ordem intuitiva "primeiro exporta, depois apaga" pedida originalmente).

### (c) Soft delete (flag `deleted_at` em vez de `DELETE` físico) — rejeitada

Marcar as linhas como excluídas em vez de removê-las fisicamente.

- **Rejeitada:** contraria o objetivo de negócio explícito da feature (reduzir retenção de dado pessoal depois
  da apuração do sorteio — LGPD). Um soft delete manteria o CPF completo e demais PII no banco indefinidamente,
  exigindo ainda filtrar `deleted_at IS NULL` em toda leitura futura (`admin_list_leads`,
  `check_cpf_participation`) — mais superfície de bug (esquecer o filtro em algum ponto reabriria acesso a
  dado que deveria estar apagado) para resolver um problema que o PO não pediu (não há requisito de
  "recuperar" leads depois da limpeza).

## Decisão

Adotar a **alternativa (a)** — decisão explícita do stakeholder, não do Tech Lead.

1. **Nova tabela `leads_purge_audit`**, independente de `leads` (sobrevive à exclusão), sem policies de acesso
   direto (mesmo padrão de `admin_secrets`, ADR-012) — só a função `SECURITY DEFINER` escreve. **Schema
   idêntico ao originalmente proposto** — a mudança de design (a) vs. (b) não altera nenhuma coluna:

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

2. **A leitura para export reaproveita 100% a RPC/função cliente já existentes** — `admin_list_leads` /
   `listAdminLeads` (`src/standalone/lib/adminLeads.ts`), sem nenhuma modificação de assinatura ou
   comportamento. Nenhuma RPC nova de leitura é criada.

3. **Nova RPC `admin_purge_leads(p_event_id, p_secret, p_device_id, p_export_filename)`**, agora **só de
   exclusão** — não retorna as linhas apagadas (o export já ocorreu antes, via passo 2), só a contagem:

   ```sql
   CREATE OR REPLACE FUNCTION public.admin_purge_leads(
     p_event_id        text,
     p_secret          text,
     p_device_id       text,
     p_export_filename text DEFAULT NULL
   )
   RETURNS integer  -- purged_count; não há mais RETURNING de linhas (o export já ocorreu
                    -- antes desta chamada, via admin_list_leads/listAdminLeads)
   LANGUAGE plpgsql
   VOLATILE
   SECURITY DEFINER
   SET search_path = public
   AS $$
   DECLARE
     v_hash text;
     v_purged_count integer;
   BEGIN
     SELECT secret_hash INTO v_hash FROM admin_secrets WHERE event_id = p_event_id;
     IF v_hash IS NULL OR extensions.crypt(p_secret, v_hash) <> v_hash THEN
       RAISE EXCEPTION 'unauthorized' USING errcode = '28000';
     END IF;

     IF p_device_id IS NULL OR length(trim(p_device_id)) = 0 THEN
       RAISE EXCEPTION 'invalid device id' USING errcode = '22023';
     END IF;

     WITH deleted AS (
       DELETE FROM leads
       WHERE event_id = p_event_id
       RETURNING 1
     )
     SELECT count(*) INTO v_purged_count FROM deleted;

     INSERT INTO leads_purge_audit (event_id, purged_count, device_id, export_filename)
     VALUES (p_event_id, v_purged_count, p_device_id, p_export_filename);

     RETURN v_purged_count;
   END;
   $$;

   REVOKE ALL ON FUNCTION public.admin_purge_leads(text, text, text, text) FROM PUBLIC;
   GRANT  EXECUTE ON FUNCTION public.admin_purge_leads(text, text, text, text) TO anon;
   ```

   **Importante — a contagem nunca vem do cliente.** `purged_count` é sempre calculado **dentro da própria
   função**, a partir do seu próprio `DELETE ... RETURNING` — nunca é um parâmetro vindo do cliente (evitaria
   depender de uma contagem client-side potencialmente dessincronizada da linha que de fato foi apagada no
   servidor, ex.: se a janela de corrida inseriu leads novos entre a listagem e o delete). Isso preserva, numa
   escala menor, a mesma disciplina de atomicidade da alternativa (b): o `DELETE` e a auditoria (`INSERT`)
   continuam acontecendo dentro da **mesma** transação implícita da função — o que deixa de ser atômico é
   apenas a relação entre "o que foi listado para export" (chamada 1) e "o que foi apagado" (chamada 2), não a
   relação entre "o que foi apagado" e "o que foi auditado" (ambas continuam na chamada 2, atômicas entre si).

   A auditoria é gravada **mesmo quando `purged_count = 0`** (evento já vazio) — toda tentativa de limpeza fica
   registrada, inclusive as que não apagaram nada.

4. **Escopo estritamente por `event_id`** — não existe (e não deve existir) nenhuma variante da função que
   aceite "apagar tudo" ou opere sem filtro de evento. Mesmo um `p_event_id` incorreto só afeta aquele evento.

5. **`device_id` é gerado e persistido no cliente** (`localStorage`, UUID v4), não é identidade de usuário —
   documentar explicitamente a limitação já aceita em ADR-012 (acesso por segredo compartilhado, sem usuário
   nomeado): o campo identifica **o navegador/dispositivo**, não uma pessoa.

### Não-objetivos e esclarecimentos

- **Esta ADR não garante que o arquivo chegou ao disco do operador antes do `DELETE` ser commitado no
  servidor** — essa garantia é tecnicamente inatingível em um SPA (o browser não expõe nenhum evento "o
  download terminou de gravar"). "Sucesso do export" é definido operacionalmente como: RPC de leitura
  respondeu com sucesso → `Blob` construído → download disparado sem lançar exceção. Isso deve estar refletido
  nos critérios de aceite testáveis pelo QA (não pedir um teste de "arquivo confirmadamente salvo em disco" —
  não observável). **Diferença em relação à alternativa (b):** aqui, se a montagem/disparo do download falhar
  **antes** da segunda chamada (delete), nada foi apagado ainda — o operador pode tentar de novo sem qualquer
  perda de dado.
- **A janela de corrida entre exportar e apagar é real, não hipotética, e foi conscientemente aceita pelo
  stakeholder** (ver "Decisão do stakeholder" e "Consequências / Negativas" abaixo). Não há, nesta entrega,
  nenhuma mitigação técnica para ela (nenhum lock, nenhuma segunda verificação de "há leads novos desde o
  export?") — é risco residual aceito, não risco não avaliado ou esquecido.
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

### Decisão do stakeholder — REGISTRADA (2026-07-07)

O Tech Lead recomendou a alternativa (b) (RPC atômica) por eliminar a janela de corrida, apresentando ao
stakeholder a mesma mecânica de risco descrita em "Contexto" acima. **O stakeholder, consultado, escolheu
explicitamente a alternativa (a)** — duas chamadas sequenciais — mesmo diante do risco apresentado com essa
clareza técnica. A justificativa é priorizar a fidelidade literal ao pedido original ("primeiro exporta,
depois apaga, como dois passos distintos") sobre a garantia de atomicidade que a alternativa (b) ofereceria.
Esta é tratada como decisão **definitiva** para este design — não é mais uma proposta pendente de aceite, e
não deve ser revertida para (b) no futuro sem uma nova decisão explícita de arquitetura (nova ADR).

## Consequências

### Positivas

- Reaproveita 100% a RPC de leitura já existente e testada (`admin_list_leads` / `listAdminLeads`) para o
  export — zero código novo nessa perna do fluxo.
- A RPC de exclusão fica mais simples e estritamente focada (delete + contagem + auditoria) — não precisa
  retornar `SETOF leads` nem o cliente lidar com o shape de `RemoteLead` numa resposta de delete.
- Fidelidade literal ao pedido original do PO ("primeiro exporta, depois apaga, como dois passos distintos") —
  sem reinterpretação arquitetural que o stakeholder não pediu.
- Se a montagem/disparo do download falhar no cliente (Blob/DOM, cenário raro) **antes** da segunda chamada,
  nada foi apagado ainda — o operador pode tentar de novo sem qualquer perda de dado (melhora em relação à
  alternativa (b), onde o `DELETE` já teria sido commitado antes desse mesmo tipo de falha).
- A trilha de auditoria (`leads_purge_audit`) continua atômica com o próprio `DELETE` **dentro da segunda
  chamada** (delete + contagem + insert de auditoria nunca divergem entre si nessa chamada) — a atomicidade que
  se perde é só entre "export" (chamada 1) e "delete" (chamada 2), não entre "delete" e "log" (ambos na chamada
  2).
- Reaproveita integralmente o padrão de segurança já aceito (`SECURITY DEFINER` + segredo bcrypt +
  `search_path` fixo, ADR-011/012) — nenhuma nova classe de credencial ou de ataque introduzida.
- Escopo por `event_id` obrigatório no contrato da função — não existe caminho de código que apague
  cross-evento.

### Negativas / Trade-offs

- **Risco residual aceito pelo stakeholder — janela de corrida entre exportar e apagar.** Existe uma janela de
  tempo real entre a chamada 1 (`admin_list_leads`/`listAdminLeads`, lista os leads para exportar) e a chamada
  2 (`admin_purge_leads`, apaga) em que uma nova captura de lead pode ser inserida (o app permite captura
  contínua/concorrente, `leadsSync.ts`). Uma linha inserida nessa janela **não aparece** no CSV já gerado (foi
  montado antes de ela existir) mas **é apagada** pelo `DELETE` da segunda chamada (que reavalia
  `WHERE event_id = ...` no momento da própria execução) — perda de dado sem exportação. Este é exatamente o
  cenário que a alternativa (b) eliminava por construção; o stakeholder foi informado dessa mecânica com o
  mesmo nível de detalhe registrado nesta ADR e optou conscientemente por aceitá-la. **Não há mitigação técnica
  nesta entrega** (nenhum lock, nenhuma segunda verificação de "há leads novos desde o export?") — é risco
  residual aceito, não risco não avaliado ou esquecido. Deve permanecer documentado (código, spec,
  `guia-operador.md`/copy do modal) — nunca silenciado ou "otimizado" informalmente no futuro sem nova ADR.
- Dois round-trips de rede em vez de um — mais um ponto de falha parcial que o cliente precisa tratar
  explicitamente (chamada 1 falha vs. chamada 2 falha são dois estados distintos, já previstos no design do
  modal — estados (C) e (E), ver spec técnica).
- Primeira operação destrutiva do projeto sobre `leads` continua exigindo rigor extra de code review — mas o
  foco do veto do Tech Lead **muda de direção**: antes, vetaria qualquer versão que **separasse** export e
  delete (essa era a alternativa então rejeitada); agora, a versão aceita **é** a separação — o code review
  deve garantir, em vez disso, que (1) a chamada de delete nunca é disparada sem uma chamada de export
  bem-sucedida imediatamente antes, e (2) o risco de janela de corrida está documentado no código (comentário)
  e no `guia-operador.md`/copy do modal, nunca escondido ou silenciado.
- Reintroduz, em maior escala, a fragilidade já conhecida do projeto de não versionar `supabase/migrations`
  (mesma nota negativa já registrada em ADR-011/012/014) — mais um objeto de banco sensível documentado apenas
  em `docs/services-checklist.md`.
- `device_id` gerado por `localStorage` é trivialmente falsificável/limpável pelo próprio operador do
  dispositivo — a trilha de auditoria é, portanto, informativa/best-effort quanto à origem do dispositivo, não
  uma prova forense forte. Suficiente para o objetivo declarado (registro mínimo de rastreabilidade), não para
  disputa jurídica.
