# Auditoria de usabilidade — FinFam (task #379)

Avaliação das features entregues sob a ótica de **fluxos do usuário, feedback
visual, clareza de textos, consistência, acessibilidade e onboarding**. O
projeto tem interface (PWA Next.js), então a auditoria cobre as telas reais e os
componentes que produzem os textos. Nenhum código de produção foi alterado.

Método: leitura dos componentes/páginas e funções puras de texto, confronto com
`docs/SPEC.md` e verificação por `grep`/`find` dos pontos citados. A evidência
está no fim do documento.

## Fluxos do usuário

- **Primeiro acesso/onboarding** — login único (`/login`) leva ao dashboard. Sem
  renda, o dashboard mostra "Sem dados ainda" com CTA "Cadastrar entradas"; sem
  gastos, "Renda cadastrada, sem gastos" com CTA "Registrar gastos"
  (`src/lib/finance.ts:593-612`). Não há checklist de primeira configuração
  (entradas → fixas → cartões → primeira compra/gasto) nem dica de ordem.
- **Consulta diária do ciclo** — dashboard em 4 zonas fixas e 15 blocos
  (`src/lib/dashboard-layout.ts:63-96`), com seletor de mês/ciclo e skeleton na
  troca de mês (`src/components/MonthNavigation.tsx`). O usuário vê `%` da renda
  consumida, valores em R$, diária, projeção e alertas de ritmo.
- **Lançamento rápido** — card no dashboard alterna Despesa/Entrada, forma de
  pagamento (Dinheiro/PIX ou cartão), data, descrição, valor e categoria; salva
  e exibe "Gasto criado"/"Entrada criada" + `router.refresh()`
  (`src/components/QuickExpenseCard.tsx`). Avisa quando o lançamento cai em
  outro ciclo (`savedElsewhereMessage`).
- **CRUD de gastos avulsos** — `/gastos` tem busca com debounce de 300 ms,
  filtros de categoria/pagamento/status, chips removíveis, total filtrado,
  edição, exclusão com `window.confirm`, "Marcar como pago" otimista com
  rollback e estados vazio/filtro sem resultado (`src/components/GastosManager.tsx`).
- **Cartões e fatura** — `/cartoes` importa CSV com `Pré-visualizar` e
  `Substituir competência` (confirmação destrutiva), navega competência
  anterior/próxima, mostra total da fatura, limite disponível, cadastro/edição
  de cartão, lista e formulário de compras
  (`src/components/CreditCardsManager.tsx`, `InvoiceImportPanel.tsx`).
- **Histórico** — `/historico` combina seletor de mês, insights, tabela de meses
  anteriores, gráfico de evolução e comparativo por categoria; estados erro,
  futuro e vazio têm telas próprias (`src/components/HistoryView.tsx`).
- **Ajuda/glossário** — `/ajuda` lista 10 termos com índice âncora, definição e
  exemplo; cards do app usam "Saiba mais" para a âncora
  (`src/app/(app)/ajuda/page.tsx`, `src/lib/glossary.ts`).
- **Configurações/exportação** — define dia de início do ciclo (1–28) e meta de
  economia, com prévia "sua meta equivale a R$ X por dia"; exporta JSON e CSV
  por tabela com feedback de carregamento/sucesso/401/500
  (`src/components/SettingsForm.tsx`, `ExportDataCard.tsx`).
- **Offline** — página dedicada "Você está offline" com verificação de conexão,
  mensagem de falha e "Tentar novamente" (`src/app/offline/page.tsx`).

## Problemas de usabilidade

### Alta severidade (decisão financeira e confiança)

- **Limite do cartão superestima o disponível** — `availableCardLimitCents`
  desconta apenas as parcelas da competência exibida
  (`src/lib/invoices.ts:508-521`), enquanto o glossário promete "limite menos o
  valor **já comprometido** nele" (`src/lib/glossary.ts:87-95`). O rótulo
  "Limite disponível" em `/cartoes` pode induzir uma compra que estoura as
  faturas seguintes; também não há alerta em ≥80%/≥100%.
