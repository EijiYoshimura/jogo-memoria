# ADR-001 — Supabase como banco de dados standalone

**Data:** 2026-06-24
**Status:** Aceito

## Contexto

O jogo-memoria standalone precisa persistir leads em banco de dados sem risco de perda, sem backend próprio (prazo de dias) e com caminho de migração para o PostgreSQL do Hub (Neon) no futuro.

## Decisão

Usar Supabase (PostgreSQL gerenciado) com SDK JavaScript direto no frontend, autenticado via ANON key e RLS (insert-only para anon).

## Consequências

### Positivas
- Zero API layer — SDK insere direto do browser
- PostgreSQL compatível com Neon (Hub): migração é `pg_dump` + restore ou replicação lógica
- Free tier suficiente para MVP; sem pausa de projeto (diferente do Supabase que pausa após 7 dias — o jogo será ativo durante eventos)
- RLS garante que leads não são lidos/deletados por usuários anônimos

### Negativas / Trade-offs
- ANON key exposta no bundle do frontend — mitigada pelo RLS
- Dependência de terceiro para persistência online — mitigada pelo IndexedDB offline buffer
- Ao integrar ao Hub, Supabase é descartado e leads históricos precisam migrar
