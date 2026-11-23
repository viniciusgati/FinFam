# FinFam — Lacunas e tarefas para avaliar as features (task #379)

> **Fase 1 — analista (plan)** do pipeline da task #379
> ("Avaliar todas as features, propor melhorias que entreguem valor a elas").
> Base: `docs/ESTADO_ATUAL_379.md` (fase 0) + leitura do código em
> `autoia/task-379` (HEAD `515e89d`). **Nenhum código de produção foi alterado.**
> Este documento é insumo do propositor; não é a lista final de tarefas.

## Lacunas identificadas

### Concretas (documentação errada, dado subutilizado, risco ou regra incompleta)

- **L1 — Documentação divergente do código.** `README.md:47,63,343` ainda fala em
  "9 tabelas" (schema tem 11) e `README.md:351` trata `/historico` como
  placeholder (a tela existe); `docs/ARCHITECTURE.md` mostra árvore antiga
  (`src/app/page.tsx`, sem `(app)`, sem as 24 rotas/áreas atuais);
  `docs/DASHBOARD_CHARTS.md:55` cita `src/lib/day-rating.ts` (inexistente) e
  `:34,120,173` descrevem `/historico` como placeholder. **Impacto:** as
  próximas fases e o onboarding trabalham com aceite errado; revisões podem
  "redescobrir" features já entregues.
- **L2 — Limite do cartão incompleto.**
  `availableCardLimitCents` (`src/lib/invoices.ts:508-521`) desconta **somente**
  a fatura da competência exibida; ignora parcelas futuras já contratadas e não
  gera alerta de proximidade (≥80%/≥100%). **Impacto:** o número exibido em
  `/cartoes` superestima o limite livre e incentiva comprometimento além da
  capacidade; é a lacuna de maior risco financeiro direto.
- **L3 — Simulador "Posso comprar?" sem veredito futuro.**
  `src/lib/ai/purchase-simulator.ts` pesa apenas a 1ª parcela no orçamento do
  ciclo; as parcelas 2..N só aparecem como `futureCommitmentCents` informativo,
  sem confronto mês a mês com orçamento livre, meta de economia ou parcelas
  futuras já projetadas. **Impacto:** uma compra pode ser aprovada hoje e
  inviabilizar ciclos seguintes; a resposta não cobre o horizonte do
  parcelamento.
- **L4 — Insights limitados a 2 categorias.**
  `MAX_CATEGORY_ALERTS = 2` + `slice` em `src/lib/family-insights.ts:70,200`
  escondem a 3ª categoria em diante, mesmo com desvio maior em valor absoluto
  não exibido. **Impacto:** o card "Ajuda à família" pode omitir a principal
  fonte de estouro; falta ranking completo (card pode manter 2, histórico/série
  deve mostrar todas).
- **L9 — Login sem proteção contra força bruta.** `POST /api/auth/login` não tem
  rate limit/tentativas (`src/lib/auth.ts` compara credenciais e assina sessão).
  **Impacto:** risco de segurança de baixa probabilidade (login único da
  família, por env), fora do escopo da SPEC §8, mas deve constar como risco
  consciente se a fase de proposição priorizar segurança.
- **L10 — Integração fora do gate local.** 16 suítes `*.integration.test.ts`
  exigem `TEST_DATABASE_URL`; sem ele só o CI cobre regras de banco (agregação,
  vigência, competência, snapshots). **Impacto:** regressões de domínio podem
  passar no gate local (`npm test`) e só aparecer no CI.
- **L11 — Dashboard denso sem personalização.** 15 blocos em 4 zonas fixas
  (`src/lib/dashboard-layout.ts:18-32`), sem ocultar/recolher/reordenar nem
  lembrança de preferência. **Impacto:** carga cognitiva; ações importantes
  (lançar, pagar) competem com blocos analíticos. A correção depende do
  diagnóstico do auditor de UX, não deve ser presumida.
- **L13 — Débitos pequenos de qualidade.** `src/lib/env.test.ts:17` mantém
  warning `_omitted` no lint (gate verde com 1 warning); o `npm ci` da fase 0
  reportou vulnerabilidades de dependências (9 moderate, 7 high, 3 critical).
  **Impacto:** ruído no gate e risco de dependência; baixo esforço de triagem.

