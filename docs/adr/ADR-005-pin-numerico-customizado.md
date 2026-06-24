# ADR-005 — Teclado numérico customizado no painel admin

**Data:** 2026-06-24
**Status:** Aceito

## Contexto

O painel admin é acessado em Chrome kiosk mode. Nesse modo, o teclado virtual do sistema operacional é inconsistente — pode não aparecer ou aparecer em posição que quebra o layout.

## Decisão

Teclado numérico 3x3+0 renderizado inteiramente em React/Tailwind, sem dependência de input nativo ou teclado do SO.

## Consequências

### Positivas
- Comportamento consistente em qualquer dispositivo/modo
- Sem dependência de teclado virtual do SO (crítico em kiosk)
- Layout previsível e testável

### Negativas / Trade-offs
- Código adicional (~50 linhas) para o teclado
- Acessibilidade via teclado físico não é prioridade neste contexto (totem touch)
