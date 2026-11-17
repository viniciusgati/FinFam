# Aceite ponta a ponta — RELATÓRIO FINAL

Data: 2026-11-17 (terça-feira), fuso `America/Sao_Paulo`.
Task: **#373 — Aceite ponta a ponta do produto**.
Branch: `autoia/task-373` (commit local, sem push).

Este relatório consolida as subtarefas 1–6. As evidências parciais continuam
disponíveis em `passos-01-07.md`, `passos-08-12.md`,
`acessibilidade-teclado.md` e `regressoes.md`.

## Resumo executivo

| Item | Resultado |
| --- | --- |
| Roteiro numerado | **12/12 PASS** |
| Console do browser | **0 mensagens de nível `error`** (após correção do favicon) |
| Estados vazio / validação / ciclo futuro | PASS com os textos exatos |
| Login e um lançamento só com teclado | PASS |
| `npm run typecheck` | exit **0** |
| `npm run lint` | exit **0** (0 erros; 1 warning pré-existente) |
| `npm test` | exit **0** — 107 arquivos / 1255 testes |
| `npm run build` | exit **0** |
| `npm run test:integration` | exit **0** — 15 arquivos / 62 testes |
| Migrations + seed no PostgreSQL de aceite | PASS (`Database schema is up to date!`) |

## Ambiente

| Item | Valor |
| --- | --- |
| App | `next start` (build de produção), porta livre (ex.: `http://127.0.0.1:3222`) |
| Banco de aceite (E2E) | `postgresql://postgres:***@127.0.0.1:55432/finfam_accept373?schema=public` |
| Banco de aceite (revalidação) | `postgresql://postgres:***@127.0.0.1:55432/finfam_accept373_final?schema=public` |
| Banco de integração | `postgresql://postgres:***@127.0.0.1:55432/finfam_test?schema=public` |
| Migrations | 7 aplicadas via `npm run db:deploy` |
| Seed | `npm run db:seed` concluído |
| Fuso das asserções | `America/Sao_Paulo` |
| Browser | Chromium controlado pelo Chrome DevTools do ambiente |
| Login de teste | `FINFAM_USER=familia`; senha e `FINFAM_SESSION_SECRET` definidas, **valores não versionados nem logados** |
| Node | `>=20` (engine do `package.json`) |

### Migrations, seed e contagem por tabela

`npx prisma migrate status` no PostgreSQL de teste:

```text
Datasource "db": PostgreSQL database "finfam_test", schema "public" at "127.0.0.1:55432"
7 migrations found in prisma/migrations
Database schema is up to date!
```

`npm run acceptance:prepare` (migrations + seed) no banco limpo:

```text
All migrations have been successfully applied.
> finfam@0.1.0 db:seed
Seed concluído.
Ambiente pronto: migrations aplicadas e seed concluído.
```

Contagem por tabela após o seed (banco `finfam_accept373_final`):

| Tabela | Registros |
| --- | ---: |
| `incomes` | 2 |
| `fixed_expenses` | 3 |
| `credit_cards` | 1 |
| `card_purchases` | 1 |
| `variable_expenses` | 2 |
| `variable_incomes` | 0 |
| `app_settings` | 0 |
| `monthly_snapshots` | 5 |
| `monthly_category_snapshots` | 0 |
| `monthly_reviews` | 0 |

`monthly_category_snapshots`/`monthly_reviews` ficam vazias após o seed (são
populadas pelo fechamento de mês/avaliações, não pelo seed); as demais tabelas
do seed existem com os registros esperados.

Validação de ambiente (`acceptance-env.ts serve --check-only`):

```text
Banco de aceite (TEST_DATABASE_URL): postgresql://postgres:***@127.0.0.1:55432/finfam_accept373_final?schema=public
Autenticação: FINFAM_USER=definida, FINFAM_PASS=definida, FINFAM_SESSION_SECRET=definida
✓ Ready in 483ms
PASS GET /login -> 200
PASS GET /gastos (sem sessão) -> 302 /login
```

A URL sai mascarada e os segredos nunca são impressos.

## Valores de referência (derivados das funções puras)

Saída real de `loadCycleDashboardData` + `computeFinanceStatus` para o dataset
do seed no ciclo `2026-11`:

