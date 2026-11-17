# Aceite ponta a ponta — passos 8 a 12 (parcial)

Data: 2026-11-17 (terça-feira), fuso `America/Sao_Paulo`.
Task: #373 — Aceite ponta a ponta do produto.
Esta é a evidência parcial da **subtarefa 3**; o relatório final
(`RELATORIO.md`) consolida os passos 1–12 na subtarefa 6.

## Ambiente

| Item | Valor |
| --- | --- |
| App | `next start` em `http://127.0.0.1:3222` (build de produção) |
| Banco de aceite | `postgresql://postgres@127.0.0.1:55432/finfam_accept373?schema=public` |
| Migrations | 7 aplicadas via `npm run db:deploy` |
| Seed | `npm run db:seed` concluído |
| Fuso das asserções | `America/Sao_Paulo` |
| Browser | Chromium controlado pelo Chrome DevTools do ambiente |
| Login de teste | `FINFAM_USER=familia` / senha de teste local `aceite373-local` (não versionada) |
| Sessão | `FINFAM_SESSION_SECRET` definida (valor não registrado) |

O banco preserva os lançamentos criados nos passos 1–7 (a seed é idempotente e
não apaga dados). Antes dos passos 8–12, `app_settings` estava com
`cycleStartDay=1` e sem meta; a meta foi definida pela UI no passo 8.

## Roteiro — passos 8 a 12

### Passo 8 — Configurar meta — PASS

- Em `/configuracoes`, preenchida a meta `1000,00`; a prévia passou a exibir
  exatamente: `Sua meta equivale a R$ 33,33 por dia.`
  (`savingsGoalPreview(100000, 30)`).
- Transições reais observadas no botão (polling no DOM):
  `Salvar` → `Salvando…` (`disabled=true`) → `Salvar` com
  `Configuração salva com sucesso` em `role="status"`.
- Após reload, o campo persistiu `1000,00` e a prévia continuou
  `Sua meta equivale a R$ 33,33 por dia.`
- No dashboard, o card `META DE ECONOMIA` refletiu `META R$ 1.000,00`
  (`app_settings.savingsGoalCents = 100000` no banco).
- Screenshot:
  [`screenshots/passo-08-meta-salva.png`](screenshots/passo-08-meta-salva.png)

### Passo 9 — Simular compra parcelada — PASS

- Em `Posso comprar?`, informados valor `150,00` e `3` parcelas.
- Transições: `Simular` → `Consultando…` (`disabled=true`) → `Simular` com
  resultado.
- Resultado exibido:
  - veredito **`Pode comprar`**;
  - `Poder de compra: de R$ 763,33 para R$ 759,76 por dia nos 14 dias restantes do ciclo (−R$ 3,57 por dia).`
  - `Parcela de R$ 50,00 em 3 vezes; 2 parcelas restantes somam R$ 100,00 de compromisso futuro.`
  - `Meta de economia atingida.`
  - `Seu ritmo recente de consumo é de R$ 71,37 por dia e a compra o mantém.`
- Comparação com o núcleo puro `simulatePurchase`, executada via `tsx` com os
  mesmos insumos (`freeBudgetCents=1068666`, `dailyCents=76333`,
  `remainingDays=14`, `usualDailySpendCents=7137`, `purchaseCents=15000`,
  `installmentsTotal=3`, `savingsGoalCents=100000`,
  `savingsGoalSavedCents=1068666`):

  ```json
  {
    "verdict": "ok",
    "label": "Pode comprar",
    "installmentCents": 5000,
    "futureCommitmentCents": 10000,
    "installmentLabel": "Parcela de R$ 50,00 em 3 vezes; 2 parcelas restantes somam R$ 100,00 de compromisso futuro.",
    "goalLabel": "Meta de economia atingida.",
    "summary": "Seu ritmo recente de consumo é de R$ 71,37 por dia e a compra o mantém."
  }
  ```

  A 1ª parcela é `floor(15000/3) + resto = 5000` centavos e as demais somam
  `10000` centavos, iguais ao exibido.
