# FinFam — Análise de lacunas e tarefas de melhoria (task #360)

> **Fase 1 — analista (plan)** do pipeline de brainstorming da task #360
> ("Sugestões de melhorias"). Insumo lido: `docs/ESTADO_ATUAL.md` (fase 0),
> confrontado com o código atual. **Nenhum código de produção foi alterado.**
> Branch `autoia/task-360`, base `e6f2ff7`.

## 1. Método

As lacunas abaixo foram **verificadas no código** (não são opinião de UX): cada
uma cita o arquivo/linha que evidencia o recurso subutilizado ou a ausência. As
tarefas separam **lacuna concreta** (dado/função já existente sem uso, ou
fricção verificável) de **sugestão opcional** (produto novo, exige decisão de
escopo). O foco do pedido do usuário — *novas informações válidas* e *opções
para economizar* — orienta a priorização.

Decisões do produto que as tarefas **não** podem reabrir: `%` inclui fixas;
consumo disponível é informativo; dashboard usa ciclo × CRUDs/histórico usam
mês; snapshots imutáveis; IA só com números (exceto classificação de CSV);
gráficos sem biblioteca; Open Finance/push/multiusuário/app nativo fora de
escopo.

## 2. Lacunas identificadas

### 2.1 Lacunas concretas (recurso existente subutilizado ou ausência verificável)

- **Gastos "em aberto" sem total agregado** — `VariableExpense.paid` é gravado e
  exibido por linha (`src/components/GastosManager.tsx:557`), mas nenhum cálculo
  de dashboard/lib o consome. O usuário não vê "quanto ainda tenho a pagar";
  risco de decisão de consumo com dinheiro já comprometido.
- **Limite do cartão sem uso** — `CreditCard.limitCents` só aparece no cadastro
  e na listagem (`CreditCardsManager.tsx:903`; `validation.ts:88`). Não há
  cálculo de usado/disponível nem alerta de proximidade do limite.
- **Parcelas futuras sem projeção** — `allocateInstallments` já existe
  (`src/lib/invoices.ts:108`) e é usada para a fatura da janela
  (`dashboard.ts:637-641`), mas não há visão dos meses seguintes. O usuário
  sente "dinheiro livre" que já tem destino.
- **Vigência de contas fixas sem alerta** — `startMonth`/`endMonth` são
  editados/exibidos (`FixedItemsManager.tsx:314-317`) e respeitados no cálculo
  (`isActiveInMonth`), mas não há aviso de conta terminando/renovando.
- **Configurações minimalistas** — `AppSettings` tem apenas `cycleStartDay`
  (`src/lib/settings.ts:11-22`; `validation.ts:191-200`). Não existe meta de
  economia, orçamento por categoria, limite de alerta ou preferência.
- **Simulador restrito** — `simulatePurchase` mede só compra à vista contra a
  diária e o orçamento do ciclo (`src/lib/ai/purchase-simulator.ts`). Não simula
  parcelamento nem confronta com uma meta de economia.
- **Sem entrada rápida de receita** — o lançamento rápido monta
  `paymentMethod: "PIX", paid: true` e chama `variable-expenses`
  (`src/lib/quick-expense.ts`); não há card equivalente para entrada avulsa,
  embora `POST /api/variable-incomes` já exista.
- **Sem busca/filtro em `/gastos`** — a página carrega o mês inteiro e o manager
  não tem filtro por descrição, categoria, forma de pagamento ou status
  (`src/app/(app)/gastos/page.tsx`; `GastosManager.tsx` só remove item da lista).
- **Sem exportação/backup** — não há rota de export; o único fluxo de dados é a
  importação de fatura CSV. A família não consegue tirar seus dados.
- **Sem conceito de assinatura/recorrência** — `FixedExpense` cobre contas
  fixas, mas não há detecção de cobranças repetidas nem painel de revisão.
- **Documentação desatualizada** — README diz "9 tabelas" (`README.md:47,63,307`)
  e "/historico hoje placeholder" (`README.md:315`), quando há 10 modelos e a
  tela existe; `docs/DASHBOARD_CHARTS.md:54` cita `src/lib/day-rating.ts`
  inexistente; `docs/ARCHITECTURE.md` descreve árvore antiga.

### 2.2 Sugestões opcionais (produto novo; exigem decisão de escopo)