- **Simulador aprova compra olhando só a 1ª parcela** — o veredito de
  `simulatePurchase` usa apenas `installmentCents`; `futureCommitmentCents` é
  texto informativo (`src/lib/ai/purchase-simulator.ts:73-78,96-131`). O usuário
  recebe "Pode comprar" mesmo quando as parcelas 2..N quebram os ciclos seguintes.
- **Inconsistência ao navegar a competência em `/cartoes`** — `navigateMonth`
  troca o mês local e usa `window.history.replaceState`
  (`src/components/CreditCardsManager.tsx:584-591`), mas o bloco
  "Parcelas dos próximos meses" é renderizado no servidor a partir do `?mes`
  inicial (`src/app/(app)/cartoes/page.tsx:72-83`). Na mesma tela, a fatura muda
  para dezembro e a projeção continua com "Mês-base" de novembro.
- **Nenhum feedback de "em qual fatura esta compra cai" antes de salvar** — o
  formulário de compra pede data, fechamento e vencimento, mas não mostra a
  competência resultante nem o "melhor dia de compra", embora `purchaseInvoice`
  já calcule isso internamente (`src/lib/invoices.ts:138`). Erro de competência
  só é percebido depois de salvar.

### Média severidade (orientação, navegação e acessibilidade)

- **Menu mobile não fecha após navegar** — `AppNav` guarda `open` mas só reage a
  `Escape`; não há efeito em `pathname` (`src/components/AppNav.tsx:23,27,101`).
  No celular, tocar em "Gastos avulsos" mantém a lista aberta cobrindo o conteúdo.
- **Dashboard denso e não personalizável** — 15 blocos em 4 zonas fixas
  (`src/lib/dashboard-layout.ts:18-96`), sem recolher, ocultar ou persistir
  preferência. Em tablet/celular a rolagem é longa e os blocos menos usados
  competem com os acionáveis; a preferência de colapsar o menu já é persistida
  (`nav-collapse.ts`), mas os blocos não.
- **Insights escondem a 3ª categoria em diante** — `MAX_CATEGORY_ALERTS = 2` e
  `alerts.slice(0, MAX_CATEGORY_ALERTS)` (`src/lib/family-insights.ts:70,200`).
  O card "Ajuda à família" pode omitir justamente a maior fonte de estouro e não
  oferece ranking completo.
- **Sem error boundary** — não existe `error.tsx`/`global-error.tsx`. Há
  `loading.tsx` por rota, mas uma exceção de renderização cai na tela padrão do
  Next (em inglês, sem identidade FinFam).
- **Skeleton de `/compras` é o do dashboard** — `/compras` não tem
  `loading.tsx` próprio e herda `(app)/loading.tsx`, que renderiza as zonas do
  dashboard (`src/components/DashboardSkeleton.tsx`). O usuário vê "Resumo do
  ciclo / Ações / Compromissos" enquanto carrega uma lista de compras.
- **Contraste de links abaixo de WCAG AA** — links usam `text-emerald-700`
  (~3,2:1 sobre `surface` `#0f172a` e ~2,6:1 sobre `surface-raised` `#1e293b`)
  em textos de 14–16 px (`OpenExpensesCard.tsx:49`, `FutureCommitmentsCard.tsx:109,115`,
  `ShoppingListCard.tsx:120`, `ExportDataCard.tsx:77,169,193`). O mínimo AA para
  texto normal é 4,5:1; em tablet na sala a leitura piora.
- **Sem skip link/foco no conteúdo** — `AppShell` renderiza `<main>` sem `id` e
  sem gerenciar foco (`src/components/AppShell.tsx:83`); há 9 itens de navegação
  antes do conteúdo em todas as rotas. Teclado e leitor de tela repetem o menu
  inteiro a cada página.