- Todos os valores monetários visíveis usaram o padrão pt-BR (`R$ 1.234,56`).
- Screenshot:
  [`screenshots/passo-09-simular-compra.png`](screenshots/passo-09-simular-compra.png)

### Passo 10 — Filtrar `/gastos` — PASS

- Lista inicial de novembro/2026: `8 de 8 gastos`, `Total do mês: R$ 613,34`.
- Filtro por categoria `Alimentação`: lista caiu para `1 de 8 gastos`
  (apenas `Mercado · R$ 450,00`), com chip ativo
  `Categoria: Alimentação×` e `Total filtrado: R$ 450,00 · 1 de 8 gastos`.
- `Limpar filtros` restaurou `8 de 8 gastos`, removeu o chip e o total
  filtrado.
- Filtro de descrição sem resultado (`zzz-nao-existe`) exibiu exatamente
  `Nenhum gasto para os filtros selecionados em novembro de 2026.` com
  `0 de 8 gastos` e chip `Descrição: "zzz-nao-existe"×`.
- Screenshots:
  [`screenshots/passo-10-filtro-categoria.png`](screenshots/passo-10-filtro-categoria.png),
  [`screenshots/passo-10-filtro-sem-resultado.png`](screenshots/passo-10-filtro-sem-resultado.png)

### Passo 11 — Baixar dados em `/configuracoes` — PASS

- Bloco `Baixar meus dados` presente com `Baixar tudo (JSON)` e os 10 links de
  `CSV por tabela`.
- `Baixar tudo (JSON)`: o link virou `Preparando…` com `aria-disabled="true"`
  e, ao concluir, exibiu
  `Download iniciado: finfam-dados-2026-11-17.json`; o link voltou a
  `Baixar tudo (JSON)` reabilitado.
- Conteúdo real de `GET /api/export` (mesma sessão do browser):
  - `200`, `Content-Disposition: attachment; filename="finfam-dados-2026-11-17.json"`;
  - JSON válido com `versao: 1`, `fuso: "America/Sao_Paulo"` e **10 tabelas**:
    `incomes` (2), `variable_incomes` (1), `fixed_expenses` (3),
    `credit_cards` (1), `variable_expenses` (8), `card_purchases` (2),
    `monthly_snapshots` (13), `monthly_category_snapshots` (16),
    `app_settings` (1), `monthly_reviews` (0).
- CSV de tabela vazia (`monthly_reviews`): `200`,
  `Content-Disposition: attachment; filename="finfam-monthly_reviews-2026-11-17.csv"`
  e conteúdo apenas com o cabeçalho
  `id,monthKey,summary,createdAt,updatedAt`.
- Links de CSV também exercitados: `Receitas` e `Revisões mensais` viraram
  `Preparando…` (`aria-disabled="true"`) e concluíram com
  `Download iniciado: finfam-incomes-2026-11-17.csv` e
  `Download iniciado: finfam-monthly_reviews-2026-11-17.csv`.
- Falhas simuladas no cliente (mesma função `fetch`, sem alterar a app):
  - HTTP 500 → `Não foi possível gerar a exportação. Tente novamente.`, link
    reabilitado;
  - HTTP 401 → `Sua sessão expirou. Entre novamente para baixar seus dados.`
    mais link `Entrar novamente` (`/login`), link reabilitado.
- Screenshots:
  [`screenshots/passo-11-download-sucesso.png`](screenshots/passo-11-download-sucesso.png),
  [`screenshots/passo-11-erro-401.png`](screenshots/passo-11-erro-401.png)

### Passo 12 — Consultar `/ajuda` — PASS

- `GET /ajuda` respondeu `200`; `<title>` = `Ajuda — FinFam`, `<h1>` = `Ajuda`.
- Navegação `Índice do glossário` (`aria-label`) com 10 âncoras.
- As 20 âncoras internas (`#termo` e `/ajuda#termo`) resolvem para seções
  existentes; **nenhuma âncora quebrada**.
