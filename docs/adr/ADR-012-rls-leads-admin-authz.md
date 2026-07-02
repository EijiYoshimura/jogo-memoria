# ADR-012 — RLS de `leads`: bloquear `SELECT` anônimo e autorizar o Admin via RPC `SECURITY DEFINER`

**Data:** 2026-07-02
**Status:** Aceito (decisão do stakeholder registrada em 2026-07-02 — ver seção "Decisão do stakeholder")

## Contexto

A policy hoje ativa em produção no Supabase (documentada em `docs/services-checklist.md`) concede
`SELECT *` irrestrito na tabela `leads` para o papel `anon`:

```sql
CREATE POLICY "anon select" ON leads FOR SELECT TO anon USING (true);
```

O app é 100% client-side/estático, sem backend próprio, e a `anon key` está exposta no bundle público do
totem (ADR-001). A combinação dessas duas coisas significa que **qualquer pessoa com DevTools no totem — ou
com a `anon key` extraída do bundle — consegue hoje `SELECT *` em `leads` e baixar nome, e-mail e telefone de
todos os participantes de todos os eventos daquele projeto Supabase**, sem passar pelo PIN do Admin. O PIN
protege apenas a UI (`AdminPanel.tsx`, compara `pin === config.adminPin` no cliente), **não** a rede.

Com CPF entrando na mesma tabela (HUB-87 / ADR-011), a severidade escala: o dado exposto passa a incluir um
identificador único de pessoa física perante o Estado. O achado foi registrado na spec técnica de HUB-87
(seção 2) como pré-existente e agravado, e priorizado pelo stakeholder para ser resolvido **antes** de
HUB-87.

O AdminPanel depende dessa policy ampla para duas leituras remotas (as únicas do projeto):

- `loadStats()` — `select('*', { count: 'exact', head: true })` para o card "Sincronizados".
- `handleExportCsv()` — `select('*')` para compor o CSV com os leads já sincronizados.

Fechar a policy sem redesenhar esse acesso quebraria o Admin. Este ADR decide **como** redesenhar a
autorização de leitura do Admin de forma que a `anon key` sozinha deixe de ser suficiente para ler a tabela,
sem quebrar (a) a captura de lead anônima (INSERT) e (b) o export offline via IndexedDB (ADR-002/ADR-006).

## Alternativas Consideradas

### (a) Supabase Auth real para o operador

RLS de `SELECT` restrita ao papel `authenticated`; o operador faz login (e-mail + senha) e a leitura passa a
exigir um JWT emitido pelo GoTrue. Anon mantém apenas INSERT.

- **A favor:** identidade real server-enforced; JWT padrão e revogável; RLS por papel/uid; sem criptografia
  ou rate-limiting caseiro; trilha de auditoria (`auth.users`); caminho natural se um dia houver múltiplos
  operadores nomeados.
- **Contra (no contexto real deste projeto):** muda a rotina do operador — hoje ele digita um PIN de 4-6
  dígitos num totem touch em modo quiosque (ADR-005); passar a exigir e-mail/senha por operador em evento
  presencial é atrito real. O **login exige rede**: o primeiro acesso num dispositivo não pode ser feito
  offline (o GoTrue é uma chamada HTTP), e a renovação de token em WiFi instável (ADR-002) pode falhar —
  colide com a premissa offline-first. Gestão de contas por evento/deploy é overhead operacional que o
  modelo "um PIN por evento no `config.json`" não tem.

### (b) RPC `SECURITY DEFINER` dedicada ao Admin (escolhida)

A policy ampla é derrubada (anon mantém só INSERT). Uma função Postgres `SECURITY DEFINER`, gated por um
**segredo do Admin verificado no servidor**, retorna os leads. O cliente troca `.from('leads').select(...)`
por `.rpc('admin_list_leads', ...)`. O segredo **sai do `config.json` público** e passa a viver como **hash**
numa tabela privada (`admin_secrets`), inacessível a `anon`, lida apenas de dentro da função `SECURITY
DEFINER` (que roda com privilégio do owner e ignora RLS).

