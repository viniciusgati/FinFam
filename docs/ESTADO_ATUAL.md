# FinFam — Estado atual e insumos para sugestões de melhoria (task #360)

> **Fase 0 — iniciador (analyze)** do pipeline de brainstorming
> `iniciador-analista-ux-propositor` da task #360 ("Sugestões de melhorias").
> Objetivo desta fase: mapear o estado atual do repositório para as próximas
> fases (analista, auditor de UX e propositor) — **nenhum código de produção foi
> alterado**. Branch `autoia/task-360`, HEAD `7812772` (base = `autoia/task-358`
> já integrada em `main`). Data da análise: 09/11/2026.

## 1. Objetivo e escopo

O pedido da tarefa é aberto: *"identificar o uso, verificar as features e bolar
novas funcionalidades, novas informações válidas, novas opções para
economizar"*. Esta fase **não decide** quais melhorias serão feitas: ela
inventaria o que existe, o que já está coberto pelas regras do produto e quais
lacunas/oportunidades concretas as próximas fases devem priorizar.

O repositório já tem fundação madura (código, banco, testes e CI). Portanto não
há trabalho de bootstrap: o entregável é este mapa de estado.

## 2. Stack e estrutura

### 2.1 Stack

- **Next.js 15 (App Router)** fullstack (páginas + rotas de API no mesmo app)
- **React 19** + **TypeScript**
- **Tailwind CSS v4** (sem biblioteca de gráficos: SVG/CSS puro)
- **Prisma ORM 6** + **PostgreSQL** (dinheiro em centavos inteiros)
- Sessão com cookie `httpOnly` assinado por **jose**; credenciais por env
- **Vitest** para unitários e integração
- **PWA manual** (manifest + `public/sw.js` + tela `/offline`)
- IA opcional via **DeepSeek** (sem chave, fallback determinístico local)

### 2.2 Rotas de interface e APIs

Páginas (`src/app`):

| Rota | Estado |
| --- | --- |
| `/login` | login da família por env |
| `/` | dashboard do ciclo (corrente, fechado ou prévia futura) |
| `/entradas` | entradas fixas + entradas avulsas por mês |
| `/saidas` | saídas fixas (CRUD, categoria, vigência, ativar/desativar) |
| `/gastos` | gastos avulsos por mês (CRUD, categoria, pagamento, pago) |
| `/cartoes` | cartões, compras/parcelas, fatura, ajuste de total e importação CSV |
| `/historico` | snapshots mensais, evolução e comparativo por categoria |
| `/configuracoes` | dia de início do ciclo financeiro |
| `/offline` | fallback do service worker |

APIs (`src/app/api`): autenticação (`login`, `logout`), CRUDs de
`incomes`, `variable-incomes`, `fixed-expenses`, `variable-expenses`,
`credit-cards`, `card-purchases`, `settings`, importação/ajuste de fatura
(`card-invoices/import`, `card-invoices/set-total`) e três rotas de IA
(`ai/family-help`, `ai/month-review`, `ai/purchase-simulator`).

### 2.3 Organização do código

- `src/lib/*` — lógica de domínio **pura** (testável sem banco/rede), incluindo
  `finance`, `cycle`, `dashboard`, `dashboard-series`, `dashboard-charts`,
  `invoices`, `category-breakdown`, `family-insights`, `spend-advice`,
  `history`, `snapshots`, `settings`, `time`, `money`, `validation`, `ai/*`.
- `src/components/*` — apresentação e formulários client; vários têm teste com
  `renderToStaticMarkup`.
- `src/app/**` — páginas e rotas apenas orquestram carga/validação.
- `prisma/` — schema (10 modelos + enum `PaymentMethod`), 6 migrations e scripts
  `seed.ts`/`snapshots.ts`.
- `docs/` — SPEC, ARCHITECTURE, DASHBOARD_CHARTS, SNAPSHOTS e USABILITY_AUDIT.

### 2.4 Modelo de dados (10 tabelas)

`incomes`, `variable_incomes`, `fixed_expenses`, `credit_cards`,
`variable_expenses`, `card_purchases`, `monthly_snapshots`,
`monthly_category_snapshots`, `app_settings`, `monthly_reviews`.

Campos relevantes para melhorias futuras e que hoje são pouco ou nada usados na
interface:

- `VariableExpense.paid` e `paymentMethod` (existe, mas não há visão agregada de
  "em aberto" nem de próximos vencimentos).
- `CreditCard.limitCents` (exibido no cadastro, mas não há uso/alerta de limite).
- `CardPurchase.installmentNumber/installmentsTotal` (rateio correto por
  competência; não há projeção de parcelas futuras no dashboard).
