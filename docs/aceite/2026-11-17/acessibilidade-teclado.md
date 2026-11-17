# Aceite ponta a ponta — subtarefa 4 (acessibilidade por teclado)

Data: 2026-11-17, fuso `America/Sao_Paulo`.
Task: #373 — Aceite ponta a ponta do produto.

Esta evidência cobre a **subtarefa 4**: login e um lançamento concluídos apenas
com `Tab`/`Enter`/`Escape`, foco visível, rótulos associados, nomes acessíveis e
fechamento de menu com `Escape`.

## Ambiente

| Item | Valor |
| --- | --- |
| App | `next start` (build de produção) em `http://127.0.0.1:3225` |
| Banco | `postgresql://postgres@127.0.0.1:55432/finfam_accept373_kbd?schema=public` |
| Migrations | 7 aplicadas (`npm run db:deploy`) |
| Seed | `npm run db:seed` concluído |
| Browser | Chromium controlado pelo Chrome DevTools |
| Viewport | 1280×900 (desktop) e 500×800 (menu mobile) |
| Login | `FINFAM_USER=familia`; senha e segredo de sessão não registrados |
| Console | 0 mensagens de nível `error`/`warn` |

## Inspeção de semântica (DOM real)

Formulário de login — únicos focáveis da página:

| Campo | `id` / `name` | Rótulo | Nome acessível |
| --- | --- | --- | --- |
| Usuário | `login-user` / `user` | `<label>` envolvente | `Usuário` |
| Senha | `login-pass` / `pass` | `<label>` envolvente | `Senha` |
| Enviar | — / — | — | `Entrar` (button `type=submit`) |

Lançamento rápido (despesa) — campos com `id`/`name` e rótulo envolvente:
`quick-payment/payment` (`Forma de pagamento`), `quick-date/date` (`Data`),
`quick-description/description` (`Descrição`), `quick-amount/amount`
(`Valor (R$)`), `quick-category/category` (`Categoria`).
O grupo de tipo de lançamento expõe `role="group"` com
`aria-label="Tipo de lançamento"` e botões com `aria-pressed`.

## Passo A — Login inválido só com teclado — PASS

Sequência: `Tab` (Usuário) → texto → `Tab` (Senha) → texto → `Tab` (Entrar) →
`Enter`.

- `document.activeElement` acompanhou `login-user` → `login-pass` → `BUTTON`.
- Em cada parada `:focus-visible` = `true` e o anel de foco apareceu no
  `box-shadow` computado (`oklch(0.696 0.17 162.48) 0px 0px 0px 4px`).
- Após `Enter`: permaneceu em `/login` e o alerta acessível exibiu
  `Usuário ou senha inválidos` (`role="alert"`, `aria-live="polite"`).
- Nenhum cookie de sessão foi criado.

## Passo B — Login válido só com teclado — PASS

Sequência a partir do formulário: `Tab` até Usuário (`familia` já preenchido),
`Tab` até Senha, `Control+A` + senha correta, `Tab` até `Entrar`, `Enter`.

- Navegou para `/` (dashboard autenticado) com `AppNav` visível.
- Foco visível confirmado antes do envio.

## Passo C — Lançamento de despesa só com teclado — PASS

Sequência de `Tab` a partir do body até o card "Lançamento rápido" (índice dos
focáveis inspecionado no DOM), preenchendo:

- `quick-description` = `Aceite teclado 373`
- `quick-amount` = `12,34`
- `Tab` até `Salvar` (`type=submit`) + `Enter`

Resultado observado (snapshot de acessibilidade): `status` com o texto
`Gasto criado`. O lançamento apareceu no resumo consumido
(`R$ 4.042,34`, antes `R$ 4.030,00`) e em "Gastos por categoria"
(`Sem categoria R$ 12,34`).

## Passo D — Menu mobile fecha com `Escape` — PASS (correção)

- Viewport 500×800: `Tab` → botão `☰ Abrir menu` (`aria-controls="app-menu"`),
  `Enter` abre (`aria-expanded="true"`, `display: flex`).
- `Escape` fecha (`aria-expanded="false"`, `display: none`) e o foco permanece
  no botão, com `:focus-visible` = `true`.
- Correção aplicada em `src/components/AppNav.tsx`: listener de `keydown` para
  `Escape` enquanto o menu mobile está aberto (`setOpen(false)`).
- Regressão coberta por `AppNav.test.ts` → "fecha o menu mobile ao pressionar
  Escape (regressão #373)", que lê o componente e falha se o handler for
  removido.

## Console do browser

`list_console_messages` filtrado por `error`/`warn`/`assert` durante toda a
sessão: **nenhuma mensagem**.

## Screenshot

- [`screenshots/subtarefa-04-login-foco-teclado.png`](screenshots/subtarefa-04-login-foco-teclado.png)
  — campo Usuário com anel de foco visível após `Tab` (contexto isolado, sem
  sessão).

## Ressalvas

- O build usado nesta execução é o da branch atual, com as correções de
  `id`/`name` e foco visível já aplicadas.
- Os passos 1–3 (login inválido/válido e dashboard) já tinham evidência nas
  subtarefas 2/3; aqui eles foram **repetidos do zero apenas por teclado**.
- Nenhuma funcionalidade nova foi adicionada; a única correção de comportamento
  foi o fechamento do menu mobile com `Escape`.
