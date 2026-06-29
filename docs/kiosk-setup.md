# Setup do tablet em modo kiosk — Jogo da Memória BB Seguros

Guia prático para preparar um tablet (Android ou iPad) como totem do Jogo da
Memória: instalar o app como PWA, travá-lo em tela cheia e configurar o
dispositivo para operação contínua durante o evento.

> O app (HUB-75) já faz, no próprio software, o "endurecimento" possível pela
> web: tela sempre ligada (Wake Lock), tela cheia no primeiro toque, retrato,
> sem zoom, sem seleção de texto, sem menu de contexto e sem pull-to-refresh.
> Os passos abaixo cobrem o que **só o SO** controla (travar o app, brilho,
> auto-lock, notificações).

---

## 1. Android

### 1.1. Instalar o PWA

1. Abra o **Chrome** e acesse a URL de produção do app (HTTPS).
2. Aguarde carregar uma vez por completo (isso pré-cacheia o app-shell para uso
   offline).
3. Menu (⋮) → **Instalar app** / **Adicionar à tela inicial** → confirme.
4. Abra o app pelo **ícone instalado** (não pela aba do Chrome) — só assim ele
   abre em tela cheia/retrato, sem a barra de endereço.

### 1.2. Travar em kiosk — opção A: Fixação de tela (nativo, sem custo)

Indicado para eventos curtos e quando há um operador por perto.

1. **Configurações → Segurança → Fixação de tela** (ou *App pinning* /
   *Screen pinning*) → **ativar**.
2. Ative também **"Pedir PIN/senha antes de liberar"** — impede o participante
   de sair do app.
3. Abra o app, chame os **apps recentes** e toque no ícone do app → **Fixar**.
4. Para sair: gesto de "voltar + recentes" (varia por fabricante) + PIN.

> Limitação: a fixação de tela trava **um** app, mas não impede totalmente
> notificações/volume. Para travar de verdade, use a opção B.

### 1.3. Travar em kiosk — opção B: Launcher kiosk (recomendado para o dia todo)

Para operação não supervisionada, use um launcher kiosk dedicado, por exemplo
**Fully Kiosk Browser** (gratuito para uso básico):

1. Instale o **Fully Kiosk Browser** pela Play Store.
2. **Settings → Web Content → Start URL** = URL de produção do app.
3. **Web Auto Reload / Cache:** mantenha o cache para resiliência offline.
4. **Device Management → Keep Screen On** = ligado (reforça o Wake Lock).
5. **Kiosk Mode → Enable Kiosk Mode** e defina um **PIN** de saída.
6. **Advanced Web Settings:** desabilite *pull to refresh* e o *context menu*
   (o app já bloqueia via web, isto é redundância).
7. Defina o Fully como **launcher padrão** (Home) para o totem reabrir o app
   sozinho após qualquer reinício.

---

## 2. iPad / iPadOS

> iOS Safari **não** suporta Fullscreen API nem Screen Wake Lock plenos em PWA.
> A tela cheia vem do `display: standalone` do manifest e a tela é mantida
> ligada via **auto-lock desligado** (passo 2.3) — esse é o fallback
> documentado do Wake Lock.

### 2.1. Instalar o PWA

1. Abra o **Safari** e acesse a URL de produção (HTTPS).
2. Aguarde carregar uma vez por completo (pré-cache offline).
3. Botão **Compartilhar** → **Adicionar à Tela de Início** → confirme.
4. Abra pelo **ícone na tela de início** — abre sem a UI do Safari, em retrato.

### 2.2. Travar em kiosk — Acesso Guiado

1. **Ajustes → Acessibilidade → Acesso Guiado** → **ativar**.
2. **Definição de Código** → defina um código de saída.
3. Ative **"Atalho de Acessibilidade"** para Acesso Guiado.
4. Abra o app e **clique 3× no botão lateral/Home** → ajuste as áreas
   (desabilite toques nas bordas se desejar) → **Iniciar**.
5. Para sair: 3× no botão + código.

---

## 3. Recomendações de operação (Android e iPad)

Aplicar antes do evento, independentemente do método de kiosk:

| Item | Ajuste | Por quê |
|------|--------|---------|
| **Brilho** | Fixo e alto; **desligar brilho automático/adaptativo** | Tela legível o dia todo, sem oscilar |
| **Auto-lock / suspensão** | **Nunca** (ou tempo máximo) | Fallback do Wake Lock no iOS; evita tela apagada |
| **Notificações** | **Não perturbe** ligado; notificações off | Nada interrompe a experiência do participante |
| **Atualizações automáticas do SO/apps** | **Desligar** durante o evento | Evita reinício/popup no meio da operação |
| **Wi-Fi** | Rede estável; o app funciona offline, mas sincroniza leads ao reconectar | Leads persistem local (idb) e sobem ao voltar a rede |
| **Bateria** | Manter **na tomada**; desativar economia de bateria | Economia de energia pode liberar o Wake Lock |
| **Rotação** | Travar em **retrato** no SO | Reforça o `orientation: portrait` do manifest |
| **Volume / assistentes** | Volume baixo; desativar assistente de voz | Evita ativação acidental por toque/long-press |

### Operação offline

O app foi aberto ao menos uma vez com rede? Então o app-shell está em cache e
ele **abre e funciona sem internet**. Os leads capturados offline ficam
salvos no dispositivo (IndexedDB) e **sincronizam automaticamente** quando a
conexão voltar — sem ação do operador.

### Checklist rápido antes de abrir o totem

- [ ] App aberto **pelo ícone instalado**, em tela cheia e retrato
- [ ] Auto-lock desligado e brilho fixo alto
- [ ] Não perturbe ligado; atualizações automáticas desligadas
- [ ] Tablet na tomada
- [ ] Modo kiosk ativo com PIN/código de saída definido
- [ ] Primeiro toque feito (dispara o fullscreen no Android)
