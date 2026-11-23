# FinFam — Estado atual e insumos para avaliar features (task #379)

> **Fase 0 — iniciador (analyze)** do pipeline de brainstorming da task #379
> ("Avaliar todas as features, propor melhorias que entreguem valor a elas").
> Objetivo desta fase: mapear o repositório, o ecossistema e o estado atual das
> features para as próximas fases (analista, auditor de UX, propositor).
> **Nenhum código de produção foi alterado.** Branch `autoia/task-379`, HEAD
> `8f59342` (base = `autoia/task-377` já integrada). Data da análise: 23/11/2026.
>
> Observação: `docs/ESTADO_ATUAL.md` e `docs/ANALISE_MELHORIAS.md` são artefatos
> da task #360 e já estão **parcialmente desatualizados** (várias das melhorias
> que eles listavam como lacuna foram entregues entre #361 e #377). Este
> documento reflete o estado **posterior** a essas entregas.

## 1. Objetivo e escopo

O pedido é aberto: *"avaliar todas as features, propor melhorias que entreguem
valor a elas"*. Esta fase **não decide** o que será feito; ela inventaria o que
existe hoje, o que já foi entregue, o que permanece como lacuna verificável e
quais oportunidades concretas as próximas fases devem confrontar com a SPEC.

O repositório tem fundação madura (código, banco, testes, CI e PWA). Não há
trabalho de bootstrap: o entregável é este mapa de estado.

## 2. Stack e organização

### 2.1 Stack

- **Next.js 15 (App Router)** fullstack (páginas + rotas de API no mesmo app)
- **React 19** + **TypeScript**
- **Tailwind CSS v4** (sem biblioteca de gráficos: SVG/CSS puro)
- **Prisma ORM 6** + **PostgreSQL** (dinheiro em centavos inteiros)
- Sessão via cookie `httpOnly` assinado com **jose**; credenciais por env
- **Vitest** para unitários e integração
- **PWA manual** (manifest + `public/sw.js` + tela `/offline`)
- IA opcional via **DeepSeek** (sem chave, fallback determinístico local)
- Pesquisa de preço opcional (SerpAPI/Google Shopping) na lista de compras

### 2.2 Páginas e APIs

Páginas (`src/app`):

| Rota | Estado |
| --- | --- |
| `/login` | login único da família por env |
| `/` | dashboard do ciclo (corrente, fechado ou prévia futura) |
| `/entradas` | entradas fixas + entradas avulsas por mês |
| `/saidas` | saídas fixas (CRUD, categoria, vigência, ativar/desativar) |
| `/gastos` | gastos avulsos por mês (CRUD, filtros, pagamento, pago) |
| `/compras` | lista de compras (essencial/desejável, preço, comprado) |
| `/cartoes` | cartões, compras/parcelas, fatura, ajuste, importação CSV, parcelas futuras |
| `/historico` | snapshots mensais, evolução e comparativo por categoria |
| `/configuracoes` | ciclo, meta de economia e exportação/backup |
| `/ajuda` | glossário de conceitos do produto |
| `/offline` | fallback do service worker |

APIs (`src/app/api`, 24 rotas `route.ts`): autenticação (`login`, `logout`),
CRUDs de `incomes`, `variable-incomes`, `fixed-expenses`, `variable-expenses`,
`credit-cards`, `card-purchases`, `settings`, `shopping-items` (+
`[id]/price`), importação/ajuste de fatura (`card-invoices/import`,
`card-invoices/set-total`), exportação (`export`) e três rotas de IA
(`ai/family-help`, `ai/month-review`, `ai/purchase-simulator`).

### 2.3 Organização do código

- `src/lib/*` — lógica de domínio **pura** (testável sem banco/rede): `finance`,
  `cycle`, `dashboard`, `dashboard-series`, `dashboard-charts`, `dashboard-layout`,
  `invoices`, `card-adjustment`, `category-breakdown`, `category-suggestions`,
  `family-insights`, `spend-advice`, `open-expenses`, `future-commitments`,
  `upcoming`, `savings-goal`, `month-spend`, `shopping-list`, `shopping/price-source`,
  `history`, `snapshots`, `settings`, `time`, `money`, `validation`, `export-data`,
  `expense-filters`, `quick-expense`, `quick-income`, `glossary`, `ai/*`.
