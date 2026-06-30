# Guia do Operador

Este guia descreve como configurar e operar o Jogo da Memória em um evento, do zero ao totem funcionando.

---

## Índice

1. [Pré-requisitos](#pré-requisitos)
2. [Configurando o evento](#configurando-o-evento)
3. [Preparando as imagens](#preparando-as-imagens)
4. [Variáveis de ambiente](#variáveis-de-ambiente)
5. [Deploy para Cloudflare Pages](#deploy-para-cloudflare-pages)
6. [Configurando o totem (kiosk)](#configurando-o-totem-kiosk)
7. [Consentimento LGPD](#consentimento-lgpd)
8. [Teclado virtual](#teclado-virtual)
9. [Durante o evento](#durante-o-evento)
10. [Painel administrativo](#painel-administrativo)
11. [Exportando leads](#exportando-leads)
12. [Pós-evento — conferência de dados](#pós-evento--conferência-de-dados)

---

## Pré-requisitos

- Conta no [Supabase](https://supabase.com) com o projeto configurado (ver `docs/services-checklist.md`)
- Conta no [Cloudflare Pages](https://pages.cloudflare.com) ou acesso ao deploy já feito
- Acesso ao repositório para editar `public/config.json`

---

## Configurando o evento

Todo o comportamento do jogo é definido em **`public/config.json`**. Edite este arquivo antes de fazer o deploy do evento.

Exemplo completo:

```json
{
  "event": {
    "id": "tech-summit-2026",
    "name": "Tech Summit 2026",
    "logo": "https://cdn.exemplo.com/logo-tech-summit.png",
    "primaryColor": "#E11D48",
    "backgroundColor": "#1C1917"
  },
  "game": {
    "pairs": 6,
    "cardImages": [
      "https://cdn.exemplo.com/cards/produto-a.jpg",
      "https://cdn.exemplo.com/cards/produto-b.jpg",
      "https://cdn.exemplo.com/cards/produto-c.jpg",
      "https://cdn.exemplo.com/cards/produto-d.jpg",
      "https://cdn.exemplo.com/cards/produto-e.jpg",
      "https://cdn.exemplo.com/cards/produto-f.jpg"
    ],
    "cardBack": "https://cdn.exemplo.com/cards/verso.jpg",
    "timeLimitSeconds": 90,
    "autoResetSeconds": 20
  },
  "leadForm": {
    "title": "Cadastre-se para jogar!",
    "fields": [
      { "id": "name", "label": "Nome completo", "type": "text", "required": true },
      { "id": "email", "label": "E-mail corporativo", "type": "email", "required": true },
      { "id": "company", "label": "Empresa", "type": "text", "required": true },
      { "id": "phone", "label": "WhatsApp", "type": "tel", "required": false, "mask": "(99) 99999-9999" }
    ]
  },
  "adminPin": "9182"
}
```

Ver [Referência de Configuração](referencia-config.md) para descrição completa de cada campo.

---

## Preparando as imagens

### Requisitos das imagens

| Tipo | Dimensão recomendada | Formato | Observação |
|------|---------------------|---------|------------|
| Logo do evento | 300×120 px | PNG/SVG | Fundo transparente ou da cor de fundo |
| Frente das cartas | 400×400 px | JPG/PNG | Quadrado obrigatório |
| Verso das cartas | 400×400 px | JPG/PNG | Mesmo padrão das frentes |

### Onde hospedar as imagens

As imagens devem estar em um CDN público acessível via URL (HTTPS). Opções:

- **Cloudflare R2** (recomendado — gratuito até 10 GB/mês): faça upload no painel do Cloudflare, ative acesso público
- **Supabase Storage**: crie um bucket público, faça upload e copie a URL pública
- **GitHub + jsDelivr**: para imagens pequenas, commite em `/public/images/` e o Cloudflare Pages serve direto

Se usar imagens locais no projeto (dentro de `public/`), use caminhos relativos:

```json
"cardImages": ["/images/card-1.jpg", "/images/card-2.jpg"]
```

### Quantidade de imagens

`cardImages` deve ter exatamente `pairs` imagens (ou mais — o jogo usa apenas as primeiras `pairs`).

---

## Variáveis de ambiente

O jogo precisa de dois valores do Supabase. Configure no Cloudflare Pages em **Settings → Environment variables**:

| Variável | Onde encontrar no Supabase |
|----------|---------------------------|
| `VITE_SUPABASE_URL` | Project Settings → API → Project URL |
| `VITE_SUPABASE_ANON_KEY` | Project Settings → API → anon (public) key |

**Segurança:** use sempre a `anon` key, nunca a `service_role` key. A `anon` key é pública por design — o RLS do Supabase protege os dados (apenas INSERT é permitido para anon).

Para desenvolvimento local, crie o arquivo `.env.local` na raiz do projeto (já está no `.gitignore`, nunca comite):

```
VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

---

## Deploy para Cloudflare Pages

1. Conecte o repositório no Cloudflare Pages (GitHub → Pages → Create project)
2. Configure o build:
   - **Build command:** `npm run build`
   - **Output directory:** `dist`
   - **Node.js version:** 20+
3. Adicione as variáveis de ambiente (`VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`)
4. Faça deploy. Após aprovado, a URL é do tipo `https://jogo-memoria.pages.dev`

Para cada evento, atualize `public/config.json`, commite e o Cloudflare Pages faz o re-deploy automaticamente em ~30s.

Ver `docs/services-checklist.md` para o passo a passo completo incluindo a configuração do Supabase.

---

## Configurando o totem (kiosk)

### Chrome/Edge — modo kiosk

No Windows (totem com tablet):

```
chrome.exe --kiosk https://jogo-memoria.pages.dev --no-first-run --disable-translate
```

No Linux:

```
google-chrome --kiosk https://jogo-memoria.pages.dev --no-first-run
```

### Android (tablet)

1. Abra o Chrome, acesse a URL
2. Menu → "Adicionar à tela inicial"
3. Ative o modo kiosk via configurações de administrador de dispositivo (MDM) ou use um app como **Fully Kiosk Browser**

### iPad/iPhone

1. Safari → "Adicionar à tela inicial" → abre em tela cheia sem barra de navegação
2. Para modo kiosk completo, use **Guided Access** (Ajustes → Acessibilidade → Guided Access)

### Recomendações de dispositivo

- Tela: mínimo 10 polegadas, touch
- Orientação: portrait ou landscape (o jogo é responsivo)
- Internet: Wi-Fi recomendado; o jogo funciona offline mas sincroniza quando online

---

## Consentimento LGPD

Se o arquivo `config.json` contiver o bloco `lgpd`, o participante verá uma tela de consentimento entre a splash e o formulário. Ele deve aceitar para prosseguir — o formulário não é exibido sem aceite.

O que configurar:
- `dataController`: nome da empresa responsável pelo tratamento de dados
- `purposeText`: texto da política de privacidade (pode ser longo — o modal tem scroll)
- `consentText`: texto dos termos de uso
- `privacyPolicyUrl`: URL externa da política completa (opcional, abre em nova aba; deve ser `https://`)
- `consentVersion`: versão do termo — persistida junto ao lead no Supabase

Para eventos sem coleta de dados pessoais sensíveis, o bloco `lgpd` pode ser omitido.

## Teclado Virtual

Para uso em totem onde o teclado físico não está disponível, ative o teclado virtual:

```json
"leadForm": {
  "virtualKeyboard": { "enabled": true },
  ...
}
```

O teclado virtual on-screen substitui o teclado do SO (que não sobe em Android). Suporta:
- Layout padrão com acentos (long-press) e símbolos
- Layout numérico para campos `tel` (`"keyboardLayout": "numeric"`)
- Layout de e-mail com fileira de domínios comuns (`"keyboardLayout": "email"`)
- SHIFT automático na primeira letra de campos de nome
- Fechar ao tocar fora dos campos

**Por padrão desligado** — só ative para totens onde o teclado nativo não aparece.

---

## Durante o evento

### Verificações antes de abrir o evento

- [ ] Acessar a URL e confirmar que a splash screen aparece
- [ ] Preencher o formulário com dados de teste e confirmar que chega no Supabase
- [ ] Testar o painel admin com o PIN configurado
- [ ] Verificar se as imagens das cartas carregam
- [ ] Testar modo offline: desativar Wi-Fi, jogar, reativar Wi-Fi e verificar sync
- [ ] Se `lgpd` configurado: verificar que a tela de consentimento aparece e o modal de termos abre
- [ ] Se `game.showBefore` ativo: confirmar que as cartas ficam visíveis pelo tempo configurado antes de iniciar

### Monitoramento durante o evento

No painel admin (ver abaixo), acompanhe:

- **Total de leads:** participantes que jogaram
- **Sincronizados:** leads confirmados no Supabase
- **Pendentes:** leads no IndexedDB aguardando sync (offline)

Se houver muitos pendentes, acione **Forçar Sync** assim que a internet estiver disponível.

---

## Painel administrativo

### Como acessar

Na splash screen, toque **5 vezes no logo do evento em menos de 3 segundos**. A tela de PIN aparece.

### PIN

Definido no campo `adminPin` do `config.json`. Deve ser 4 a 6 dígitos numéricos.

Após 3 tentativas incorretas, o painel fica **bloqueado por 60 segundos**.

### Funcionalidades

| Função | Descrição |
|--------|-----------|
| Total de leads | Quantidade de jogadas registradas no IndexedDB local |
| Sincronizados | Leads já enviados ao Supabase |
| Pendentes | Leads em fila de sync (offline) |
| Forçar Sync | Drena a fila imediatamente (requer internet) |
| Exportar CSV | Baixa arquivo com todos os leads (online + offline) |

---

## Exportando leads

O botão **Exportar CSV** no painel admin gera um arquivo com:

- Todos os leads recebidos do Supabase (filtrados por `event.id`)
- Leads pendentes do IndexedDB local (ainda não sincronizados)

O arquivo é nomeado: `leads-{event.id}-{YYYY-MM-DD}.csv`

Colunas geradas dinamicamente com base nos campos do `leadForm.fields`, seguidas de:
- `played_at` — data/hora da jogada (ISO 8601)
- `score` — pontuação (número de pares encontrados)
- `time_taken` — tempo em segundos
- `synced_from` — `online` ou `offline-sync`

**Dica:** exporte os leads ao final de cada dia para ter backup local.

---

## Pós-evento — conferência de dados

Após o evento, acesse diretamente o Supabase para consulta completa:

1. Acesse [supabase.com](https://supabase.com) → seu projeto
2. Table Editor → `leads`
3. Filtre por `event_id = 'seu-event-id'`
4. Export → CSV (exporta do banco diretamente)

Para consultas avançadas, use o SQL Editor:

```sql
-- Leads de um evento específico, ordenados por pontuação
SELECT data->>'name' as nome, data->>'email' as email,
       score, time_taken, played_at
FROM leads
WHERE event_id = 'tech-summit-2026'
ORDER BY score DESC, time_taken ASC;

-- Contagem por dia
SELECT DATE(played_at) as dia, COUNT(*) as jogadas
FROM leads
WHERE event_id = 'tech-summit-2026'
GROUP BY dia ORDER BY dia;
```