- **A favor:** preserva a UX do operador (continua sendo "digitar um segredo", sem tela de login/rede para
  autenticar); reutiliza o padrão já decidido em ADR-011 (`SECURITY DEFINER` + `search_path` fixo + retorno
  controlado); blast radius mínimo no cliente (troca de duas chamadas); não adiciona runtime/deploy novo
  (mantém o modelo sem backend do ADR-001/ADR-004); a `anon key` sozinha deixa de ler a tabela.
- **Contra:** exige guardar/comparar o segredo à mão (mitigado com `pgcrypto`/bcrypt); um segredo de baixa
  entropia (PIN de 4 dígitos) é força-bruta-vel por quem tem a `anon key`, já que a RPC é executável por
  `anon` — exige elevar a entropia do segredo **ou** rate-limiting server-side; disciplina de `SECURITY
  DEFINER` (o retorno de linhas completas só pode ocorrer **após** a verificação do segredo — code review
  obrigatório).

### (c) Supabase Edge Function com `service_role` (rejeitada)

Uma função serverless que guarda a `service_role` key server-side, valida o segredo e devolve os leads. É a
resposta "de manual" (trust boundary real fora do Postgres), mas foi **rejeitada**: adiciona um runtime e uma
superfície de deploy que o projeto deliberadamente não tem (ADR-001/ADR-004, app estático sem backend), com
cold start no free tier, para resolver algo que a RPC `SECURITY DEFINER` já resolve **dentro** do Postgres —
o mesmo trust boundary server-side, sem novo serviço. Fica registrada como caminho futuro caso o app deixe de
ser puramente estático (ex.: integração ao Hub).

## Decisão

Adotar a **opção (b)**:

1. **Derrubar a policy `anon select`** de `leads`. O papel `anon` mantém **apenas** o INSERT
   (`anon insert only`) — a captura de lead segue funcionando sem autenticação do participante (Critério 4).

2. **Segredo do Admin sai do bundle público.** Criar tabela privada `admin_secrets(event_id, secret_hash)`
   com RLS habilitado e **sem policies** (nenhum papel lê/escreve por acesso direto); o hash é gerado com
   `pgcrypto`/bcrypt (`extensions.crypt` + `extensions.gen_salt('bf')`). O operador semeia o hash uma vez por
   evento no SQL Editor — **o segredo em texto puro nunca é commitado nem entra no `config.json`**.

3. **RPC `admin_list_leads(p_event_id, p_secret)` `SECURITY DEFINER`**, `search_path` fixo em `public`,
   pgcrypto schema-qualificado. A função **primeiro** verifica o segredo (`crypt(p_secret, v_hash) = v_hash`)
   e, só em caso de match, retorna as linhas de `leads` do evento; segredo ausente/errado ⇒
   `RAISE EXCEPTION 'unauthorized'` (Critério 3). `EXECUTE` concedido a `anon`; `SELECT` direto em `leads`
   permanece negado (Critério 1). O cliente deriva tanto o card de contagem quanto o CSV do mesmo retorno
   autorizado — uma única chamada autorizada, sem `SELECT` HEAD separado.

4. **Gate offline preservado (ADR-002/ADR-006).** O export local (IndexedDB) **não** depende da RPC nem de
   rede: quando offline, o AdminPanel abre em modo offline e exporta apenas os leads presentes no IndexedDB
   daquele dispositivo (`getAllLeads()`), exibindo os cards remotos como "indisponível offline". O gate
   offline da UI é intencionalmente fraco (protege apenas dados já fisicamente no totem, sob acesso físico) —
   ver "Decisão do stakeholder" abaixo; ele **não** é o controle de segurança do dado remoto, que passa a ser
   o segredo verificado no servidor.