### Oportunidades (funcionalidade ausente que agrega valor; não são bugs)

- **L5 — Sem orçamento por categoria (envelopes).** `AppSettings`
  (`prisma/schema.prisma:181-189`) só tem `cycleStartDay` e `savingsGoalCents`;
  a meta de economia é global do ciclo, sem teto por categoria. **Impacto:**
  dificulta controlar a categoria que estoura; é a evolução natural do
  `category-breakdown` e dos alertas.
- **L6 — Sem painel de recorrências/assinaturas.** Busca por `recorr|assinatura`
  em `src` só encontra comentário em `src/lib/variable-incomes.ts:2`; não há
  detecção de cobranças repetidas nem candidatos a revisão/cancelamento, nem na
  importação CSV. **Impacto:** assinaturas esquecidas consomem orçamento sem
  visibilidade.
- **L7 — Sem fluxo de caixa 30/60 dias.** Não há projeção combinando entradas
  previstas, contas fixas e parcelas futuras de cartão (`future-commitments.ts`
  cobre só 1–3 meses de cartão, isolado do caixa). **Impacto:** a família não
  antecipa meses apertados nem sabe se o saldo cobre os compromissos.
- **L8 — Sem "melhor dia de compra".** `purchaseInvoice`
  (`src/lib/invoices.ts:138`) já calcula em qual fatura/vencimento uma compra
  cai, mas nada informa isso ao usuário antes de comprar. **Impacto:** perde-se
  uma decisão simples de valor (comprar após o fechamento para empurrar a
  fatura), aproveitando código existente.
- **L12 — Sem relatório mensal legível.** Existe exportação bruta JSON/CSV
  (`src/lib/export-data.ts` + `/api/export`), mas não um resumo mensal
  apresentável/imprimível (renda, gastos por categoria, comparação, destaques).
  **Impacto:** o ritual de revisão do mês fica manual.

## Tarefas sugeridas

> Cada tarefa é vertical (lógica pura em `src/lib` + tela/rota + testes),
> conforme `AGENTS.md`. Novas funções puras exigem `*.test.ts`; regra com banco
> exige `*.integration.test.ts`; migration exige `prisma generate` e mocks.

1. **Corrigir documentação desatualizada (L1).** Atualizar `README.md` (11
   tabelas e `/historico` real), `docs/ARCHITECTURE.md` (árvore atual com
   `(app)`, 24 rotas, áreas) e `docs/DASHBOARD_CHARTS.md` (remover
   `day-rating.ts` e o rótulo de placeholder; documentar `daily-consumption`).
   Verificável por `grep -n "9 tabelas\|placeholder\|day-rating" README.md
   docs/*.md` sem ocorrências incorretas; sem mudança de código.
2. **Completar o limite do cartão (L2).** Criar função pura que calcula limite
   utilizado como fatura da competência **+** parcelas futuras já contratadas
   (janela parametrizada), retornando disponível e estado
   `ok|atenção(≥80%)|estourado(≥100%)`; usar em `CreditCardsManager` com rótulo
   textual acessível. Testes de unidade: limite `null`, fatura 0, exatamente
   80%/100%, parcelas futuras somadas, janela. Atualizar testes existentes de
   `invoices.test.ts`/`CreditCardsManager.test.ts`.
3. **Informar o melhor dia de compra (L8).** Função pura que, dada uma data de
   referência injetada, `closingDay` e `dueDay`, informa em qual fatura a compra
   cai e quantos dias faltam para o próximo fechamento; exibir no simulador e em
   `/cartoes`. Testes de limite: compra no dia do fechamento (inclusivo), dia
   seguinte, virada de ano e mês. Reutiliza `purchaseInvoice` (sem duplicar
   regra de competência).
