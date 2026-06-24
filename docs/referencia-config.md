# Referência de Configuração — config.json

O arquivo `public/config.json` é o único ponto de configuração do jogo por evento. Ele é carregado em runtime pela aplicação — não requer rebuild ao ser alterado.

Se o arquivo estiver ausente, inacessível ou malformado, a aplicação exibe uma **tela de erro bloqueante** com a mensagem de qual validação falhou.

---

## Estrutura completa

```json
{
  "event": { ... },
  "game": { ... },
  "leadForm": { ... },
  "adminPin": "..."
}
```

---

## `event` — Identidade do evento

| Campo | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|
| `id` | `string` | Sim | Identificador único do evento. Usado para filtrar leads no Supabase e no nome do arquivo CSV exportado. Use kebab-case, sem espaços. |
| `name` | `string` | Sim | Nome exibido na splash screen e no painel admin. |
| `logo` | `string` (URL) | Sim | URL da imagem do logo. Exibida na splash screen. Dimensão recomendada: 300×120 px. |
| `primaryColor` | `string` (hex) | Sim | Cor principal da interface (botões, destaque). Formato: `#RRGGBB`. |
| `backgroundColor` | `string` (hex) | Sim | Cor de fundo das telas. Formato: `#RRGGBB`. |

**Exemplo:**
```json
"event": {
  "id": "tech-summit-2026",
  "name": "Tech Summit 2026",
  "logo": "https://cdn.exemplo.com/logo.png",
  "primaryColor": "#E11D48",
  "backgroundColor": "#1C1917"
}
```

**Sobre `event.id`:** este valor é persistido em cada lead no Supabase (campo `event_id`). Escolha um ID estável antes do evento e não o altere durante o evento — isso quebraria a filtragem dos dados.

---

## `game` — Regras e conteúdo do jogo

| Campo | Tipo | Obrigatório | Padrão | Descrição |
|-------|------|-------------|--------|-----------|
| `pairs` | `number` (int ≥ 2) | Sim | — | Número de pares de cartas no tabuleiro. O total de cartas é `pairs × 2`. |
| `cardImages` | `string[]` | Sim | — | URLs das imagens da frente das cartas. Deve conter ao menos `pairs` URLs. O jogo usa apenas as primeiras `pairs`. |
| `cardBack` | `string` (URL) | Sim | — | URL da imagem do verso de todas as cartas (quando ocultas). |
| `timeLimitSeconds` | `number` (int ≥ 10) | Sim | — | Tempo limite em segundos. Exibido no timer MM:SS. Ao zerar, o jogo termina com `status: 'lost'`. |
| `autoResetSeconds` | `number` (int) | Não | — | Segundos de espera na tela de resultado antes de voltar automaticamente para a splash. Se omitido, não há reset automático — o participante precisa tocar. |

**Exemplo:**
```json
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
}
```

### Layout do tabuleiro por número de pares

| `pairs` | Cartas totais | Colunas | Observação |
|---------|--------------|---------|------------|
| 2–3 | 4–6 | 3 | Muito fácil |
| 4–6 | 8–12 | 4 | Dificuldade padrão |
| 7+ | 14+ | 6 | Difícil — use tela maior |

### Tempo recomendado por número de pares

| `pairs` | `timeLimitSeconds` sugerido |
|---------|---------------------------|
| 3 | 30–45s |
| 6 | 60–90s |
| 9 | 120–180s |

### Imagens das cartas

- Formato: JPG ou PNG
- Dimensão: 400×400 px (quadrado obrigatório — o componente renderiza em aspect-ratio 1:1)
- As imagens são carregadas via `<img src=...>` — devem estar em HTTPS e com CORS permissivo
- Imagens locais: coloque em `public/images/` e referencie como `"/images/carta.jpg"`

---

## `leadForm` — Formulário de captura de lead

| Campo | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|
| `title` | `string` | Sim | Título exibido no topo do formulário. |
| `fields` | `Field[]` | Sim | Lista de campos do formulário (ver abaixo). |