```json
{
  "cycleStartDay": 1,
  "cycleKey": "2026-11",
  "status": {
    "incomeCents": 1470000,
    "consumedCents": 403000,
    "availableCents": 1067000,
    "projectedCents": 489412,
    "consumedPercent": 27.414965986394556,
    "level": "green"
  }
}
```

Saída real de `buildFutureCommitments`/`invoiceLinesForMonth` e do limite
disponível (`availableCardLimitCents`):

```json
{
  "cardLimitCents": 200000,
  "invoiceDecemberCents": 60000,
  "availableLimitCents": 140000,
  "future": [
    { "monthKey": "2026-12", "totalCents": 60000 },
    { "monthKey": "2027-01", "totalCents": 0 },
    { "monthKey": "2027-02", "totalCents": 0 }
  ]
}
```

## Roteiro — 12 passos

Cada passo foi executado no Chromium real contra o PostgreSQL de aceite. As
comparações de R$ usam **igualdade em centavos** com os valores calculados pelas
funções puras (`finance.ts`/`dashboard.ts`, `buildCycleDailySeries`,
`savings-goal.ts`, `ai/purchase-simulator.ts`, `formatCents`) e pelas fórmulas
do SPEC §3.4/§4.1/§4.2.

### Passo 1 — Login inválido — PASS

Permaneceu em `/login`; durante a chamada o botão ficou `Entrando...`
(`disabled=true`) e voltou a `Entrar` (`disabled=false`). Erro em
`role="alert"`: `Usuário ou senha inválidos`. Nenhum cookie de sessão foi criado
e `GET /gastos` sem sessão respondeu `302` para `/login`.
Screenshot: [`screenshots/passo-01-login-invalido.png`](screenshots/passo-01-login-invalido.png)

### Passo 2 — Login válido — PASS

Botão `Entrando...` desabilitado durante a chamada; ao concluir, chegou ao
dashboard `/` (ou `/?mes=...`) com a navegação `AppNav` visível.
Screenshot: [`screenshots/passo-02-login-valido.png`](screenshots/passo-02-login-valido.png)

### Passo 3 — Dashboard em zonas — PASS

Seções com `aria-labelledby`: `RESUMO DO CICLO`, `AÇÕES`, `COMPROMISSOS`,
`EXPLORAR`. Valores iguais a `finance.ts`: `%` = **27%**
(`27.414965986394556`); renda **R$ 14.700,00** (`1470000`); consumido
**R$ 4.030,00** (`403000`); disponível **R$ 10.670,00** (`1067000`); projeção
**R$ 4.894,12** (`489412`). Contador **14 dias para o fim do ciclo** (17/11 a
30/11, contando hoje). Rótulo de nível **Ok** (`level: "green"`, SPEC §4.2).
Screenshot: [`screenshots/passo-02-login-valido.png`](screenshots/passo-02-login-valido.png)

### Passo 4 — Lançar despesa rápida — PASS

Forma `Dinheiro/PIX (já pago)` com `Este lançamento já nasce marcado como pago.`.
Envio: `Salvando...` (`disabled=true`) → `Gasto criado` em `role="status"`.
Gasto `Aceite despesa 373` de **R$ 12,34** (`1234` centavos) aparece em `/gastos`
e no dashboard (consumido **R$ 4.042,34** = `consumedCents`).
Screenshots:
[`passo-04-despesa-rapida.png`](screenshots/passo-04-despesa-rapida.png),
[`passo-04-gastos-listagem.png`](screenshots/passo-04-gastos-listagem.png)

### Passo 5 — Lançar entrada rápida — PASS

Envio: `Salvando...` → `Entrada criada`. Entrada `Aceite entrada 373` de
**R$ 100,00** (`10000` centavos) aparece em `/entradas`; após reload o dashboard
mostra renda **R$ 14.800,00** (`1480000` = `incomeCents`).
Screenshots:
[`passo-05-entrada-rapida.png`](screenshots/passo-05-entrada-rapida.png),
[`passo-05-entradas-listagem.png`](screenshots/passo-05-entradas-listagem.png)

### Passo 6 — "A pagar" e marcar pago — PASS