4. **Veredito futuro no simulador (L3).** Projetar o impacto das parcelas 2..N
   por mês (reutilizando `allocateInstallments`/`buildFutureCommitments`),
   comparando com orçamento livre projetado e meta; devolver rótulo por mês
   (`ok|cuidado|nao`) e um resumo do pior mês. Testes com 1, 2 e 12 parcelas,
   meta atingida/não atingida e compra que estoura só no mês 2. Manter o
   veredito atual do ciclo (não regredir).
5. **Ranking completo de categorias (L4).** Parametrizar o limite de alertas:
   card mantém 2, mas expor ranking completo (com `surplus`, `percentAbove` e
   meses) em `/historico` ou lista expansível no card. Testes com 3+ categorias
   garantindo que o card continua com 2 e o ranking traz todas, ordenado por
   desvio absoluto.
6. **Fluxo de caixa 30/60 dias (L7).** Função pura que projeta, por semana/mês,
   entradas previstas − contas fixas − parcelas de cartão, com janela
   parametrizada (30/60 dias) e data de referência injetada. Exibir na zona
   *Compromissos* ou em `/historico`. Testes de janela, mês sem movimento,
   parcelas fora da janela e independência de `Date.now()`.
7. **Painel de recorrências/assinaturas (L6).** Detectar cobranças repetidas por
   descrição normalizada + categoria/valor em N meses (limiar definido na
   proposição), listar candidatos com valor médio e último mês; opcionalmente
   sugerir recorrência na importação CSV. Testes de normalização, falsos
   positivos, menos de N meses e item isolado.
8. **Orçamento por categoria / envelopes (L5).** Migration para orçamento por
   categoria (tabela nova ou campo estruturado), API e UI em `/configuracoes`,
   consumo no `category-breakdown` e alerta no card/insights. Testes de unidade
   (cálculo de restante/estouro) e integração (persistência, reset por mês,
   snapshot). Depende de decisão de escopo (mensal global vs por mês) na
   proposição.
9. **Relatório mensal legível (L12).** Builder puro a partir dos snapshots
   (renda, consumo, top categorias, variação vs meses anteriores, destaques) e
   uma visão imprimível/exportável em `/historico` ou `/configuracoes`. Testes
   de textos exatos e meses sem base de comparação.
10. **Revisar carga cognitiva do dashboard (L11).** Após o diagnóstico de UX,
    permitir recolher zonas ou ocultar blocos com preferência persistida,
    mantendo a ordem canônica e os estados `empty/future/error`. Testes puros de
    layout (blocos ocultos não quebram zonas; `failed` preservado).
11. **Endurecer o login (L9).** Rate limit simples por IP/usuário com janela
    deslizante e mensagem 429, documentando o risco residual e o escopo
    (single-family). Testes de rota para tentativas repetidas e sucesso após
    janela; não alterar credenciais por env.
12. **Fortalecer o gate de integração (L10).** Documentar/automatizar a
    execução de `test:integration` com banco efêmero quando
    `TEST_DATABASE_URL` existir, e deixar explícito no README/CI o conjunto de
    regras cobertas. Verificável pela saída do script e pela doc; sem mudar
    regra de negócio.
13. **Limpar débitos pequenos (L13).** Remover o warning `_omitted`
    (`src/lib/env.test.ts:17`) e triar `npm audit` (atualizar/comentar
    vulnerabilidades aplicáveis). Verificável por `npm run lint` sem warnings e
    `npm audit` com riscos justificados.

## Priorização

1. **L1 — docs (baixo esforço, alto retorno de confiança).** Corrige informação
   errada que contamina todas as fases; não bloqueia nada.
2. **L2 — limite do cartão (esforço médio, maior valor/risco).** Evita decisão
   financeira errada hoje e cria a base de projeção reutilizada por L3 e L7.
3. **L8 — melhor dia de compra (baixo esforço, valor imediato).** Reusa
   `purchaseInvoice`; entrega decisão simples de alto impacto antes de features
   maiores.
4. **L3 — veredito futuro no simulador (esforço médio).** Depende da projeção de
   L2/L8 e fecha o buraco lógico do simulador sem nova UI complexa.
5. **L4 — ranking de categorias (baixo/médio).** Pequena mudança de parâmetro +
   exposição; alto valor analítico e risco baixo.