- `FixedExpense.startMonth/endMonth` (vigência usada no cálculo; não há alerta
  de conta terminando/renovando).
- `AppSettings` tem **apenas** `cycleStartDay` (sem metas, orçamento por
  categoria, preferências de alerta ou notificação).
- `MonthlySnapshot`/`MonthlyCategorySnapshot` (histórico imutável já serve de
  base para tendências por categoria).

## 3. O que funciona hoje (inventário de features)

- **Autenticação:** login único da família por `FINFAM_USER`/`FINFAM_PASS`,
  cookie assinado, middleware protegendo rotas, logout.
- **Dashboard com moldura de ciclo:** `cycleStartDay` configurável (1–28);
  `?mes=YYYY-MM` navega ciclos; ciclo fechado é recalculado ao vivo; ciclo futuro
  é pré-visualizado com o que já está lançado.
- **Indicadores do dashboard:** `%` da renda consumida (protagonista), cor
  verde→vermelho, projeção de fechamento, dias restantes, valores em R$
  (renda/consumido/disponível/projetado) e linha informativa de fatura a pagar.
- **Orientação de gasto:** card "Pode gastar por dia" (diária restante do ciclo),
  alerta único de ritmo (`SpendAdviceCard`) com estouro/adiantado/atrasado/no
  ritmo e projeção de economia no estado "atrasado".
- **Lançamento rápido:** gasto avulso no dashboard com data, valor, descrição e
  categoria sugerida (`CategoryDatalist`) — sem entrada rápida de receita.
- **Gráficos (SVG/CSS puro):** "Para onde vai a renda" (alocação da renda),
  "Consumo por dia" (consumo variável + marcadores de vencimento),
  "Gastos por categoria" (com tabela, legenda e estado vazio) e, no histórico,
  "Evolução dos meses".
- **Ajuda à família:** insights determinísticos (renda insuficiente, categoria
  acima da média, variação diária) + resumo opcional por IA com fallback local.
- **Avaliação de mês fechado:** resumo local e, opcionalmente, IA com cache em
  `MonthlyReview`.
- **Simulador "Posso comprar?"** (somente ciclo corrente e compra à vista):
  veredito local `ok`/`cuidado`/`nao` + justificativa opcional por IA.
- **Entradas:** CRUD de entradas fixas (vigência, ativar/desativar) e de entradas
  avulsas por data/mês; aviso de mês futuro.
- **Saídas fixas:** CRUD com categoria, dia de vencimento, vigência e
  ativação/desativação reversível.
- **Gastos avulsos:** CRUD por mês, categoria com sugestões, forma de pagamento,
  marcação "pago", total do mês e confirmação de exclusão.
- **Cartões:** CRUD de cartões e compras parceladas com categoria; fatura pela
  competência de vencimento; "definir total da fatura" com lançamento de ajuste;
  importação de fatura CSV no padrão Nubank com pré-visualização (`dryRun`),
  substituição transacional e classificação local/IA.
- **Histórico:** meses fechados viram snapshots imutáveis (captura sem cron),
  tabela dos últimos 4 meses, evolução e comparativo por categoria, além de
  insights da família.
- **Configurações:** apenas o dia de início do ciclo financeiro.
- **PWA/navegação:** instalável, service worker, tela offline, menu lateral
  responsivo com recolhimento automático e opção de fixar.
- **Qualidade:** testes unitários abrangentes, suítes de integração e CI com job
  de gate (typecheck/lint/test/build) e job de integração com PostgreSQL.

## 4. Decisões já fixadas (não reabrir sem pedido explícito)

- **Modelo de consumo:** `%` inclui fixas + avulsos + compras do cartão; o
  "consumo disponível" (`entradas − fixas`) é métrica informativa; faturas e
  avulsos são **consumo variável**, nunca obrigação fixa (SPEC §3.2/§4.5).
- **Moldura temporal:** dashboard usa o **ciclo**; CRUDs, `/historico` e
  snapshots usam o **mês calendário** (SPEC §4.1/§5).
- **Competência da fatura:** fechamento inclusivo e impacto no mês de vencimento
  (SPEC §3.4); importação CSV segue a maioria das linhas.
- **Snapshots de mês fechado são imutáveis** (correção só com `--force`).
- **Privacidade:** IA recebe somente agregados numéricos; a exceção documentada
  é a classificação de títulos na importação de fatura CSV (SPEC §7).
- **Sem biblioteca de gráficos** e sem `new Date()`/`Date.now()` em funções
  puras (datas injetadas; fuso da família).