Dois gastos em aberto (`20,00` e `30,00`): `A pagar no mês: R$ 50,00 · 2 gastos
em aberto`. Ao marcar o primeiro: `Gasto marcado como pago`, item sai dos
pendentes e o resumo cai para `R$ 20,00 · 1 gasto em aberto`. Ao marcar o
último: `A pagar no mês: R$ 0,00 · Nenhum gasto em aberto`; no dashboard o card
mostra `A pagar no ciclo: R$ 0,00 · Nenhum gasto em aberto` e o vazio
`Nenhum gasto em aberto em novembro de 2026.`.
Screenshots:
[`passo-06-marcar-pago.png`](screenshots/passo-06-marcar-pago.png),
[`passo-06-a-pagar-zerado.png`](screenshots/passo-06-a-pagar-zerado.png)

### Passo 7 — Compromissos futuros e limite do cartão — PASS

`FutureCommitmentsCard` e `/cartoes`: dezembro/2026 **R$ 600,00**, janeiro/2027 e
fevereiro/2027 **R$ 0,00** — iguais a `buildFutureCommitments` (parcela 1/1 da
compra de 08/11/2026). Limite definido em **R$ 2.000,00** e fatura de
dezembro/2026 em **R$ 600,00**; `/cartoes` exibe
`Limite R$ 2.000,00 · Limite disponível R$ 1.400,00`, igual a
`availableCardLimitCents(200000, 60000) = 140000`. A linha
`Faturas a pagar no ciclo: R$ 50,00` ficou informativa, sem somar no consumo
(consumido permaneceu `411334`).
Screenshots:
[`passo-07-compromissos-futuros.png`](screenshots/passo-07-compromissos-futuros.png),
[`passo-07-cartoes-limite-e-fatura.png`](screenshots/passo-07-cartoes-limite-e-fatura.png)

### Passo 8 — Configurar meta — PASS

Prévia exata: `Sua meta equivale a R$ 33,33 por dia.`
(`savingsGoalPreview(100000, 30)`). Botão: `Salvar` → `Salvando…`
(`disabled=true`) → `Salvar` com `Configuração salva com sucesso` em
`role="status"`. Após reload a meta persistiu (`1000,00` e a mesma prévia) e o
dashboard refletiu `META R$ 1.000,00`.
Screenshot: [`screenshots/passo-08-meta-salva.png`](screenshots/passo-08-meta-salva.png)

### Passo 9 — Simular compra parcelada — PASS

Valor `150,00` em `3` parcelas: veredito **`Pode comprar`** — igual a
`simulatePurchase` para os mesmos insumos (`freeBudgetCents=1068666`,
`dailyCents=76333`, `remainingDays=14`, `usualDailySpendCents=7137`,
`purchaseCents=15000`, `installmentsTotal=3`). 1ª parcela
`floor(15000/3)+resto = 5000` (R$ 50,00); as 2 restantes somam `10000`
(R$ 100,00) como compromisso futuro informativo. Todos os valores em pt-BR.
Screenshot: [`screenshots/passo-09-simular-compra.png`](screenshots/passo-09-simular-compra.png)

### Passo 10 — Filtrar `/gastos` — PASS

Lista inicial `8 de 8 gastos` / `Total do mês: R$ 613,34`. Filtro
`Alimentação` → `1 de 8 gastos` com chip `Categoria: Alimentação×` e
`Total filtrado: R$ 450,00 · 1 de 8 gastos`. `Limpar filtros` restaurou
`8 de 8` e removeu o chip. Filtro sem resultado (`zzz-nao-existe`) exibiu
`Nenhum gasto para os filtros selecionados em novembro de 2026.` (`0 de 8`) com
o chip correspondente.
Screenshots:
[`passo-10-filtro-categoria.png`](screenshots/passo-10-filtro-categoria.png),
[`passo-10-filtro-sem-resultado.png`](screenshots/passo-10-filtro-sem-resultado.png)

### Passo 11 — Baixar dados em `/configuracoes` — PASS

