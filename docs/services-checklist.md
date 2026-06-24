# Checklist de Serviços — Jogo de Memória

> Ações que você (operador/dono do projeto) precisa executar nos serviços externos para que a aplicação esteja pronta para produção.
> Última atualização: 2026-06-24

---

## 1. Supabase — Banco de Dados

**Por quê:** Armazenamento dos leads em PostgreSQL gerenciado. Free tier suficiente para MVP.

### Passos

- [ ] **Criar conta** em [supabase.com](https://supabase.com) (gratuito)
- [ ] **Criar projeto**
  - Nome sugerido: `jogo-memoria`
  - Região: `South America (São Paulo)` — menor latência
  - Guardar a senha do banco gerada pelo Supabase (você precisará dela se for migrar)
- [ ] **Criar a tabela `leads`** — executar no SQL Editor do Supabase:

```sql
CREATE TABLE leads (
  id           uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id     text        NOT NULL,
  data         jsonb       NOT NULL,
  score        integer,
  time_taken   integer,
  played_at    timestamptz DEFAULT now(),
  synced_from  text        DEFAULT 'online',
  created_at   timestamptz DEFAULT now()
);

-- Habilitar Row Level Security
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;

-- Permitir INSERT para usuários anônimos (captura de lead durante o jogo)
CREATE POLICY "anon insert only"
  ON leads
  FOR INSERT
  TO anon
  WITH CHECK (true);

-- Permitir SELECT para usuários anônimos (painel admin e exportação CSV)
-- A anon key já está no bundle JS público; a proteção de UI é feita via PIN.
CREATE POLICY "anon select"
  ON leads
  FOR SELECT
  TO anon
  USING (true);
```

> **Se a tabela já existir** e você só precisar adicionar a política SELECT, execute apenas:
> ```sql
> CREATE POLICY "anon select"
>   ON leads
>   FOR SELECT
>   TO anon
>   USING (true);
> ```

- [ ] **Copiar as credenciais** em Project Settings → API:
  - `Project URL` → valor de `VITE_SUPABASE_URL`
  - `anon public key` → valor de `VITE_SUPABASE_ANON_KEY`
  - **Nunca expor a `service_role` key no frontend**

- [ ] **Verificar RLS ativo:** Table Editor → leads → RLS badge deve estar verde

### Acesso admin aos leads (após o evento)

Para visualizar/exportar leads via Supabase dashboard:
- Table Editor → leads → filtrar por `event_id`
- Ou usar o painel Admin do próprio jogo (export CSV)

---

## 2. Deploy — Cloudflare Pages (recomendado)

**Por quê:** Bandwidth ilimitado no free tier — crítico se múltiplos totens recarregarem o app simultaneamente. Proteção DDoS automática da rede Cloudflare.

### Passos

- [ ] **Criar conta** em [pages.cloudflare.com](https://pages.cloudflare.com) (gratuito)
- [ ] **Criar projeto Pages**
  - Conectar ao repositório GitHub do `jogo-memoria`
  - Build command: `npm run build`
  - Build output directory: `dist`
  - Framework preset: `Vite`
- [ ] **Configurar variáveis de ambiente** (Settings → Environment Variables):

| Variável | Valor | Ambiente |
|---|---|---|
| `VITE_SUPABASE_URL` | URL do seu projeto Supabase | Production + Preview |
| `VITE_SUPABASE_ANON_KEY` | anon key do Supabase | Production + Preview |

- [ ] **Verificar deploy:** Cloudflare gera uma URL `*.pages.dev` automáticamente
- [ ] **Testar a URL no totem** antes do evento

### Alternativa: Vercel

Se preferir Vercel (mais familiar):
- Mesmo processo de conexão ao GitHub
- Build command: `npm run build`, output: `dist`
- Adicionar as mesmas variáveis de ambiente
- **Atenção:** Vercel tem limite de 100 GB/mês no free tier — pode ser atingido em eventos grandes

---

## 3. GitHub — Repositório

- [ ] **Confirmar que o repositório existe** e está conectado ao Cloudflare Pages/Vercel
- [ ] **Configurar branch de produção:** `main` (ou `master`) faz deploy automático ao fazer push
- [ ] **Adicionar `.env.example`** ao repo com as variáveis sem valores reais:

```
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGc...
```

- [ ] **Garantir que `.env.local` está no `.gitignore`** (nunca commitar credenciais)

---

## 4. Preparação por Evento (checklist operacional)

A cada novo evento, o operador precisa:

- [ ] **Criar/editar `public/config.json`** com dados do evento:
  - `event.id` único (ex: `"evento-abc-jun2026"`)
  - `event.name`, `event.logo`, cores
  - `game.pairs` e `game.cardImages` com os assets do cliente
  - `leadForm.fields` com os campos desejados
  - `adminPin` (trocar a cada evento!)

- [ ] **Adicionar imagens** em `public/images/`:
  - Logo do evento
  - Imagens das cartas (mínimo `game.pairs` imagens)
  - Imagem do verso das cartas (`cardBack`)

- [ ] **Fazer push para o GitHub** → deploy automático

- [ ] **Testar a URL de produção** no dispositivo que será usado no evento

- [ ] **Anotar o PIN do admin** em local seguro (não no dispositivo)

---

## 5. Configuração do Dispositivo (totem/tablet)

- [ ] **Abrir no Chrome** (melhor suporte a PWA e modo quiosque)
- [ ] **Modo quiosque** (totem): iniciar Chrome com flags:
  ```
  google-chrome --kiosk --disable-pinch --overscroll-history-navigation=0 https://sua-url.pages.dev
  ```
- [ ] **Desabilitar sleep/screensaver** do sistema operacional
- [ ] **Fixar brilho da tela** (evitar auto-ajuste durante o evento)
- [ ] **Testar conectividade WiFi** do local antes do evento
- [ ] **Testar cenário offline:** desligar WiFi, jogar uma rodada, religar — verificar sync no Supabase

---

## 6. Monitoramento (opcional, recomendado)

Para acompanhar leads em tempo real durante o evento:

- [ ] **Supabase Realtime** (zero config): abrir Table Editor → leads no dashboard do Supabase — atualiza automaticamente
- [ ] **BetterStack** (uptime monitor gratuito): cadastrar a URL do app para alerta se cair
  - [betterstack.com](https://betterstack.com) → free tier: 10 monitores, verificação a cada 3 min

---

## 7. Migração Futura para o Hub

Quando o Hub de Ativações estiver pronto:

| Item | Ação | Esforço |
|---|---|---|
| Código do jogo | `src/game/` já é um Module Federation remote — expor via `vite.config.ts` | Horas |
| Leads históricos | `pg_dump` do Supabase → restore no Neon (Hub) | Minutos |
| Config do evento | Migrar `config.json` para `activation_config` JSONB no Manager API | Horas |
| Deploy | Desativar o deploy standalone — Hub passa a servir o plugin | — |

---

## Resumo de Custos

| Serviço | Plano | Custo |
|---|---|---|
| Supabase | Free (500 MB, projetos sem pausa) | R$ 0 |
| Cloudflare Pages | Free (bandwidth ilimitado) | R$ 0 |
| GitHub | Free | R$ 0 |
| BetterStack | Free (10 monitores) | R$ 0 |
| **Total** | | **R$ 0** |