5. **Ordem de rollout sem janela de quebra** (não derrubar a policy antes de o cliente usar a RPC):
   1. Criar `pgcrypto`, `admin_secrets` (+ semear hash) e a RPC — aditivo, não quebra nada.
   2. Fazer deploy do cliente já consumindo `admin_list_leads`.
   3. **Só então** `DROP POLICY "anon select"`.

### Não-objetivos e esclarecimentos (para o dev não perseguir o fix errado)

- **NÃO tentar esconder/ofuscar a `anon key` no bundle.** O que está no bundle/DevTools é apenas
  `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` (JWT com `role: anon`). Grep no repositório confirmou que
  **não há `service_role` key nem connection string Postgres** em `src/`, `public/` ou na raiz, e o `.env`
  está no `.gitignore` (a `anon key` nunca foi commitada). A `anon key` é **pública por design** do Supabase —
  esconder/ofuscar num SPA estático é impossível e dá falsa sensação de segurança. A mitigação correta é
  **RLS + grants + leituras privilegiadas atrás de `SECURITY DEFINER`/auth**, exatamente o que este ADR faz —
  não mascarar a chave.
- **Rotação da `anon key` é opcional/cosmética aqui.** Só seria obrigatória se um `service_role` tivesse
  vazado — não é o caso. Pode ser feita por higiene, mas não é parte do fix.
- **O `config.json` público NÃO pode mais conter o `adminPin`.** Confirmado: `public/config.json` hoje traz
  `"adminPin": "3314"`, arquivo git-tracked **e** servido estaticamente — qualquer um faz `GET /config.json`
  e lê o PIN. Isso é vazamento real e é justamente o que a decisão (item 2) elimina: o segredo do Admin sai de
  todo artefato que o cliente baixa e passa a ser validado no servidor (o cliente **nunca** recebe o valor
  correto para comparar). Consequência operacional: o valor `3314` está **queimado** (público + histórico git)
  e deve ser **aposentado/trocado** no rollout, nunca reutilizado como novo segredo.
- **Remover o PIN do `config.json` daqui pra frente não o apaga do histórico git.** O commit que introduziu
  `"adminPin": "3314"` continua acessível via `git log`. Como o valor será aposentado no rollout (novo segredo
  server-side, sem relação com `3314`), o scrub do histórico é **cosmético e fica FORA do escopo** desta
  entrega — registrado aqui como nota; se o stakeholder quiser o scrub por higiene, vira tarefa própria
  (`git filter-repo`/BFG + force-push coordenado), não bloqueia HUB-88.

### Decisão do stakeholder — RESOLVIDA (2026-07-02)

**Resolução:** o stakeholder escolheu **b-TOKEN** — passphrase longa (≥ 12 chars, alta entropia), digitada 1x
por dispositivo, **sem** rate-limiting server-side (a entropia torna a força-bruta via RPC inofensiva por
construção). Para o **gate offline**, escolheu a opção **(i)**: manter um segredo local **separado e de baixo
valor** no `config`, documentado como gate **apenas de UI** para o export local do IndexedDB — distinto e sem
relação com a passphrase online. A tabela e a recomendação abaixo ficam registradas como o racional da escolha.

A arquitetura acima está fixada; o parâmetro que muda a experiência do operador (natureza do segredo) foi
decidido pelo stakeholder/operador, não pelo Tech Lead. As três variantes usam exatamente o mesmo desenho de
RPC — muda só a natureza do segredo:

| Variante | Segredo do Admin | UX do operador | Custo de segurança |
|---|---|---|---|
| **b-TOKEN** (recomendada) | Passphrase longa (≥ 12 chars, alta entropia), digitada 1x por dispositivo e lembrada localmente | Digita um segredo mais longo na 1ª vez em cada totem | Força-bruta inviável **sem** rate-limiting server-side |
| **b-PIN** | Mantém o PIN de 4-6 dígitos | Idêntica à de hoje | 10⁴–10⁶ combinações força-bruta-veis via RPC ⇒ **exige** rate-limiting/lockout server-side (tabela de tentativas por evento; bcrypt cost ~10 já limita a ~10-20 tentativas/s, mas sozinho não basta) |
| **a-AUTH** | Login Supabase Auth (e-mail + senha) | Tela de login; exige rede no 1º acesso | Mais forte; muda a rotina do operador e colide parcialmente com offline-first |

