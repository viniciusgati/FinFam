# Aceite ponta a ponta — passos 1 a 7 (parcial)

Data: 2026-11-17 (terça-feira), fuso `America/Sao_Paulo`.
Task: #373 — Aceite ponta a ponta do produto.
Esta é a evidência parcial da **subtarefa 2**; os passos 8–12 serão anexados à
versão final (`RELATORIO.md`) na subtarefa 6.

## Ambiente

| Item | Valor |
| --- | --- |
| App | `next start` em `http://127.0.0.1:3222` (build de produção) |
| Banco de aceite | `postgresql://postgres@127.0.0.1:55432/finfam_accept373?schema=public` |
| Migrations | 7 aplicadas via `npm run db:deploy` |
| Seed | `npm run db:seed` concluído |
| Fuso das asserções | `America/Sao_Paulo` |
| Browser | Chromium controlado pelo Chrome DevTools do ambiente |
| Login de teste | `FINFAM_USER=familia` / senha de teste local (não versionada) |
| Sessão | `FINFAM_SESSION_SECRET` definida (valor não registrado) |

Comandos executados (credenciais e segredo carregados de arquivo fora do
repositório; nenhum valor sensível foi impresso nos logs):

```bash
TEST_DATABASE_URL="postgresql://postgres@127.0.0.1:55432/finfam_accept373?schema=public" \
DATABASE_URL="postgresql://postgres@127.0.0.1:55432/finfam_accept373?schema=public" \
npx tsx scripts/acceptance-env.ts prepare
# All migrations have been successfully applied.
# Seed concluído.

NODE_ENV=production npm run build   # exit 0
PORT=3222 HOSTNAME=127.0.0.1 npm run start
```

Validação de ambiente (script `scripts/acceptance-env.ts`):

```text
PASS GET /login -> 200
PASS GET /gastos (sem sessão) -> 302 /login
```

## Valores de referência (funções puras)

Saída real de `loadCycleDashboardData` + `computeFinanceStatus` para o dataset
do seed, no ciclo `2026-11` (início dia 1):

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

Saída real de `buildFutureCommitments`/`invoiceLinesForMonth` para o cartão
(limite definido pela UI em R$ 2.000,00) e a fatura de dezembro/2026:

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

## Roteiro — passos 1 a 7

### Passo 1 — Login inválido — PASS

- Permaneceu em `/login` após o envio.
- Durante a chamada: botão `Entrando...`, `disabled=true`.
- Erro exibido em `role="alert"`: `Usuário ou senha inválidos`.
- Após a resposta: botão voltou a `Entrar`, `disabled=false`.
- Nenhum cookie de sessão foi criado (`document.cookie` vazio) e
  `GET /gastos` sem sessão respondeu `302` para `/login` (script de ambiente).
- Screenshot: [`screenshots/passo-01-login-invalido.png`](screenshots/passo-01-login-invalido.png)

### Passo 2 — Login válido — PASS

- Durante a chamada: botão `Entrando...`, `disabled=true`.
- Ao concluir, navegou para `/` com a navegação `AppNav` visível
  (`Dashboard`, `Entradas`, `Saídas fixas`, `Gastos avulsos`, `Cartões`,
  `Histórico`, `Configurações`, `Ajuda`, `Sair`).
- Screenshot: [`screenshots/passo-02-login-valido.png`](screenshots/passo-02-login-valido.png)

### Passo 3 — Dashboard em zonas — PASS

- Zonas renderizadas como regiões com `aria-labelledby`:
  `RESUMO DO CICLO`, `AÇÕES`, `COMPROMISSOS`, `EXPLORAR`.
- Valores exibidos iguais aos calculados por `finance.ts` no mesmo dataset:
  - `%` da renda consumida: **27%** (`27.414965986394556`).
  - Renda do ciclo: **R$ 14.700,00** (`1470000` centavos).
  - Já consumido: **R$ 4.030,00** (`403000` centavos).
  - Ainda disponível: **R$ 10.670,00** (`1067000` centavos).
  - Projeção até o fim do ciclo: **R$ 4.894,12** (`489412` centavos).
  - Contador: **14 dias para o fim do ciclo** (17/11 a 30/11, contando hoje).
  - Rótulo de nível: **Ok** (`level: "green"`, faixa de coeficiente do SPEC §4.2).
- Screenshot (mesma captura do login válido):
  [`screenshots/passo-02-login-valido.png`](screenshots/passo-02-login-valido.png)

### Passo 4 — Lançar despesa rápida — PASS

- Forma de pagamento `Dinheiro/PIX (já pago)` com o aviso
  `Este lançamento já nasce marcado como pago.`
- Durante o envio: botão `Salvando...`, `disabled=true`.
- Sucesso exibido em `role="status"`: `Gasto criado`.
- Gasto `Aceite despesa 373` de **R$ 12,34** (`1234` centavos) aparece em
  `/gastos` e no dashboard (categoria `Aceite`; consumido foi para
  **R$ 4.042,34**, igual a `status.consumedCents`).
- Screenshots:
  [`screenshots/passo-04-despesa-rapida.png`](screenshots/passo-04-despesa-rapida.png),
  [`screenshots/passo-04-gastos-listagem.png`](screenshots/passo-04-gastos-listagem.png)

### Passo 5 — Lançar entrada rápida — PASS