6. **L7 — fluxo de caixa 30/60 (esforço alto, valor alto).** Consolida
   entradas/fixas/parcelas; deve vir depois das projeções de cartão para não
   duplicar regra.
7. **L6 — recorrências (esforço médio/alto).** Alto valor de economia
   doméstica; exige definição de limiar e testes de falso positivo.
8. **L5 — orçamento por categoria (maior esforço).** Exige migration, API, UI e
   integração; maior valor estratégico, mas deve vir depois de L2–L7 para não
   competir por escopo e reutilizar o modelo de projeção/séries.
9. **L12 — relatório mensal (baixo/médio).** Fecha o ritual de revisão; depende
   de snapshots já existentes.
10. **L11 — carga cognitiva (médio, dependente de UX).** Só depois do
    diagnóstico do auditor; evita mexer no layout sem evidência.
11. **L9 — login (segurança, esforço médio).** Baixa probabilidade no contexto
    familiar; manter como risco consciente se o escopo for funcional.
12. **L10 e L13 — higiene (baixo esforço).** Podem entrar como tarefas de
    manutenção em qualquer onda; não bloqueiam valor de produto.

**Não reabrir sem pedido explícito:** `%` inclui fixas; consumo disponível é
informativo; dashboard usa ciclo e CRUDs/histórico usam mês; snapshots são
imutáveis; IA só recebe números (exceto títulos na importação CSV); sem
biblioteca de gráficos; Open Finance, push, multiusuário e app nativo seguem
fora de escopo (SPEC §8).

## Evidência

Comandos e saídas reais desta fase (nenhum código de produção alterado):

```text
$ git branch --show-current
autoia/task-379
$ git status --short
(limpo)
$ git log --oneline -3
515e89d docs(estado): mapeia features e lacunas para avaliação (task #379)
8f59342 autoia: merge autoia/task-377
3c23c89 autoia: registra subtarefas implementadas (bookkeeping)

$ npm run typecheck
> tsc --noEmit
TYPECHECK_EXIT=0

$ npm run lint
✖ 1 problem (0 errors, 1 warning)
src/lib/env.test.ts:17:36  warning  '_omitted' is assigned a value but never used  @typescript-eslint/no-unused-vars
LINT_EXIT=0

$ grep -c '^  | "' src/lib/dashboard-layout.ts   # 15 blocos
15
$ grep -n "MAX_CATEGORY_ALERTS\|CATEGORY_ABOVE_FACTOR" src/lib/family-insights.ts
66:export const CATEGORY_ABOVE_FACTOR = 1.2;
70:export const MAX_CATEGORY_ALERTS = 2;
200:  return alerts.slice(0, MAX_CATEGORY_ALERTS);
$ grep -n "9 tabelas\|placeholder" README.md
47:# 3. criar o schema (9 tabelas + enum PaymentMethod)
63:... as 9 tabelas ...
343:Fundação de dados pronta: ... (9 tabelas + enum ...)
351:Falta apenas a tela /historico (hoje placeholder) ...
$ grep -rn "day-rating" docs/DASHBOARD_CHARTS.md
55:  - rateDay usa o orçamento livre (src/lib/day-rating.ts).
```

Leitura de código que fundamenta as lacunas:

```text
src/lib/invoices.ts:508-521  availableCardLimitCents = limite - fatura da competência
src/lib/ai/purchase-simulator.ts  futureCommitmentCents apenas informativo
src/lib/future-commitments.ts     projeção de cartão em 1..3 meses (isolada)
src/lib/spend-advice.ts           alerta de ritmo do ciclo (sem fluxo de caixa)
prisma/schema.prisma:181-189      AppSettings: cycleStartDay + savingsGoalCents
src/lib/dashboard-layout.ts:18-32 15 blocos em 4 zonas fixas
```

**Pendências:** os testes de integração não rodaram neste sandbox por ausência de
`TEST_DATABASE_URL` (o CI cobre o caminho). Não houve alteração de schema,
dependências ou código de produção. O propositor deve consolidar este relatório
com as demais análises em `autoia_tasks.json` (arquivo **não** criado aqui).
