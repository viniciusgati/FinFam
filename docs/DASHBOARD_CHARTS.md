# FinFam — Estado dos gráficos do dashboard e diretriz de análise

> Fase 0 (iniciador) da task #250 ("Melhorias de usabilidade e gráficos mais úteis
> no dashboard"). Este documento **mapeia o estado atual** (nada de código de
> produção foi alterado) e **registra a diretriz do usuário** para as próximas
> fases. O detalhamento em tarefas é responsabilidade da fase de análise.

## 1. O que o dashboard exibe hoje

Página: `src/app/(app)/page.tsx` (server component, `dynamic = "force-dynamic"`).

Card principal e apoio:

- `MonthSpendCard` — `%` da renda consumida (protagonista), nível textual,
  vencimento da fatura, contagem do ciclo e projeção de fechamento.
- `QuickExpenseCard` — lançamento rápido (só no mês calendário corrente).
- `DailyAllowanceCard` — "Pode gastar por dia" e saldo livre do ciclo em R$.
- `DayRatingBadge` — "Avaliação do dia".
- `MonthReviewPanel` — avaliação de mês fechado (IA opcional + fallback local).
- `PurchaseSimulator` — "posso comprar?".

Gráficos (SVG/CSS puro, sem biblioteca; `role="img"` + `aria-label`):

1. **`IncomeVsExpenseChart`** (`src/components/IncomeVsExpenseChart.tsx`) —
   comparação de **totais do mês**: "Entradas" vs "Saídas" (barras proporcionais).
2. **`DailySpendChart`** (`src/components/DailySpendChart.tsx`) — "Dia a dia":
   **uma barra por dia** + **linha do acumulado**; dia de hoje destacado, dias
   futuros atenuados.

Mês fechado/`/historico` (`src/app/(app)/historico/page.tsx`, ~180 B de rota):
hoje é apenas **placeholder** que repete o número do mês; não há tabela de meses
nem série temporal.

## 2. Fonte de verdade atual (`%` e séries)

- `consumedCents = saídas_fixas + gastos_avulsos(no orçamento) + faturas_de_cartão`
  (`src/lib/finance.ts:137`); `consumedPercent = consumedCents / renda`.
- `src/lib/dashboard.ts:loadDashboardData` respeita vigência (`isActiveInMonth`) e
  competência de fatura (`invoices.allocateInstallments`), e chama
  `buildDailySeries` (`src/lib/dashboard-series.ts`).
- `buildDailySeries` distribui **cada despesa pelo dia em que ocorre**: fixas no
  `dueDay`, avulsos na `date`, faturas no `dueDay` do cartão. Logo, o "Dia a dia"
  mistura **despesa fixa + variável** e concentra picos nos vencimentos.
- Já existem, mas só para o orçamento/avaliação do dia:
  - `dailyFreeBudgetCents = max(renda − fixas − faturas, 0) / dias_no_mês`
    (`src/lib/dashboard-series.ts:125-136`).
  - `dailyAllowanceCents` / ciclo (`src/lib/cycle.ts`).
  - `rateDay` usa o orçamento livre (`src/lib/day-rating.ts`).
- **Consumo disponível** (`entradas − gastos fixos`) e média diária por
  mês/dias decorridos/ciclo: `buildConsumptionSummary`/`consumptionAverageLabel`
  (`src/lib/dashboard-series.ts`), sobre `consumptionAvailableCents`/
  `consumptionDailyAverageCents` (`src/lib/finance.ts`). Já exibido como
  subtítulo do `MonthSpendCard` (janela "mês"). Faturas e avulsos ficam fora da
  subtração (consumo variável, SPEC §3.2/§3.4).

Observação: `freeBudget`/diária livre **não** alimentam os gráficos nem o `%` —
o `%` continua sendo "renda consumida" com as fixas embutidas.

## 3. Categorias: estado atual

- `category String?` (texto livre, **opcional**) em `FixedExpense`,
  `VariableExpense` e `CardPurchase` (`prisma/schema.prisma:56,88,108`).
- CRUDs já aceitam categoria opcional: `GastosManager`, `FixedItemsManager`
  (saídas) e `CreditCardsManager` (compras).
- **Não existe** tabela/enum de categorias nem **nenhuma agregação por
  categoria** em `dashboard.ts`/`finance.ts`. Os gráficos atuais **não** usam
  categoria.