### `Field` — definição de campo

| Propriedade | Tipo | Obrigatório | Descrição |
|-------------|------|-------------|-----------|
| `id` | `string` | Sim | Identificador único do campo. Usado como chave no objeto `data` armazenado. Use snake_case sem espaços. |
| `label` | `string` | Sim | Texto exibido como label do input. Também vira cabeçalho da coluna no CSV exportado. |
| `type` | `'text' \| 'email' \| 'tel'` | Sim | Tipo do input HTML. Define validação nativa do browser. |
| `required` | `boolean` | Sim | Se `true`, o formulário não pode ser enviado sem este campo preenchido. |
| `mask` | `string` | Não | Máscara de entrada (ex: `"(99) 99999-9999"`). `9` representa qualquer dígito. |

**Exemplo:**
```json
"leadForm": {
  "title": "Cadastre-se para jogar!",
  "fields": [
    { "id": "name",    "label": "Nome completo",     "type": "text",  "required": true },
    { "id": "email",   "label": "E-mail",             "type": "email", "required": true },
    { "id": "company", "label": "Empresa",            "type": "text",  "required": false },
    { "id": "phone",   "label": "WhatsApp",           "type": "tel",   "required": false, "mask": "(99) 99999-9999" }
  ]
}
```

### Sobre o campo `id`

O valor de `id` é persistido no Supabase dentro do campo JSONB `data`. Por exemplo, o lead acima geraria:

```json
{ "name": "João Silva", "email": "joao@exemplo.com", "company": "ACME", "phone": "(11) 99999-1234" }
```

Se você mudar o `id` de um campo entre eventos, os dados de eventos anteriores terão uma chave diferente — mantenha consistência dentro do mesmo evento.

---

## `adminPin` — PIN do painel administrativo

| Campo | Tipo | Obrigatório | Validação |
|-------|------|-------------|-----------|
| `adminPin` | `string` | Sim | 4 a 6 dígitos numéricos |

O PIN é validado com a regex `/^\d{4,6}$/`. PINs alfanuméricos não são aceitos — a tela de entrada é um teclado numérico customizado.

**Segurança:** o PIN protege o painel de operadores casuais, não é um mecanismo de segurança robusto. Para eventos de alto risco, adicione autenticação adicional no Supabase.

**Exemplo:**
```json
"adminPin": "9182"
```

Após 3 tentativas incorretas, o painel é bloqueado por 60 segundos.

---

## Validação aplicada pelo ConfigLoader

A aplicação valida o `config.json` na inicialização e bloqueia com mensagem de erro se:

| Validação | Condição de erro |
|-----------|-----------------|
| `event.id` | Ausente ou não é string |
| `event.name` | Ausente ou não é string |
| `game.pairs` | Ausente, não é número, ou < 2 |
| `game.cardImages` | Ausente, não é array, ou tem menos itens que `pairs` |
| `game.timeLimitSeconds` | Ausente, não é número, ou < 10 |
| `leadForm.fields` | Ausente ou não é array |
| `adminPin` | Ausente ou não corresponde a `/^\d{4,6}$/` |

Campos não validados (`logo`, `primaryColor`, etc.) são aceitos mesmo vazios — a aplicação simplesmente não os exibe.

---

## Exemplo mínimo válido

```json
{
  "event": {
    "id": "meu-evento",
    "name": "Meu Evento",
    "logo": "",
    "primaryColor": "#7C3AED",
    "backgroundColor": "#1E1B4B"
  },
  "game": {
    "pairs": 3,
    "cardImages": [
      "https://picsum.photos/seed/a/400/400",
      "https://picsum.photos/seed/b/400/400",
      "https://picsum.photos/seed/c/400/400"
    ],
    "cardBack": "https://picsum.photos/seed/back/400/400",
    "timeLimitSeconds": 45
  },
  "leadForm": {
    "title": "Jogue!",
    "fields": [
      { "id": "name", "label": "Nome", "type": "text", "required": true }
    ]
  },
  "adminPin": "1234"
}
```
