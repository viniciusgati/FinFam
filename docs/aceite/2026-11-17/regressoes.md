# Aceite ponta a ponta — subtarefa 5 (regressões e testes)

Data: 2026-11-17, fuso `America/Sao_Paulo`.
Task: #373 — Aceite ponta a ponta do produto.

Esta evidência consolida a **subtarefa 5**: cada regressão de integração
encontrada nos passos 1–12 / acessibilidade possui correção mínima commitada e
teste automatizado que **falha se a correção for revertida**. Os testes seguem a
tabela do `AGENTS.md` (componente de apresentação com `renderToStaticMarkup`,
função pura em teste ao lado, wiring de componente por leitura de fonte quando
não há test runner de DOM).

## Regressões, correção e teste de guarda

| # | Sintoma encontrado no roteiro | Correção | Teste que guarda |
| --- | --- | --- | --- |
| 1 | Card "A pagar" zerado não renderizava `Nenhum gasto em aberto em <mês> de <ano>.` | `OpenExpensesCard` recebe `emptyLabel`; dashboard passa `monthLabel(referenceMonthKey)` | `OpenExpensesCard.test.ts` → *ao zerar exibe o vazio ... (regressão #373)* e *a página do dashboard passa o mês do ciclo para o vazio do card* |
| 2 | `/cartoes` mostrava só o limite, sem descontar a fatura da competência | `availableCardLimitCents` em `lib/invoices.ts` + linha `Limite disponível R$ ...` | `invoices.test.ts` (`availableCardLimitCents`) e `CreditCardsManager.test.ts` → *exibe limite disponível = limite − fatura da competência (regressão #373)* |
| 3 | `GET /favicon.ico` respondia 404 e gerava `console.error` em toda página | `metadata.icons.icon = "/icons/icon.svg"` em `app/layout.tsx` | `app/layout.test.ts` → *declara favicon para o browser não registrar 404 em /favicon.ico (regressão #373)* |
| 4 | Menu mobile não fechava com `Escape` | listener `keydown` no `AppNav` enquanto o menu está aberto | `AppNav.test.ts` → *fecha o menu mobile ao pressionar Escape (regressão #373)* |
| 5 | Campos de formulário sem `id`/`name` (diagnóstico de acessibilidade do browser) e login sem rótulo associado | `id`/`name` nos formulários de login, dashboard, gastos, entradas, saídas, cartões, configurações, simulador, importação e ajuste; foco visível no login | `login/page.test.ts`, `QuickExpenseCard.test.ts`, `SettingsForm.test.ts`, `MonthSelectorView.test.ts` e `form-a11y-ids.test.ts` (todos citam `regressão #373`/`acessibilidade #373`) |

O novo `src/components/form-a11y-ids.test.ts` fecha a lacuna dos formulários que
receberam `id`/`name` na correção de acessibilidade mas ainda não tinham guarda:
`/gastos` (filtros + formulário), `/entradas`, saídas fixas, `/cartoes` (cartão,
compra e ajuste), simulador de compra, importação de fatura e ajuste rápido do
cartão.

## Falha ao reverter (verificação executada)

Cada verificação reverteu **apenas** o arquivo da correção para o commit
anterior, rodou o teste de guarda e restaurou com `git checkout HEAD --`.

```text
# regressão 1 — revert de OpenExpensesCard.tsx + app/(app)/page.tsx
npx vitest run src/components/OpenExpensesCard.test.ts
→ Test Files 1 failed (1) | Tests 2 failed | 3 passed

# regressão 2 — revert de CreditCardsManager.tsx
npx vitest run src/components/CreditCardsManager.test.ts
→ Test Files 1 failed (1) | Tests 2 failed | 1 passed

# regressão 3 — revert de app/layout.tsx
npx vitest run src/app/layout.test.ts
→ Test Files 1 failed (1) | Tests 1 failed

# regressão 4 — revert de AppNav.tsx
npx vitest run src/components/AppNav.test.ts
→ Test Files 1 failed (1) | Tests 1 failed | 6 passed

# regressão 5 — revert de login/page.tsx
npx vitest run src/app/login/page.test.ts
→ Test Files 1 failed (1) | Tests 1 failed | 1 passed

# regressão 5 — revert de GastosManager/ExtraIncomesManager/CreditCardsManager
npx vitest run src/components/form-a11y-ids.test.ts
→ Test Files 1 failed (1) | Tests 3 failed | 4 passed
```

Depois de cada reversão o arquivo foi restaurado (`git status --short` voltou a
mostrar apenas o novo teste, antes do commit).

## Gate desta subtarefa

```text
npx vitest run src/components/form-a11y-ids.test.ts
# Test Files 1 passed (1) | Tests 7 passed (7)

npm test
# Test Files 107 passed (107) | Tests 1255 passed (1255)

npm run typecheck   # exit 0
npm run lint        # exit 0 (1 warning pré-existente em src/lib/env.test.ts)
npm run build       # exit 0
```

## Ressalvas

- O `npm run lint` mantém **1 warning pré-existente** em `src/lib/env.test.ts`
  (`_omitted` não usado), fora do escopo desta tarefa; **0 erros**.
- Os testes de wiring/acessibilidade que leem a fonte do componente o fazem por
  ausência de test runner de DOM no projeto, seguindo o padrão já usado em
  `gastos-open-filter.test.ts` e `AppNav.test.ts`.
- A suíte de integração e o `RELATORIO.md` final continuam na subtarefa 6.
