# ADR-011 — CPF como coluna dedicada + RPC `SECURITY DEFINER` para dedup/contagem

**Data:** 2026-07-02
**Status:** Proposto

## Contexto

A feature HUB-87 (antifraude) exige que o formulário de lead valide o CPF do participante e verifique
**online**, antes de liberar o jogo, quantas vezes aquele CPF já participou daquela ativação — para aplicar
um limite configurável (`maxParticipations`). Isso é uma mudança de natureza diferente de tudo que o projeto
fez até aqui:

1. Até hoje o Supabase é usado apenas como **destino de escrita** (INSERT) e, no Admin, leitura em massa
   (`SELECT *`) protegida só por PIN de UI. Não existe nenhuma função de banco (RPC) no projeto.
2. O app é 100% estático/client-side com `anon key` exposta no bundle (ADR-001) — não há backend próprio
   para esconder lógica de negócio.
3. A consulta "este CPF já jogou X vezes nesta ativação?" não pode ser resolvida com um `SELECT` direto do
   cliente sem expor a tabela inteira de `leads` (nomes, e-mails, telefones e agora CPFs de **todos** os
   participantes) a qualquer visitante que abra o DevTools no totem — a `anon key` já está no bundle público.
4. CPF é dado de maior sensibilidade que nome/e-mail/telefone (identificador único de pessoa física perante
   o Estado) — a barra de proteção precisa ser mais alta do que a hoje aplicada aos demais campos.

## Decisão

1. **CPF vira coluna dedicada** `leads.cpf` (texto, 11 dígitos normalizados, `CHECK` de formato), em vez de
   viver apenas dentro de `data jsonb`. Índice composto `(event_id, cpf)` para contagem eficiente por
   ativação (participação é escopada por `event_id` — o mesmo CPF pode jogar em eventos diferentes sem
   herdar o contador de outro evento).
2. **A consulta de dedup/contagem é feita via função Postgres `check_cpf_participation(p_event_id, p_cpf)`,
   `SECURITY DEFINER`**, chamada pelo cliente via `supabase.rpc(...)`. A função roda com privilégio do
   owner (ignora RLS) e devolve **apenas** `{ participation_count, last_lead_data }` — nunca a linha
   completa, nunca outros CPFs, nunca dados de outros participantes. `search_path` fixado em `public`
   (mitiga *search_path hijacking* em funções `SECURITY DEFINER`, prática recomendada do Postgres).
3. **Fallback client-side é permissivo** (timeout de 3s ou erro de rede ⇒ trata como novo cadastro, libera o
   jogo, grava no IndexedDB) — reafirma o princípio já estabelecido na ADR-002 (disponibilidade > bloqueio),
   aplicado agora à checagem de fraude, não só à persistência.
4. **Achado correlato, fora do escopo desta ADR mas registrado aqui por relevância de segurança:** a policy
   `anon select` hoje concede `SELECT *` irrestrito em `leads` para o papel `anon` (usada pelo AdminPanel
   protegido só por PIN de UI, não por RLS real). Isso já era um risco antes desta feature; com CPF na
   mesma tabela, o risco escala de severidade (PII + identificador único de governo, não só contato). Este
   ADR **não** resolve esse ponto — ver recomendação na spec técnica HUB-87 (`docs/specs/HUB-87-cpf-antifraude.md`)
   para abertura de Issue de tech-debt dedicada.

## Consequências

### Positivas
- A checagem de fraude não depende de expor a tabela inteira via `SELECT` do cliente — o contrato de rede é
  mínimo (`{count, last_lead_data}`), não "toda a linha, todos os CPFs".
- Contagem sempre no servidor (fonte única de verdade), evitando lógica de contagem duplicada/divergente no
  cliente.
- Padrão reutilizável: primeira função de banco do projeto, mas o padrão (`SECURITY DEFINER` + retorno
  mínimo + `search_path` fixo) fica documentado para a próxima vez que o app precisar de lógica de servidor
  sem backend próprio.

### Negativas / Trade-offs
- Introduz o primeiro objeto de banco além de tabela/policy no projeto — aumenta a superfície de migração
  manual (o time não tem `supabase/migrations` versionado; SQL vive documentado em
  `docs/services-checklist.md`, mesmo padrão já usado para a coluna de LGPD).
- `SECURITY DEFINER` é um padrão que exige disciplina: qualquer alteração futura na função precisa manter a
  garantia de retorno mínimo — um dev apressado poderia "por conveniência" trocar o `RETURNS TABLE` por
  `SELECT *` e reabrir o vazamento que esta ADR fecha. Code review do Tech Lead deve vetar isso.
- Não resolve o vazamento pré-existente do `anon select` amplo (item 4) — mitigação parcial, não total.