- **Meta de economia/reserva** por ciclo ou mês (valor-alvo, guardado e "quanto
  guardar por dia") — alto valor para o pedido de "economizar"; exige schema.
- **Orçamento por categoria ("envelopes")** com limite, realizado, restante e
  alerta preventivo — alto valor; exige schema e onboarding.
- **Regra de alocação da renda (ex.: 50/30/20)** — leitura educativa; função pura.
- **Próximos vencimentos e fluxo de caixa 30/60 dias** — antecipa surpresas.
- **Melhor dia de compra** — usa `closingDay`/`dueDay` para dizer em qual fatura
  a compra cairia; barato, pois `purchaseInvoice` já existe.
- **Painel de assinaturas/recorrências** e detecção na importação CSV.
- **Ranking de categorias em crescimento** — hoje só há até 2 alertas de
  categoria acima da média (`family-insights.ts`, `MAX_CATEGORY_ALERTS = 2`).
- **Simulador de parcelamento e de corte** ("e se eu reduzir X em R$ Y?").
- **Custo por dia/semana por categoria** — leitura acionável do dia a dia.
- **Relatório mensal** para a família (resumo + exportação).
- **Onboarding/glossário** (ciclo × mês, competência de fatura, `%` × consumo
  disponível, níveis de cor).
- **Notas/anexos em gastos** — menor prioridade; possivelmente schema.

## 3. Tarefas sugeridas

Legenda: **[L]** lacuna concreta · **[O]** sugestão opcional · esforço **S/M/L**.
Critério de aceite sempre inclui teste puro novo/atualizado e textos em pt-BR.

1. **[L][S] Corrigir a documentação desatualizada** — atualizar README (10
   tabelas, remover "placeholder" de `/historico`), árvore do `ARCHITECTURE.md` e
   trocar `day-rating.ts` por `spend-advice.ts` no `DASHBOARD_CHARTS.md`. Aceite:
   `grep` não encontra mais as referências antigas; gate verde. Sem schema.
2. **[L][S] Total "a pagar / em aberto"** — nova função pura
   (`src/lib/open-expenses.ts`) que soma `VariableExpense` com `paid=false` na
   janela do ciclo e no mês, com contagem e total; exibir no dashboard (bloco
   informativo, fora do consumo) e no topo de `/gastos`. Testes de entrada/saída
   e de janela. Sem migration.
3. **[L][M] Comprometimento futuro de parcelas** — função pura
   (`src/lib/future-commitments.ts`) usando `allocateInstallments` para devolver
   o comprometido nos próximos 1–3 meses por cartão (e total); card no
   dashboard ou em `/cartoes`. Testes com virada de ano e rateio do resto.
4. **[L][M] Utilização do limite do cartão** — função pura
   (`src/lib/card-utilization.ts`): usado = parcelas ainda não vencidas/em
   aberto, disponível = limite − usado, `%` e alerta em ≥80%/≥100%; UI em
   `/cartoes`. Depende da tarefa 3. Testes de borda (limite nulo, estouro).
5. **[L][M] Meta de economia/reserva** — adicionar `savingsGoalCents` (e
   eventualmente `savingsGoalKind`) em `AppSettings`, migration versionada,
   validação, formulário em `/configuracoes` e card no dashboard com
   alvo/guardado/quanto guardar por dia. Função pura + testes unitários e
   integração (singleton). A meta alimenta o simulador (tarefa 10).
6. **[L][M] Próximos vencimentos e fim de vigência** — função pura
   (`src/lib/upcoming.ts`) listando fixas e faturas que vencem no ciclo, com
   status, ordenadas por dia, e aviso de `endMonth` a ≤2 meses; card no
   dashboard. Testes com `cycleWindow` e `dueDay` no limite do mês.
7. **[L][S] Entrada rápida de receita** — card de lançamento rápido de entrada
   avulsa no dashboard (ou seletor despesa/entrada), reutilizando
   `POST /api/variable-incomes`; extrair payload puro e testá-lo (espelho de
   `quick-expense.ts`).
8. **[L][M] Busca e filtros em `/gastos`** — função pura
   (`src/lib/expense-filters.ts`) por descrição, categoria, forma de pagamento e
   status; persistir filtros na URL; UI com estado vazio. Testes de combinação
   e normalização de categoria.
9. **[L][M] Exportação/backup** — serializador puro (JSON e CSV) + rota
   autenticada `GET /api/export` (dados da família) e link em `/configuracoes`.
   Teste de rota com Prisma mockado (200/401) e teste puro do CSV. Não expor
   segredos; sem migration.
10. **[L][M] Simulador parcelado e contra a meta** — estender
    `simulatePurchase` com `installmentsTotal` e comparação com a meta de
    economia (tarefa 5), mantendo veredito local e IA só com números. Testes dos
    novos estados e do impacto no comprometimento futuro.
11. **[O][L] Painel de recorrências/assinaturas** — detectar descrições
    repetidas em gastos/cartão ao longo dos meses (função pura), total mensal e
    candidatos a revisão; UI em `/historico` ou `/gastos`. Sem schema na 1ª
    versão.
12. **[O][L] Orçamento por categoria (envelopes)** — limite mensal por
    categoria (nova tabela ou JSON em `AppSettings`), realizado/restante e
    alerta preventivo; UI em `/configuracoes` + card. Exige migration,
    onboarding e decisão de escopo.
13. **[O][S] Ranking de categorias em crescimento** — função pura que ranqueia
    todas as categorias pela variação vs. média histórica (além dos 2 alertas
    atuais); exibir em `/historico`. Reutiliza snapshots existentes.
14. **[O][S] Melhor dia de compra** — função pura sobre `purchaseInvoice` para
    informar em qual fatura/vencimento uma compra feita em `data` cairia;
    integrar ao simulador/`/cartoes`.
15. **[O][L] Fluxo de caixa 30/60 dias** — projeção pura combinando entradas
    fixas/avulsas médias, fixas e parcelas futuras; página ou card. Depende das
    tarefas 3 e 6.
16. **[O][S] Custo por dia/semana por categoria** — métrica pura a partir do
    breakdown; exibir em `/gastos` ou dashboard.
17. **[O][M] Onboarding/glossário** — painel de ajuda com os conceitos do
    produto, textos testáveis; retoma lacuna de auditoria UX.
18. **[O][M] Relatório mensal** — resumo do mês fechado (snapshot + categorias)
    com opção de exportar; depende da tarefa 9.

## 4. Priorização

**Onda 1 — ganhos rápidos e correção (alto impacto × baixo esforço):**
tarefas **1, 2, 7, 13, 14**. Corrigem ruído de documentação, dão informação
imediata de "a pagar" e receita rápida, e quase não exigem schema.

**Onda 2 — núcleo de "economizar" (alto impacto × esforço médio):**
tarefas **3, 4, 6, 5**. Comprometimento futuro, limite do cartão, próximos
vencimentos e meta de economia são as informações que mais mudam decisões de
gasto; a meta (5) habilita o simulador ampliado (10).

**Onda 3 — conveniência e dados:** tarefas **8, 9, 10**. Busca/filtros,
exportação/backup e simulador parcelado aumentam o uso diário sem tocar em
decisões de produto novas.

**Onda 4 — estruturantes/opcionais:** tarefas **12, 11, 15, 18, 17, 16**.
Exigem schema, onboarding ou mais tela; ficam pendentes de aceite humano e não
devem competir com as ondas anteriores.

Critério: primeiro o que **expõe dados já existentes** (barato e verificável),
depois o que **previne surpresa** (comprometimento/vencimentos), depois o que
**planeja** (meta/envelopes) e por fim o que **explora histórico** (assinaturas,
fluxo, relatório). Frentes fora da SPEC §8 continuam fora até decisão explícita.

## 5. Evidência

```text
$ git branch --show-current
autoia/task-360
$ git status --short
(limpo antes deste documento)
$ git log --oneline -3
e6f2ff7 docs(estado): mapeia features e lacunas para sugestões de melhoria (task #360)
7812772 autoia: merge autoia/task-358
747d8d6 fix(dashboard): exibe skeleton enquanto a prévia de ciclo futuro carrega (task #358)

$ grep -rn "limitCents" src --include=*.ts --include=*.tsx | grep -v test
src/components/CreditCardsManager.tsx:19,330,409,411,903,904
src/lib/validation.ts:88

$ grep -rn "paid" src --include=*.ts --include=*.tsx | grep -v test
src/components/GastosManager.tsx:28,62,74,207,290,484,485,557
src/lib/variable-expenses.ts:97
src/lib/quick-expense.ts:35,95
# nenhum uso em src/lib/dashboard*.ts / dashboard page

$ grep -rni "export.*csv|exportar|backup" src ...   # nenhum resultado de exportação
$ find src/app/api -path '*export*'                  # vazio
$ grep -rni "quick.*income|receita rápida|QuickIncome" src   # vazio

$ grep -n "9 tabelas|placeholder" README.md
47:# 3. criar o schema (9 tabelas + enum PaymentMethod)
63:... as 9 tabelas ...
307:Fundação de dados pronta: prisma/migrations/ versionada (9 tabelas + enum
315:Falta apenas a tela /historico (hoje placeholder) — ver docs/SPEC.md.

$ grep -n "day-rating" docs/DASHBOARD_CHARTS.md
54:  - rateDay usa o orçamento livre (src/lib/day-rating.ts)

$ grep -c "^model " prisma/schema.prisma
10

$ sed -n '11,22p' src/lib/settings.ts
export interface AppSettings { cycleStartDay: number; }

$ sed -n '191,200p' src/lib/validation.ts
export const settingsUpdateSchema = z.object({ cycleStartDay: ... })
```

Gate executado após este documento (ver saída abaixo no registro da fase):
`npm run typecheck`, `npm run lint`, `npm test` e `npm run build`. Nenhuma
alteração de schema/migration; testes de integração não rodaram neste sandbox
por ausência de `DATABASE_URL`/`TEST_DATABASE_URL` (o job de integração do CI
cobre esse caminho).

## 6. Para a próxima fase

- **Auditor UX:** avaliar o encaixe das ondas 2–3 nos fluxos atuais, estados
  vazio/erro/carregando, textos pt-BR, acessibilidade e onboarding de meta,
  comprometimento futuro e envelopes.
- **Propositor:** consolidar as tarefas 1–10 (ondas 1–3) em propostas verticais
  fullstack via `autoia_tasks.json`, com contexto, escopo, critérios de aceite
  e fora de escopo; tarefas 11–18 ficam como opcionais pendentes de aceite.
  Não reabrir as decisões do §1 nem as frentes da SPEC §8.