- Durante o envio: botão `Salvando...`, `disabled=true`.
- Sucesso exibido em `role="status"`: `Entrada criada`.
- Entrada `Aceite entrada 373` de **R$ 100,00** (`10000` centavos) aparece em
  `/entradas`; após reload o dashboard mostra renda de **R$ 14.800,00**
  (`1480000` centavos, igual a `status.incomeCents`).
- Screenshots:
  [`screenshots/passo-05-entrada-rapida.png`](screenshots/passo-05-entrada-rapida.png),
  [`screenshots/passo-05-entradas-listagem.png`](screenshots/passo-05-entradas-listagem.png)

### Passo 6 — "A pagar" e marcar pago — PASS

- Criados dois gastos em aberto pela UI (`20,00` e `30,00`): resumo
  `A pagar no mês: R$ 50,00 · 2 gastos em aberto`.
- Ao marcar o primeiro: mensagem `Gasto marcado como pago`, item sai dos
  pendentes, o resumo cai para `R$ 20,00 · 1 gasto em aberto` (contador −1).
- Ao marcar o último: resumo `A pagar no mês: R$ 0,00 · Nenhum gasto em aberto`.
- No dashboard, o card `A pagar` mostra
  `A pagar no ciclo: R$ 0,00 · Nenhum gasto em aberto` e o vazio
  `Nenhum gasto em aberto em novembro de 2026.`
- Screenshots:
  [`screenshots/passo-06-marcar-pago.png`](screenshots/passo-06-marcar-pago.png),
  [`screenshots/passo-06-a-pagar-zerado.png`](screenshots/passo-06-a-pagar-zerado.png)

### Passo 7 — Compromissos futuros e limite do cartão — PASS

- `FutureCommitmentsCard` (dashboard) e `/cartoes` exibem:
  - dezembro/2026: **R$ 600,00**;
  - janeiro/2027 e fevereiro/2027: **R$ 0,00**.
  - Iguais a `buildFutureCommitments` (parcela 1/1 da compra de 08/11/2026).
- Limite do cartão definido pela UI em **R$ 2.000,00**; fatura de dezembro/2026
  com **R$ 600,00**. `/cartoes` exibe
  `Limite R$ 2.000,00 · Limite disponível R$ 1.400,00`, igual a
  `availableCardLimitCents(200000, 60000) = 140000` (R$ 1.400,00 em centavos).
- Linha informativa exercitada com uma compra em 10/10/2026 (R$ 50,00) cuja
  fatura vence no ciclo de novembro: o dashboard mostra
  `Faturas a pagar no ciclo: R$ 50,00` **sem** somar no consumo (consumido
  permaneceu `R$ 4.113,34` = `consumedCents 411334`, enquanto a fatura
  informativa é `invoicePaymentCents 5000`).
- Screenshots:
  [`screenshots/passo-07-compromissos-futuros.png`](screenshots/passo-07-compromissos-futuros.png),
  [`screenshots/passo-07-cartoes-limite-e-fatura.png`](screenshots/passo-07-cartoes-limite-e-fatura.png)

## Console do browser

Nenhuma mensagem de nível `error`/`assert` foi registrada durante os passos 1–7.
O DevTools reportou apenas avisos de diagnóstico de acessibilidade (`[issue]`:
campos sem `id`/`name` e um campo sem label), que não são `console.error` e
serão tratados na subtarefa 4.

## Regressões corrigidas nesta subtarefa

1. **Vazio do card "A pagar" não exibia o texto do mês.**
   - Sintoma: ao zerar os gastos em aberto, o card mostrava apenas
     `A pagar no ciclo: R$ 0,00 · Nenhum gasto em aberto`; o texto
     `Nenhum gasto em aberto em <mês> de <ano>.` existia em
     `src/lib/open-expenses.ts` mas não era renderizado.
   - Correção: `OpenExpensesCard` passou a receber `emptyLabel` e renderizar
     `openExpensesEmptyText` quando `count === 0`; o dashboard passa o mês do
     ciclo (`monthLabel(referenceMonthKey)`).
   - Testes: `src/components/OpenExpensesCard.test.ts`
     (`ao zerar exibe o vazio ... (regressão #373)`).
2. **`/cartoes` não exibia o limite disponível.**
   - Sintoma: a tela mostrava só `Limite R$ ...`, sem o valor descontado da
     fatura da competência.
   - Correção: `availableCardLimitCents` em `src/lib/invoices.ts` e exibição de
     `Limite disponível R$ ...` em `CreditCardsManager`.
   - Testes: `src/lib/invoices.test.ts` e
     `src/components/CreditCardsManager.test.ts`
     (`exibe limite disponível = limite − fatura da competência (regressão #373)`).

## Gate executado até aqui

```text
npm run typecheck   # exit 0
npm run lint        # exit 0 (1 warning pré-existente em src/lib/env.test.ts)
npx vitest run src/lib/invoices.test.ts src/components/OpenExpensesCard.test.ts src/components/CreditCardsManager.test.ts
# 3 arquivos, 50 testes, todos passando
npm test            # 104 arquivos, 1240 testes, todos passando
npm run build       # exit 0
```

## Ressalvas

- O `npm run lint` mantém **1 warning pré-existente** em `src/lib/env.test.ts`
  (`_omitted` não usado), fora do escopo desta tarefa; sem erros.
- O login válido foi feito no Chromium do ambiente com a senha de teste local;
  o segredo de sessão e a senha não são versionados.
- A suíte de integração e os passos 8–12 ficam para as subtarefas seguintes.