**Recomendação do Tech Lead:** **b-TOKEN**. Neutraliza a força-bruta por construção (entropia alta torna a
RPC executável por `anon` inofensiva mesmo sem lockout caseiro), mantém o modelo sem backend e o export
offline, e o atrito extra é uma única digitação por dispositivo. **b-PIN** é aceitável se o stakeholder
priorizar a conveniência do PIN de 4 dígitos, ao custo de implementarmos o lockout server-side. **a-AUTH** só
se o stakeholder quiser operadores nomeados/trilha de auditoria — aí o atrito de login e a dependência de rede
são justificados.

**Gate offline (sub-decisão ligada à de cima):** o `config.adminPin` público de hoje **não pode** ser o mesmo
valor do segredo online (se fosse, o segredo estaria público e a RPC seria trivialmente chamável por qualquer
um — anularia o fix). Duas saídas: (i) manter um `config.adminPin` **separado e de baixo valor**, documentado
como gate **apenas offline** do export local; ou (ii) remover o `config.adminPin` e, offline, abrir o export
local direto (aceitando que quem tem acesso físico ao totem offline exporta os leads daquele totem). Ambas são
compatíveis com o Critério 1 (que é sobre o `SELECT` remoto anônimo). Recomendo (i) pela consistência com o
comportamento atual, deixando explícito no código e nos docs que é gate de UI, não de rede.

## Consequências

### Positivas

- A `anon key` sozinha **deixa de conseguir ler** `leads` — fecha o vazamento pré-existente (Critério 1) e
  eleva a barra antes de HUB-87 introduzir CPF na tabela.
- O segredo do Admin sai do bundle público e passa a ser verificado no servidor (Critérios 2 e 3).
- Reutiliza o padrão de ADR-011 (`SECURITY DEFINER` + `search_path` fixo + retorno controlado) — consistência
  arquitetural, sem novo runtime/deploy (ADR-001/ADR-004 preservados).
- Captura de lead (INSERT anônimo) e export offline via IndexedDB seguem intactos (Critério 4, ADR-002/006).
- Blast radius mínimo no cliente: só `AdminPanel.tsx` muda (duas chamadas remotas → uma RPC autorizada);
  `leadsSync.ts` (INSERT) não é tocado.

### Negativas / Trade-offs

- Introduz um segundo objeto de banco sensível (tabela de segredo + função de autorização) sob migração
  **manual** (o projeto não versiona `supabase/migrations`; SQL vive em `docs/services-checklist.md`).
- `SECURITY DEFINER` que retorna linhas completas exige disciplina de review: a verificação do segredo **tem**
  que preceder qualquer `RETURN`/`SELECT` de linhas — um refactor descuidado reabriria o vazamento. Code
  review do Tech Lead deve vetar qualquer caminho que retorne linhas antes do check.
- Na variante **b-PIN**, o rate-limiting por evento tem tensão DoS vs. lockout (sem IP por chamada na RPC, um
  atacante poderia travar o operador real) — motivo adicional para preferir **b-TOKEN**.
- O gate offline permanece client-side (fraco por natureza), protegendo apenas o IndexedDB local sob acesso
  físico — exposição bem menor que a tabela remota inteira, mas não zero; aceito e documentado como fora do
  escopo do Critério 1.
- Passa a existir um passo operacional novo: semear/rotacionar o hash do segredo por evento no SQL Editor
  (documentar em `services-checklist.md` e `guia-operador.md`).