Bloco `Baixar meus dados` com `Baixar tudo (JSON)` e 10 links de
`CSV por tabela`. O link virou `Preparando…` com `aria-disabled="true"` e
concluiu com `Download iniciado: finfam-dados-2026-11-17.json`; JSON válido com
`versao: 1`, `fuso: "America/Sao_Paulo"` e **10 tabelas**
(`incomes`, `variable_incomes`, `fixed_expenses`, `credit_cards`,
`variable_expenses`, `card_purchases`, `monthly_snapshots`,
`monthly_category_snapshots`, `app_settings`, `monthly_reviews`). CSV de tabela
vazia trouxe só o cabeçalho. Falhas: HTTP 500 →
`Não foi possível gerar a exportação. Tente novamente.`; HTTP 401 →
`Sua sessão expirou. Entre novamente para baixar seus dados.` — link
reabilitado em ambos.
Screenshots:
[`passo-11-download-sucesso.png`](screenshots/passo-11-download-sucesso.png),
[`passo-11-erro-401.png`](screenshots/passo-11-erro-401.png)

### Passo 12 — Consultar `/ajuda` — PASS

`GET /ajuda` → `200`; `<title>` = `Ajuda — FinFam`, `<h1>` = `Ajuda`. Navegação
`Índice do glossário` com 10 âncoras; as 20 âncoras internas resolvem para seções
existentes. Todos os links internos (`/`, `/entradas`, `/saidas`, `/gastos`,
`/cartoes`, `/historico`, `/configuracoes`, `/ajuda` e as âncoras) responderam
`200`, nenhum `404`.
Screenshot: [`screenshots/passo-12-ajuda-indice.png`](screenshots/passo-12-ajuda-indice.png)

## Estados obrigatórios

| Estado | Texto exato observado | Screenshot |
| --- | --- | --- |
| `/gastos` vazio (`?mes=2026-10`) | `Nenhum gasto em outubro de 2026. Lance o primeiro.` (`0 de 0 gastos`) | [`passo-12-gastos-vazio.png`](screenshots/passo-12-gastos-vazio.png) |
| Erro de validação (`role="alert"`) | `Não foi possível salvar. Verifique os campos.` + `Informe uma descrição.` + `Informe um valor válido (ex.: 12,34).`; `aria-invalid="true"`; nenhum registro criado | [`passo-12-validacao-erro.png`](screenshots/passo-12-validacao-erro.png) |
| Prévia de ciclo futuro (`/?mes=2026-12`) | `Ciclo futuro`, `Este ciclo ainda não começou. Os números abaixo são uma previsão com o que já está lançado: rendas, contas fixas e faturas.`, `O ciclo começa em 14 dias`, card `Pode gastar por dia` (`R$ 380,65 por dia`, `31 dias restantes no ciclo`) | [`passo-12-ciclo-futuro.png`](screenshots/passo-12-ciclo-futuro.png) |

## Console do browser

Após a correção do favicon, **nenhuma mensagem de nível `error`** nem exceção
não tratada foi registrada durante todo o roteiro. O único `error` observado
(antes da correção) foi:

- **Passo 1–12, qualquer rota**: `Failed to load resource: the server responded
  with a status of 404 (Not Found)` para `GET /favicon.ico`.
- **Correção**: `metadata.icons.icon = "/icons/icon.svg"` em
  `src/app/layout.tsx`, fazendo o browser buscar o ícone existente (`200`).
- **Teste de regressão**: `src/app/layout.test.ts`.

## Acessibilidade por teclado

Login (inválido e válido) e um lançamento de despesa foram concluídos apenas
com `Tab`/`Enter`; `document.activeElement` acompanhou `login-user` →
`login-pass` → botão `Entrar`, com `:focus-visible = true` e anel de foco no
`box-shadow` computado. Formulários principais têm `id`/`name` e rótulos
associados (`login-user`/`user`, `login-pass`/`pass`, `quick-description`,
`quick-amount`, etc.); controles têm nome acessível. No menu mobile, `Enter`
abre (`aria-expanded="true"`) e `Escape` fecha (`aria-expanded="false"`).
Detalhes em [`acessibilidade-teclado.md`](acessibilidade-teclado.md).
Screenshot: [`screenshots/subtarefa-04-login-foco-teclado.png`](screenshots/subtarefa-04-login-foco-teclado.png)

## Regressões corrigidas e testes de regressão