- Todos os links internos da página foram consultados e responderam `200`
  (`/`, `/entradas`, `/saidas`, `/gastos`, `/cartoes`, `/historico`,
  `/configuracoes`, `/ajuda` e as 10 âncoras do glossário); nenhum `404`.
- Screenshot:
  [`screenshots/passo-12-ajuda-indice.png`](screenshots/passo-12-ajuda-indice.png)

## Estados obrigatórios

### `/gastos` vazio — PASS

Com `/gastos?mes=2026-10` (outubro/2026 não tem lançamentos), a lista exibiu
exatamente `Nenhum gasto em outubro de 2026. Lance o primeiro.` e
`0 de 0 gastos`; a contagem no banco para o período é `0`.
Screenshot:
[`screenshots/passo-12-gastos-vazio.png`](screenshots/passo-12-gastos-vazio.png)

### Erro de validação sem criar registro — PASS

No formulário de `/gastos`, envio vazio produziu em `role="alert"`:
`Não foi possível salvar. Verifique os campos.`, além das mensagens de campo
`Informe uma descrição.` e `Informe um valor válido (ex.: 12,34).`, com
`aria-invalid="true"`. A contagem de gastos de outubro permaneceu `0`.
Screenshot:
[`screenshots/passo-12-validacao-erro.png`](screenshots/passo-12-validacao-erro.png)

### Prévia de ciclo futuro — PASS

Com `/?mes=2026-12` (ciclo futuro), o dashboard exibiu:
- `Ciclo futuro` e
  `Este ciclo ainda não começou. Os números abaixo são uma previsão com o que já está lançado: rendas, contas fixas e faturas.`;
- `O ciclo começa em 14 dias`, igual a
  `cycleStartCountdownLabel(daysUntilCycleStart(cycleWindow(2026-12), now))`
  para 17/11/2026;
- card `Pode gastar por dia`, com `R$ 380,65 por dia` e
  `31 dias restantes no ciclo`.

Screenshot:
[`screenshots/passo-12-ciclo-futuro.png`](screenshots/passo-12-ciclo-futuro.png)

## Console do browser

Durante os passos 8–12 nenhuma mensagem de nível `error` foi registrada após a
correção abaixo.

Regressão encontrada e corrigida nesta subtarefa:

1. **`/favicon.ico` respondia 404 e gerava `console.error` em todas as páginas.**
   - Sintoma: ao abrir `/login` (e qualquer rota), o Chromium registrava
     `Failed to load resource: the server responded with a status of 404 (Not Found)`
     para `GET /favicon.ico`.
   - Correção: `src/app/layout.tsx` passou a declarar
     `icons.icon = "/icons/icon.svg"`, fazendo o browser buscar o ícone
     existente (`200`) em vez de `/favicon.ico`.
   - Teste de regressão: `src/app/layout.test.ts`
     (`declara favicon para o browser não registrar 404 em /favicon.ico (regressão #373)`).

## Gate executado até aqui

```text
npx vitest run src/app/layout.test.ts
# 1 arquivo, 1 teste, passando

npm run build   # exit 0 (rebuild após a correção do favicon)
```

O gate completo e a suíte de integração ficam para a subtarefa 6.

## Ressalvas

- As falhas 500/401 do passo 11 foram exercitadas interceptando a função
  `fetch` no browser (respostas simuladas), pois não há endpoint de falha
  forçada; o componente é o mesmo caminho de código do erro real.
- A lista de `/gastos` de novembro/2026 inclui os lançamentos criados nos
  passos 1–7, por isso o total inicial é `R$ 613,34` em vez do valor original
  do seed.
- O `error` de favicon existia desde antes desta subtarefa e não havia sido
  capturado no relatório parcial dos passos 1–7.