- Implicações a decidir na análise: padronizar/normalizar categorias, tratar
  `null` ("Sem categoria") e como atribuir categoria às faturas de cartão (a
  categoria vive em `CardPurchase`, alocada por parcelas/competência em
  `invoices.ts`).

## 4. Diretriz do usuário (task #250)

Ideia original:

> "Vamos inserir a categoria nos gráficos, proponha melhoras gráficos no
> dashboard, o de gastos do dia não é útil, prefiro algo média diária, pois os
> fixos atrapalham em geral os gráficos dia a dia. Pensa em gráficos melhores e
> propostas de ajuda à família analisando o financeiro."

Intervenção na retomada:

> "acho que uma média usando o valor total de entradas menos gastos fixos (que
> seria consumo) é bem melhor como fonte de verdade para análises."

Leitura para a próxima fase:

- Substituir o "Dia a dia" (que hoje plota fixas + variáveis e gera picos) por
  uma leitura de **média diária de consumo**.
- Fonte de verdade proposta: **`entradas − gastos fixos`** = "consumo" → média
  diária (por dias do mês/ciclo). É o mesmo racional do `dailyFreeBudgetCents`
  atual, mas ainda **não exposto** nos gráficos e distinto do `%` atual.
- **Inserir categoria nos gráficos.**
- Ponto a esclarecer com o usuário/analista: "gastos fixos" inclui **faturas de
  cartão** (o código atual trata fixas **e** cartão como obrigações)? Isso muda
  a média.

## 5. Lacunas de dados/cálculo (para virar tarefa)

- Não há **agregação por categoria** (fixas, avulsos e compras de cartão).
- **Resolvido:** a métrica de média diária baseada em `entradas − fixos` é
  exposta por `buildConsumptionSummary`/`consumptionAverageLabel`
  (`src/lib/dashboard-series.ts`; ver §2).
- `DailySpendChart` não tem **linha de referência** (média/orçamento diário) e
  mistura fixas com variáveis.
- `%` e `consumedCents` **incluem fixas**; a diretriz separa "consumo" de
  "obrigações".
- `/historico` é placeholder → falta base para gráficos de **tendência mensal**.

## 6. Ideias de gráficos (insumo para a fase de análise)

- **Gastos por categoria** — donut/barras empilhadas por categoria (avulsos e
  fixas; compras de cartão pela competência da fatura).
- **Média diária de consumo** — `(entradas − gastos fixos) / dias` como linha de
  referência, comparada ao gasto **variável** realizado por dia (sem as fixas,
  que entram como faixa/obrigação).
- **Orçamento vs realizado** — barra de progresso/bullet do orçamento livre
  consumido no mês/ciclo.
- **Comparativo por categoria mês a mês** — no `/historico` (usa
  `monthly_snapshots`; hoje falta granularidade por categoria no snapshot).
- **Tendência mensal** — evolução do `consumo/renda` nos últimos meses.

## 7. Evidência

Comandos e saídas reais desta fase (nenhum código de produção alterado; apenas
este documento):

```
$ git branch --show-current
autoia/task-250
$ git status --short
(limpo)

$ npm ci
added 402 packages, and audited 403 packages in 12s

$ npm test 2>&1 | tail -4
 Test Files  47 passed (47)
      Tests  469 passed (469)
TEST_EXIT=0

$ npm run typecheck
> tsc --noEmit
TYPECHECK_EXIT=0

$ npm run lint 2>&1 | tail -4
✖ 1 problem (0 errors, 1 warning)
LINT_EXIT=0

$ npm run build 2>&1 | tail -6
├ ƒ /historico                             180 B         108 kB
...
ƒ Middleware                             39.6 kB
BUILD_EXIT=0
```

Leituras-chave: `src/app/(app)/page.tsx:199-215` (os dois gráficos);
`src/components/DailySpendChart.tsx`; `src/lib/dashboard-series.ts:98-142`
(fixas no `dueDay` + `dailyFreeBudgetCents`); `src/lib/finance.ts:137-143,299-344`
(`consumedCents`/`%` com fixas); `prisma/schema.prisma:56,88,108` (categoria);
`src/app/(app)/historico/page.tsx` (placeholder).