- **Fora de escopo atual (SPEC §8):** Open Finance/importação bancária
  automática, notificações push, app nativo e múltiplos perfis/permissões.
  Qualquer proposta nessas frentes exige decisão de produto do usuário.

## 5. Lacunas concretas observadas

Lacunas de **código/dados já existentes** (não são opinião de UX; são recursos
subutilizados ou fricções verificáveis):

1. **`paid` sem visão agregada:** `/gastos` marca "Pago"/"Em aberto", mas o
   dashboard não mostra total em aberto nem "contas a pagar".
2. **Limite do cartão não usado:** `limitCents` só aparece no cadastro; não há
   indicador de limite usado/disponível nem alerta de proximidade.
3. **Parcelas futuras sem projeção:** o app calcula a fatura do mês, mas não
   mostra quanto já está comprometido nos meses seguintes.
4. **Vigência de contas fixas sem alerta:** `startMonth`/`endMonth` são
   calculados, porém não há aviso de conta perto do fim/renovação.
5. **Configurações minimalistas:** só existe `cycleStartDay`; não há meta de
   economia, orçamento por categoria, limites de alerta ou preferências.
6. **Simulador limitado:** a compra simulada é à vista e isolada; não há
   simulação parcelada nem comparação com uma meta de economia.
7. **Sem entrada rápida de receita:** o dashboard só permite lançar despesa.
8. **Sem busca/filtro em `/gastos`:** apenas navegação por mês; não há filtro por
   categoria, forma de pagamento ou status.
9. **Sem exportação/backup:** o único "import" é a fatura CSV; não há exportação
   dos dados da família nem relatório mensal.
10. **Sem recorrências/assinaturas:** `FixedExpense` cobre contas fixas, mas não
    há conceito de assinatura/serviço recorrente para revisão e cancelamento.
11. **Documentação parcialmente desatualizada:** o README ainda diz "9 tabelas"
    (são 10) e "falta apenas a tela /historico (hoje placeholder)" (já
    implementada); `docs/ARCHITECTURE.md` descreve a árvore antiga
    (`src/app/page.tsx`); `docs/DASHBOARD_CHARTS.md` cita
    `src/lib/day-rating.ts`, que não existe mais.

## 6. Oportunidades de novas informações/funcionalidades (hipóteses)

Insumos para a fase de análise (analista) priorizar. São **hipóteses**, não
compromissos de escopo; cada uma deve ser confrontada com a SPEC e com o esforço
real.

### 6.1 Planejar e economizar

- **Meta de economia/reserva** por ciclo ou mês: valor-alvo, quanto já foi
  guardado e "quanto guardar por dia" (integrável à diária disponível).
- **Orçamento por categoria (envelopes):** limite mensal por categoria, consumo
  realizado, restante e alerta preventivo ao passar de X%.
- **Regra de alocação da renda** (ex.: 50/30/20 ou percentuais livres) mostrando
  o que é essencial, estilo de vida e poupança.
- **Projeção de sobra do ciclo** ("no ritmo atual, você fecha com R$ X") usando
  renda, fixas e consumo variável já calculados.

### 6.2 Antecipar e evitar surpresas

- **Próximos vencimentos:** lista ordenada de contas fixas e faturas no ciclo,
  com status pago/em aberto.
- **Comprometimento futuro:** parcelas de cartão e fixas já contratadas nos
  próximos 1–3 meses (evita sensação de "dinheiro livre" que já tem destino).
- **Limite do cartão:** usado/disponível, projeção de estouro e alerta.
- **Melhor dia de compra:** usando `closingDay`/`dueDay`, informar em qual fatura
  uma compra feita hoje cairia e quando vence.
- **Fluxo de caixa de 30/60 dias:** entradas previstas, fixas e parcelas.

### 6.3 Entender e reduzir gastos

- **Painel de assinaturas/recorrências:** detectar/itens recorrentes, custo
  mensal total e candidatos a revisão/cancelamento.
- **Categorias que mais crescem:** ranking de variação contra a média histórica
  (hoje só há alerta das 2 categorias que passam do limite).
- **Detecção de recorrência na importação CSV:** identificar cobranças repetidas
  e sugerir transformá-las em saída fixa/assinatura.
- **Simulador de parcelamento e de corte:** "e se eu parcelar em N vezes?" e
  "se eu reduzir a categoria X em R$ Y, quanto sobra no ciclo?".
- **Custo por dia/semana por categoria:** leitura mais acionável que o total do
  mês para gastos do dia a dia.

### 6.4 Conveniência e dados

- **Entrada rápida de receita** no dashboard (hoje só despesa).
- **Busca e filtros em `/gastos`** por descrição, categoria, forma de pagamento
  e status (pago/em aberto).
