# ADR-004 — Configuração do evento via JSON estático

**Data:** 2026-06-24
**Status:** Aceito

## Contexto

O standalone não tem backend próprio. A configuração do evento (imagens das cartas, campos do formulário, branding) precisa ser ajustável por evento sem alterar código.

## Decisão

`public/config.json` carregado via `fetch` em runtime pelo `ConfigLoader`. O operador edita o arquivo e faz push antes do evento — o deploy automático (Cloudflare Pages) serve a nova versão.

## Consequências

### Positivas
- Zero backend para configuração
- Operador não precisa de acesso ao código — só ao arquivo JSON
- Validação profunda no `isValidConfig` previne erros silenciosos em produção

### Negativas / Trade-offs
- Requer deploy a cada mudança de configuração (push + ~30s de build)
- `adminPin` no arquivo estático — não commitar com PIN real; usar variáveis de ambiente seria mais seguro mas adiciona complexidade
- Ao integrar ao Hub, config migra para `activation_config` JSONB do Manager API