- `src/components/*` — apresentação e formulários client; vários com teste via
  `renderToStaticMarkup`.
- `src/app/**` — páginas e rotas apenas orquestram carga/validação.
- `prisma/` — schema (11 modelos + 2 enums), 8 migrations e scripts
  `seed.ts`/`snapshots.ts`.
- `docs/` — SPEC, ARCHITECTURE, DASHBOARD_CHARTS, SNAPSHOTS, USABILITY_AUDIT,
  ESTADO_ATUAL e ANALISE_MELHORIAS (as duas últimas da task #360).

### 2.4 Modelo de dados (11 tabelas + 2 enums)

`incomes`, `variable_incomes`, `fixed_expenses`, `credit_cards`,
`variable_expenses`, `card_purchases`, `monthly_snapshots`,
`monthly_category_snapshots`, `app_settings`, `shopping_items`,
`monthly_reviews`; enums `PaymentMethod` e `ShoppingItemKind`.

Migrations aplicadas (8): `init`, `add_monthly_review`, `add_app_settings`,
`add_variable_incomes`, `add_monthly_category_snapshots`,
`add_snapshot_month_series`, `add_settings_savings_goal`,
`add_shopping_items`.

Campos relevantes para melhorias futuras:

- `VariableExpense.paid` / `paymentMethod` — já consumidos por resumo de "em
  aberto" (`open-expenses.ts`) e filtros de `/gastos`.
- `CreditCard.limitCents` — usado só contra a fatura da competência exibida
  (`availableCardLimitCents`, `src/lib/invoices.ts:516`); não considera parcelas
  futuras nem gera alerta de proximidade de limite.
- `CardPurchase.installmentNumber/installmentsTotal` — rateio correto; parcelas
  futuras projetadas em 1–3 meses (`future-commitments.ts`) e exibidas em
  `/cartoes`.
- `FixedExpense.startMonth/endMonth` — vigência usada no cálculo; `upcoming.ts`
  sinaliza contas terminando em até 2 meses.
- `AppSettings` — `cycleStartDay` e `savingsGoalCents` (meta de economia);
  sem orçamento por categoria, preferências de alerta ou notificações.
- `ShoppingItem` — lista de compras com preço estimado, origem do preço e
  marcação de comprado (não gera gasto automaticamente).
- `MonthlySnapshot`/`MonthlyCategorySnapshot` — histórico imutável, base para
  tendências por categoria.

## 3. Inventário de features (o que funciona hoje)

- **Autenticação:** login único da família por `FINFAM_USER`/`FINFAM_PASS`,
  cookie assinado, middleware protegendo rotas, logout.
- **Dashboard em 4 zonas** (`dashboard-layout.ts`): *Resumo do ciclo*, *Ações*,
  *Compromissos* e *Explorar*; blocos em erro viram `failed` e a zona só aparece
  se tiver bloco válido. 15 blocos mapeados: `month-spend`, `shopping-list`,
  `spend-advice`, `quick-expense`, `daily-allowance`, `card-adjustment`,
  `income-allocation`, `daily-consumption`, `category-breakdown`, `savings-goal`,
  `future-commitments`, `purchase-simulator`, `open-expenses`, `family-help`,
  `month-review`.
- **Moldura de ciclo:** `cycleStartDay` configurável (1–28); `?mes=YYYY-MM`
  navega ciclos; ciclo fechado recalculado ao vivo; ciclo futuro em prévia.
- **Indicadores do dashboard:** `%` da renda consumida, cor verde→vermelho,
  projeção de fechamento, dias restantes, valores em R$, consumo disponível,
  linha de fatura a pagar no ciclo e valor "hoje você pode gastar".
- **Orientação de gasto:** card "Pode gastar por dia" (`DailyAllowanceCard`) e
  alerta único de ritmo (`SpendAdviceCard`) com estouro/adiantado/atrasado/no
  ritmo e projeção de economia.
- **Lançamento rápido:** despesa avulsa e **entrada avulsa** (`quick-expense.ts`
  e `quick-income.ts`) no dashboard; categoria sugerida (`CategoryDatalist`).
- **A pagar / em aberto:** resumo de gastos com `paid=false` na janela do ciclo
  e no mês (`open-expenses.ts`), com ação de marcar como pago.
- **Próximos vencimentos:** `upcoming.ts` lista fixas e faturas que vencem no
  ciclo, ordenadas, e avisa contas perto do fim da vigência.
- **Comprometimento futuro:** `future-commitments.ts` projeta parcelas dos
  cartões nos próximos 1–3 meses; exibido em `/cartoes`.
- **Meta de economia:** `savingsGoalCents` em `AppSettings`, card de progresso
  (`SavingsGoalCard`), prévia diária em `/configuracoes` e uso no alerta de
  ritmo e no simulador.
- **Simulador "Posso comprar?":** valor + parcelas; impacto pela 1ª parcela,
  demais informativas; considera a meta de economia; IA opcional com fallback
  local determinístico.
- **Gráficos (SVG/CSS puro):** alocação da renda, consumo por dia (com
  marcadores de vencimento), gastos por categoria e evolução mensal.
- **Ajuda à família:** insights determinísticos (renda insuficiente, categoria
  acima da média — no máximo 2 alertas, variação diária) + resumo por IA
  opcional com fallback local.
- **Avaliação de mês fechado:** resumo local e, opcionalmente, IA com cache em
  `MonthlyReview`.
- **Entradas:** CRUD de entradas fixas (vigência, ativar/desativar) e avulsas
  por data/mês; aviso de mês futuro.
- **Saídas fixas:** CRUD com categoria, dia de vencimento, vigência e
  ativação/desativação reversível.
- **Gastos avulsos:** CRUD por mês, categoria com sugestões, forma de pagamento,
  marcação "pago", **filtros por descrição/categoria/forma/status persistidos na
  URL** (`expense-filters.ts`), total do mês e confirmação de exclusão.
- **Cartões:** CRUD de cartões e compras parceladas com categoria; fatura pela
  competência de vencimento; "definir total da fatura" com lançamento de ajuste;
  importação de fatura CSV no padrão Nubank com pré-visualização (`dryRun`),
  substituição transacional e classificação local/IA; limite disponível da
  competência exibida.
- **Lista de compras:** CRUD, classificação essencial/desejável, preço manual ou
  pesquisado (SerpAPI opcional), planejamento do gasto no card do dashboard.
- **Histórico:** snapshots imutáveis de meses fechados (captura sem cron),
  tabela dos últimos meses, evolução e comparativo por categoria + insights.
- **Configurações:** dia de início do ciclo, meta de economia e bloco
  "Baixar meus dados" (exportação JSON e CSV por tabela via `GET /api/export`).
- **Ajuda/glossário:** `/ajuda` com termos do produto (`glossary.ts`) e links de
  contexto (`TermHelpLink`).
- **PWA/navegação:** instalável, service worker, tela offline, menu lateral
  responsivo com recolhimento automático e opção de fixar.
- **Qualidade:** 114 arquivos de teste unitário, 16 de integração, 19
  `route.test.ts`; gate (typecheck/lint/test/build) e job de integração no CI.

## 4. Entregas desde a análise anterior (task #360)

As ondas 1–3 de `docs/ANALISE_MELHORIAS.md` foram **majoritariamente
implementadas** entre #361 e #377:

- Documentação: **ainda não corrigida** (ver §5.1).
- Total "a pagar/em aberto": entregue (`open-expenses.ts`, `OpenExpensesCard`).
- Comprometimento futuro de parcelas: entregue (`future-commitments.ts`).
- Utilização do limite do cartão: **parcial** (só fatura da competência).
- Meta de economia: entregue (`savingsGoalCents` + card + prévia).
- Próximos vencimentos/fim de vigência: entregue (`upcoming.ts`).
- Entrada rápida de receita: entregue (`quick-income.ts`).
- Busca/filtros em `/gastos`: entregue (`expense-filters.ts`).
- Exportação/backup: entregue (`export-data.ts` + `/api/export`).
- Simulador parcelado contra a meta: entregue.
- Extras posteriores: zonas do dashboard (#361), meta, lista de compras (#376),
  "hoje você pode gastar" (#377), exportação (#372), glossário/ajuda.

## 5. Lacunas e oportunidades verificadas

### 5.1 Concretas (fricção/dado subutilizado/documentação errada)

1. **Documentação desatualizada:** `README.md:47,63,343` ainda diz "9 tabelas"
   (são 11) e `README.md:351` diz que `/historico` é placeholder (já existe).
   `docs/DASHBOARD_CHARTS.md:35,55,120,173` descreve `/historico` como
   placeholder e cita `src/lib/day-rating.ts` (inexistente).
   `docs/ARCHITECTURE.md` mostra árvore antiga (`src/app/page.tsx`, sem
   `src/app/(app)`, sem as rotas/áreas atuais).
2. **Limite do cartão incompleto:** `availableCardLimitCents` subtrai apenas a
   fatura da competência exibida (`src/lib/invoices.ts:516-521`); não desconta
   parcelas de meses futuros nem alerta em ≥80%/≥100% do limite.
3. **Simulador sem veredito futuro:** as parcelas 2..N são apenas informativas;
   não há veredito para os meses seguintes nem confronto com o comprometimento
   futuro já projetado.
4. **Insights limitados a 2 categorias:** `MAX_CATEGORY_ALERTS = 2`
   (`src/lib/family-insights.ts:70`); não há ranking completo de categorias em
   crescimento.
5. **Sem acompanhamento de limites por categoria:** não há orçamento/envelope
   por categoria; a meta de economia é global do ciclo.
6. **Sem painel de recorrências/assinaturas:** busca por `recorr`/`assinatura`
   em `src` só encontra o comentário "não recorrentes" em `variable-incomes.ts`;
   não há detecção de cobranças repetidas nem candidatos a revisão/cancelamento.
7. **Sem fluxo de caixa 30/60 dias:** não há projeção combinando entradas
   previstas, fixas e parcelas futuras (busca por "fluxo de caixa" vazia).
8. **Sem "melhor dia de compra":** `purchaseInvoice` já existe, mas nada informa
   em qual fatura/vencimento uma compra feita hoje cairia.
9. **Login sem proteção contra força bruta:** não há rate limit/tentativas no
   `POST /api/auth/login` (fora do escopo da SPEC; só registrar como risco se a
   próxima fase considerar segurança).
10. **Cobertura de integração depende de ambiente:** 16 suítes exigem
    `TEST_DATABASE_URL`; sem ele o `test:integration` falha com mensagem
    explícita (o CI cobre o caminho com PostgreSQL).

### 5.2 Oportunidades para a fase de análise (hipóteses, não compromissos)

- **Economizar:** orçamento por categoria (envelopes), sugestão "quanto guardar
  por dia", simulador de corte ("se reduzir categoria X em R$ Y…"), fluxo de
  caixa 30/60 dias.
- **Antecipar surpresas:** limite do cartão com parcelas futuras e alerta de
  proximidade, melhor dia de compra, veredito de parcelamento para os próximos
  meses, aviso de fatura/vencimento mais proeminente.
- **Entender gastos:** ranking completo de categorias em crescimento, painel de
  assinaturas/recorrências, custo por dia/semana por categoria, detecção de
  recorrência na importação CSV.
- **Conveniência/dados:** relatório mensal exportável (o export bruto existe),
  onboarding do dashboard denso (15 blocos), revisão de acessibilidade dos
  blocos mais novos, testes E2E dos fluxos de lista de compras/meta.
- **Dívida de documentação:** corrigir README/ARCHITECTURE/DASHBOARD_CHARTS
  (§5.1) para as próximas fases não trabalharem com informação errada.

### 5.3 Decisões que não devem ser reabertas sem pedido explícito

- **Consumo:** `%` inclui fixas + avulsos + compras do cartão; consumo disponível
  é métrica informativa; faturas e avulsos são variável, nunca obrigação fixa.
- **Moldura temporal:** dashboard usa ciclo; CRUDs, `/historico` e snapshots
  usam mês calendário.
- **Competência da fatura:** fechamento inclusivo, impacto no mês de vencimento;
  importação CSV segue a maioria das linhas.
- **Snapshots de mês fechado são imutáveis** (correção só com `--force`).
- **Privacidade:** IA recebe somente agregados numéricos; exceção documentada é
  a classificação de títulos na importação de fatura.
- **Sem biblioteca de gráficos**; sem `new Date()`/`Date.now()` em funções puras.
- **Fora de escopo (SPEC §8):** Open Finance/importação bancária automática,
  notificações push, app nativo e múltiplos perfis/permissões.

## 6. Insumos para as próximas fases

- **Analista:** converter §5.1/§5.2 em lacunas priorizadas, separando **bug/doc
  desatualizado** de **sugestão opcional**; indicar dependências e o que já está
  entregue (não reabrir §5.3). Considerar que o dashboard já está denso (15
  blocos) e que novas propostas precisam justificar onde entram nas 4 zonas.
- **Auditor de UX:** avaliar fluxos de `/compras`, `/configuracoes` (meta +
  exportação), os 15 blocos do dashboard (carga cognitiva, estados
  vazio/erro/carregando) e acessibilidade dos componentes mais recentes.
- **Propositor:** consolidar em propostas verticais (lib pura + tela + testes),
  sempre atualizando testes existentes e citando critérios de aceite; propostas
  ficam pendentes de aceite humano.

## 7. Evidência

Comandos e saídas reais desta fase (nenhum código de produção alterado):

```text
$ git branch --show-current
autoia/task-379
$ git status --short
(limpo antes deste documento)
$ git rev-parse --short HEAD
8f59342

$ npm ci
added 402 packages, and audited 403 packages in 33s
19 vulnerabilities (9 moderate, 7 high, 3 critical)

$ npm run typecheck
> tsc --noEmit
TYPECHECK_EXIT=0

$ npm run lint
✖ 1 problem (0 errors, 1 warning)   # src/lib/env.test.ts:17 '_omitted'
LINT_EXIT=0

$ npm test
 Test Files  114 passed (114)
      Tests  1360 passed (1360)
TEST_EXIT=0

$ npm run build
 ✓ Compiled successfully
BUILD_EXIT=0
```

Inventário verificado no código:

```text
$ grep -c "^model " prisma/schema.prisma   # 11
$ grep -c "^enum " prisma/schema.prisma    # 2
$ ls prisma/migrations                     # 8 migrations + migration_lock.toml

$ find src -name '*.integration.test.ts' | wc -l   # 16
$ find src -name '*.test.ts' ! -name '*.integration.test.ts' | wc -l  # 114
$ find src/app -name route.test.ts | wc -l        # 19
$ find src/app/api -name route.ts | wc -l         # 24

$ grep -n "9 tabelas\|placeholder" README.md
47:# 3. criar o schema (9 tabelas + enum PaymentMethod)
63:... as 9 tabelas ...
343:Fundação de dados pronta: ... (9 tabelas + enum ...)
351:Falta apenas a tela /historico (hoje placeholder) ...

$ grep -n "day-rating\|placeholder" docs/DASHBOARD_CHARTS.md
35:... placeholder ...
55:  - rateDay usa o orçamento livre (src/lib/day-rating.ts).
120:- /historico é placeholder ...
173:src/app/(app)/historico/page.tsx (placeholder).

$ grep -rn "limitCents" src --include=*.ts --include=*.tsx | grep -v test
src/components/CreditCardsManager.tsx:21,234-236,344,423-425
src/lib/invoices.ts:516-521
src/lib/export-data.ts:90
src/lib/validation.ts:90
# availableCardLimitCents = limite - fatura da competência; sem parcelas futuras

$ grep -rni "recorr\|assinatura" src --include=*.ts --include=*.tsx | grep -v test
src/lib/variable-incomes.ts:2: * ... (não recorrentes).
```

**Pendências desta fase:** os testes de integração não foram executados neste
sandbox por ausência de `DATABASE_URL`/`TEST_DATABASE_URL` (o job de integração
do CI cobre esse caminho). Não houve mudança de banco/migration nem de código.