- **Formulários perdem dados ao navegar** — não há `beforeunload` nem blocker de
  rota (`grep` sem ocorrências). Editar uma compra/gasto/cartão e clicar em outra
  entrada do menu ou trocar o mês descarta o preenchimento silenciosamente.
- **Confirmações destrutivas nativas** — exclusões e a substituição de
  competência usam `window.confirm` (`GastosManager.tsx:426`,
  `ExtraIncomesManager.tsx:220`, `ShoppingItemsManager.tsx:371`,
  `CreditCardsManager.tsx:552`, `InvoiceImportPanel.tsx:209`): diálogo do
  navegador fora do tema, sem detalhes visuais e sem desfazer.

### Baixa severidade (consistência e onboarding)

- **Vocabulário inconsistente entre telas** — "Pode gastar por dia" × "Diária";
  "Saídas fixas" × "contas fixas" no texto; "Gastos avulsos" × "Lançamento
  rápido"; "A pagar" (só avulsos em aberto) × "em aberto"; "Compromissos
  futuros" × "Parcelas dos próximos meses"; "Ajuste rápido do cartão" × "Definir
  total da fatura". O glossário ajuda, mas os rótulos de navegação continuam
  técnicos.
- **Ciclo limitado a 1–28, cartão aceita 1–31** — `SettingsForm` define
  `max={28}` e a ajuda manda usar o dia do cartão
  (`src/components/SettingsForm.tsx:165-172`), mas o cartão aceita fechamento
  até 31 (`CreditCardsManager.tsx:1037,1061`). Quem fecha dia 29–31 não consegue
  alinhar o ciclo.
- **Feedback de sucesso some rápido e com durações diferentes** — 3 s em
  `CreditCardsManager.tsx:242`, `FixedItemsManager.tsx:103` e
  `SettingsForm.tsx:66`; 4 s em `GastosManager.tsx:197` e
  `ExtraIncomesManager.tsx:120`. Erros permanecem. Em um tablet longe da tela, a
  confirmação pode passar despercebida.
- **Listas sem busca/paginação em `/cartoes`** — todas as compras e cartões são
  renderizados de uma vez (`CreditCardsManager.tsx:1120`), sem filtro por
  descrição/cartão. `/gastos` tem busca; `/cartoes` não, e cresce com o uso.
- **Login sem apoio de digitação/limite** — não há "mostrar senha", aviso de
  Caps Lock, autofocus nem bloqueio por tentativas (`src/app/login/page.tsx`).
  O usuário vê só "Não foi possível entrar." e pode repetir indefinidamente.
- **README/onboarding divergem do produto** — o README diz "sem exibir valores,
  apenas percentuais" (`README.md:4`), mas o dashboard mostra R$ desde a #224
  (`docs/SPEC.md` §7 e linha 351); o mesmo README ainda fala em "9 tabelas" e
  `/historico` placeholder (`README.md:47,63,343,351`). Quem instala/avalia cria
  expectativa errada antes de abrir o app.
- **Onboarding sem checklist** — o estado vazio do dashboard aponta só para
  `/entradas`; não há sequência guiada para fixas, cartão e primeira compra, nem
  dica de que o dia do ciclo deve casar com o fechamento do cartão.

## Recomendações priorizadas

### P0 — confiança nos números (próxima onda)

1. **Corrigir o limite do cartão (L2)** — calcular disponível = limite − fatura
   da competência − parcelas futuras na janela parametrizada; exibir estado
   `ok | atenção (≥80%) | estourado (≥100%)` em `/cartoes` e alinhar a definição
   do glossário. Benefício: o número deixa de induzir comprometimento excessivo.