| # | Sintoma | Correção | Teste (falha ao reverter) |
| --- | --- | --- | --- |
| 1 | Card "A pagar" zerado não renderizava `Nenhum gasto em aberto em <mês> de <ano>.` | `OpenExpensesCard` recebe `emptyLabel`; dashboard passa `monthLabel(referenceMonthKey)` | `OpenExpensesCard.test.ts` — *ao zerar exibe o vazio ... (regressão #373)* |
| 2 | `/cartoes` mostrava só o limite, sem descontar a fatura | `availableCardLimitCents` + linha `Limite disponível R$ ...` | `invoices.test.ts`, `CreditCardsManager.test.ts` |
| 3 | `GET /favicon.ico` respondia 404 e gerava `console.error` | `metadata.icons.icon = "/icons/icon.svg"` em `app/layout.tsx` | `app/layout.test.ts` |
| 4 | Menu mobile não fechava com `Escape` | listener `keydown` no `AppNav` | `AppNav.test.ts` |
| 5 | Campos sem `id`/`name` e login sem rótulo associado | `id`/`name` nos formulários; foco visível no login | `login/page.test.ts`, `QuickExpenseCard.test.ts`, `SettingsForm.test.ts`, `MonthSelectorView.test.ts`, `form-a11y-ids.test.ts` |

A verificação de "falha ao reverter" está registrada em
[`regressoes.md`](regressoes.md): cada correção foi revertida isoladamente, o
teste de guarda falhou e o arquivo foi restaurado.

## Gate completo (`npm run typecheck`, `lint`, `test`, `build`)

Número de execuções nesta subtarefa: **1** rodada completa do gate (todas
verdes).

```text
$ npm run typecheck
> tsc --noEmit
TYPECHECK_EXIT=0

$ npm run lint
> eslint .
src/lib/env.test.ts
  17:36  warning  '_omitted' is assigned a value but never used  @typescript-eslint/no-unused-vars
✖ 1 problem (0 errors, 1 warning)
LINT_EXIT=0

$ npm test
 Test Files  107 passed (107)
      Tests  1255 passed (1255)
TEST_EXIT=0

$ npm run build
 ✓ Compiled successfully in 4.3s
BUILD_EXIT=0
```

## Suíte de integração (`TEST_DATABASE_URL=... npm run test:integration`)

Execuções nesta subtarefa: **1**, contra PostgreSQL com as migrations aplicadas.

```text
$ TEST_DATABASE_URL="postgresql://postgres:***@127.0.0.1:55432/finfam_test?schema=public" npm run test:integration
 ✓ src/lib/dashboard.integration.test.ts (10 tests)
 ✓ src/lib/cycle.integration.test.ts (6 tests)
 ✓ src/lib/invoices.integration.test.ts (5 tests)
 ✓ src/lib/snapshot-capture.integration.test.ts (8 tests)
 ✓ src/lib/card-adjustment-data.integration.test.ts (4 tests)
 ✓ src/lib/snapshots.integration.test.ts (1 test)
 ✓ src/lib/quick-expense.integration.test.ts (2 tests)
 ✓ src/lib/category-suggestions.integration.test.ts (3 tests)
 ✓ src/lib/snapshot-month.integration.test.ts (2 tests)
 ✓ src/lib/settings.integration.test.ts (8 tests)
 ✓ src/app/api/incomes/route.integration.test.ts (4 tests)
 ✓ src/app/api/auth/login/route.integration.test.ts (3 tests)
 ✓ src/lib/db.integration.test.ts (1 test)
 ✓ src/app/api/credit-cards/[id]/route.integration.test.ts (2 tests)
 ✓ src/test/integration.integration.test.ts (3 tests)
 Test Files  15 passed (15)
      Tests  62 passed (62)
INTEGRATION_EXIT=0
```

## Ressalvas

- `npm run lint` mantém **1 warning pré-existente** em `src/lib/env.test.ts`
  (`_omitted` não usado), fora do escopo desta tarefa; **0 erros**.
- As falhas 500/401 do passo 11 foram exercitadas interceptando `fetch` no
  browser (respostas simuladas), pois não há endpoint de falha forçada; o
  componente é o mesmo caminho do erro real.
- A lista de `/gastos` de novembro/2026 na execução dos passos inclui os
  lançamentos criados pelos próprios passos (`R$ 613,34` em vez do total
  original do seed).
- `monthly_category_snapshots`/`monthly_reviews` ficam vazias imediatamente
  após o seed; são populadas pelo uso do app (fechamento de mês/avaliações).
- O `error` de `/favicon.ico` existia antes das subtarefas 2/3 e foi capturado e
  corrigido na subtarefa 3.
- Nenhuma mudança fora do escopo; nenhum push realizado.