- **Exportação/backup** dos dados (CSV/JSON) e **relatório mensal** para a
  família.
- **Notas/anexos ou marcação de recorrência** em gastos (depende de decisão de
  escopo e possivelmente de schema).
- **Onboarding/glossário dos conceitos** (ciclo × mês, competência de fatura,
  `%` × consumo disponível, níveis de cor) — auditoria anterior já registrou a
  lacuna; pode ser retomado se ainda não entregue.

### 6.5 Frentes que exigem decisão de produto

Open Finance, notificações push, múltiplos perfis e app nativo continuam fora do
escopo da SPEC §8. Propostas nessas frentes só devem avançar se o usuário mudar
a decisão explicitamente.

## 7. Insumos para as próximas fases

- **Analista (fase 1):** converter as lacunas/hipóteses acima em tarefas e
  lacunas priorizadas, separando **lacuna concreta** de **sugestão opcional**;
  indicar dependências, necessidade de migration/`AppSettings` e o que já está
  entregue (não reabrir). O foco pedido pelo usuário é "economizar" e "novas
  informações válidas" — priorizar itens de §6.1–§6.3.
- **Auditor de UX (fase 2):** avaliar como cada proposta se encaixa nos fluxos
  atuais, estados vazio/erro/carregando, textos em pt-BR, acessibilidade e
  onboarding dos novos conceitos (metas, envelopes, comprometimento futuro).
- **Propositor (fase 3):** consolidar em propostas verticais (backend + tela +
  testes na mesma entrega), usando `autoia_tasks.json`; ler
  `docs/ESTADO_ATUAL.md`, `docs/SPEC.md` e, se existir, `docs/PRODUTO.md`; cada
  proposta deve ter contexto, escopo, critérios de aceite e fora de escopo.
  Propostas ficam pendentes de aceite humano.

## 8. Evidência

Comandos e saídas reais desta fase (nenhum código de produção alterado; apenas
este documento):

```text
$ git branch --show-current
autoia/task-360
$ git status --short
(limpo antes deste documento)
$ git rev-parse --short HEAD
7812772

$ npm ci
added 402 packages, and audited 403 packages in 7s

$ npm run typecheck
> tsc --noEmit
TYPECHECK_EXIT=0

$ npm run lint
✖ 1 problem (0 errors, 1 warning)   # src/lib/env.test.ts:17 '_omitted'
LINT_EXIT=0

$ npm test
 Test Files  80 passed (80)
      Tests  886 passed (886)
TEST_EXIT=0

$ npm run build
 ✓ Compiled successfully
BUILD_EXIT=0
```

Inventário verificado no código:

```text
$ grep -c "^model " prisma/schema.prisma
10
# incomes, variable_incomes, fixed_expenses, credit_cards, variable_expenses,
# card_purchases, monthly_snapshots, monthly_category_snapshots, app_settings,
# monthly_reviews

$ find src -name "*.test.ts" | wc -l          # 93
$ find src -name "*.integration.test.ts" | wc -l  # 13
# 80 arquivos unitários + 13 suítes de integração

$ find src/app -name "page.tsx" | sort
src/app/(app)/cartoes/page.tsx
src/app/(app)/configuracoes/page.tsx
src/app/(app)/entradas/page.tsx
src/app/(app)/gastos/page.tsx
src/app/(app)/historico/page.tsx
src/app/(app)/page.tsx
src/app/(app)/saidas/page.tsx
src/app/login/page.tsx
src/app/offline/page.tsx

$ find src/app/api -name route.ts | wc -l
20
```

Leituras-chave: `docs/SPEC.md` (§3–§5 e §8), `docs/ARCHITECTURE.md`,
`prisma/schema.prisma`, `src/app/(app)/page.tsx`, `src/lib/finance.ts`,
`src/lib/cycle.ts`, `src/lib/dashboard.ts`, `src/lib/dashboard-series.ts`,
`src/lib/category-breakdown.ts`, `src/lib/family-insights.ts`,
`src/lib/spend-advice.ts`, `src/lib/history.ts`, `src/lib/invoices.ts`,
`src/lib/settings.ts`, `src/components/{GastosManager,CreditCardsManager,FixedItemsManager,ExtraIncomesManager,InvoiceImportPanel}.tsx`.

**Pendências desta fase:** os testes de integração não foram executados neste
sandbox por ausência de `DATABASE_URL`/`TEST_DATABASE_URL` (o job `integration`
do CI cobre esse caminho); não houve mudança de banco/migration. Verificação
visual em navegador não foi necessária para uma fase de análise sem alteração de
código.