2. **Fechar o veredito futuro do simulador (L3)** — projetar parcelas 2..N mês a
   mês contra orçamento/meta e rotular o pior mês ("atenção: estoura em
   fevereiro"). Benefício: evita aprovar compra que quebra ciclos seguintes.
3. **Mostrar a competência e o melhor dia antes de salvar (L8)** — no formulário
   de compra e no simulador, exibir "esta compra entra na fatura de X" e "comprar
   a partir do dia Y cai na fatura seguinte", reutilizando `purchaseInvoice`.
   Benefício: elimina o erro de competência descoberto só depois do lançamento.
4. **Sincronizar a navegação de competência em `/cartoes`** — trocar
   `history.replaceState` por navegação que revalide o servidor (ou elevar o mês
   para a página) para que "Parcelas dos próximos meses" acompanhe a fatura.
   Benefício: a tela para de mostrar duas competências diferentes.

### P1 — orientação e acessibilidade

5. **Fechar o menu mobile ao navegar** — efeito em `pathname` que zera `open`.
   Benefício: o conteúdo fica acessível no toque seguinte.
6. **Deixar o dashboard personalizável (L11)** — recolher/ocultar blocos com
   preferência persistida, começando por "Explorar" e pelos blocos de leitura.
   Benefício: reduz carga cognitiva e prioriza os blocos acionáveis no tablet.
7. **Expor o ranking completo de categorias (L4)** — manter 2 no card e mostrar
   a lista completa expansível em `/historico`, ordenada por desvio. Benefício:
   nenhuma fonte de estouro fica escondida.
8. **Adicionar error boundaries em pt-BR e skeleton por rota** — `error.tsx` na
   raiz do app e um `loading.tsx` para `/compras`. Benefício: falhas mantêm a
   identidade e o contexto; carregamento não mostra blocos errados.
9. **Corrigir contraste e navegação por teclado** — trocar links `emerald-700`
   por um token de link com contraste ≥4,5:1, adicionar skip link, `id` no
   `<main>` e foco no título após navegação. Benefício: leitura e operação
   acessíveis no tablet e por teclado/leitor de tela.
10. **Proteger formulários sujos e uniformizar confirmações** — aviso ao sair
    com alterações não salvas e diálogo próprio (ou `confirm` com detalhes e
    desfazer) para exclusões/substituição de competência. Benefício: evita perda
    silenciosa de lançamentos e torna ações destrutivas previsíveis.

### P2 — consistência, onboarding e higiene

11. **Padronizar o vocabulário e o onboarding** — um único termo por conceito
    ("Diária", "Contas fixas", "Gastos avulsos"), um checklist de primeira
    configuração e atualização do README/SPEC (valores em R$, 11 tabelas,
    `/historico` real). Benefício: menos jargão e menos expectativa errada.
12. **Alinhar o ciclo ao fechamento do cartão** — permitir 1–31 (validando o
    dia no mês) ou deixar explícita a limitação de 28. Benefício: ciclos reais
    de cartão passam a casar com o dashboard.
13. **Uniformizar feedback e escalar listas** — duração única (ou confirmação
    persistente) para sucesso e busca/paginação em `/cartoes`. Benefício:
    confirmação confiável e telas que continuam utilizáveis com muitos dados.
14. **Melhorar o login e documentar o risco** — mostrar senha/Caps Lock e
    rate limit com mensagem 429 (L9). Benefício: menos erro de digitação e
    proteção contra força bruta.
15. **Higiene de gate (L10/L13)** — documentar/automatizar `test:integration`
    com banco efêmero e remover o warning `_omitted`. Benefício: regressões de
    domínio deixam de passar no gate local.

## Evidência

```text
$ git branch --show-current
autoia/task-379
$ git status --short
(limpo antes da auditoria)
$ find src/app -name 'page.tsx' | wc -l
11 (login, dashboard e 9 páginas do app)
$ find src/app/api -name route.ts | wc -l
24
$ grep -c '^  | "' src/lib/dashboard-layout.ts
15 blocos
$ grep -n "MAX_CATEGORY_ALERTS" src/lib/family-insights.ts
70:export const MAX_CATEGORY_ALERTS = 2;
200:  return alerts.slice(0, MAX_CATEGORY_ALERTS);
$ grep -n "availableCardLimitCents" src/lib/invoices.ts
508:export function availableCardLimitCents(
$ grep -n "Limite disponível" src/lib/glossary.ts
88:    term: "Limite disponível",
$ grep -n "history.replaceState\|Mês-base da projeção" \
    src/components/CreditCardsManager.tsx src/app/'(app)'/cartoes/page.tsx
CreditCardsManager.tsx:590: window.history.replaceState(null, "", url.toString());
cartoes/page.tsx:81:  Mês-base da projeção: {monthLabel(referenceMonthKey)}.
$ grep -n "pathname" src/components/AppNav.tsx
23: const pathname = usePathname();
101: const active = isActivePath(pathname, item.href);
# não há efeito que feche o menu mobile quando pathname muda
$ find src/app -name 'error.tsx' -o -name 'global-error.tsx'
(nenhum)
$ grep -rn "beforeunload\|useBlocker\|usePrompt" src
(nenhum)
$ grep -rn "window.confirm" src --include=*.tsx
ExtraIncomesManager.tsx:220, ShoppingItemsManager.tsx:371,
CreditCardsManager.tsx:552, GastosManager.tsx:426,
InvoiceImportPanel.tsx:209
$ grep -n "text-emerald-700" \
    src/components/OpenExpensesCard.tsx \
    src/components/FutureCommitmentsCard.tsx \
    src/components/ShoppingListCard.tsx \
    src/components/ExportDataCard.tsx
OpenExpensesCard.tsx:49  FutureCommitmentsCard.tsx:109,115
ShoppingListCard.tsx:120  ExportDataCard.tsx:77,169,193
# contraste calculado: emerald-700 (#047857) sobre surface (#0f172a) ≈ 3,2:1
#                     emerald-700 sobre surface-raised (#1e293b) ≈ 2,6:1
#                     (WCAG AA texto normal: 4,5:1)
$ grep -n "max={28}\|Entre 1 e 28" src/components/SettingsForm.tsx
165: max={28}
172: Entre 1 e 28. Use o dia de fechamento do cartão para o ciclo
$ grep -n "max={31}" src/components/CreditCardsManager.tsx
1037: max={31}
1061: max={31}
$ grep -n "setTimeout(() => setSuccess\|setTimeout(() => setFeedback" \
    src/components/*.tsx
CreditCardsManager.tsx:242 (3 s)  FixedItemsManager.tsx:103 (3 s)
SettingsForm.tsx:66 (3 s)  GastosManager.tsx:197 (4 s)
ExtraIncomesManager.tsx:120 (4 s)
$ find src/app -name loading.tsx
src/app/loading.tsx
src/app/(app)/loading.tsx          # DashboardSkeleton genérico
src/app/(app)/cartoes/loading.tsx
src/app/(app)/configuracoes/loading.tsx
src/app/(app)/entradas/loading.tsx
src/app/(app)/gastos/loading.tsx
src/app/(app)/historico/loading.tsx
src/app/(app)/saidas/loading.tsx
# /compras não tem loading.tsx próprio → herda o skeleton do dashboard
$ grep -n "sem exibir valores\|9 tabelas\|placeholder" README.md
4: ... sem exibir valores, apenas percentuais
47: criar o schema (9 tabelas + enum PaymentMethod)
63: ... 9 tabelas ... 
343: Fundação de dados pronta: ... (9 tabelas + enum
351: Falta apenas a tela `/historico` (hoje placeholder)
# docs/SPEC.md §7 (e linha 351) registram que a #224 passou a exibir R$ no dashboard
```

Gate executado após a criação deste documento (sem mudança de código):

```text
$ npm run typecheck   → TYPECHECK_EXIT=0
$ npm run lint        → 1 warning (src/lib/env.test.ts:17 '_omitted'), 0 errors → LINT_EXIT=0
$ npm test            → Test Files 114 passed (114) | Tests 1360 passed (1360) → TEST_EXIT=0
$ npm run build       → BUILD_EXIT=0 (24 rotas de API + 11 páginas + /offline + /login)
```

Integração não rodou por ausência de `TEST_DATABASE_URL` (CI cobre).
