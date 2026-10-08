# FinFam — Especificação funcional

> Documento vivo. Serve de base para as fases de análise/implementação.
> Escopo desta versão: **apenas percentuais** no dashboard (nenhum valor em
> reais é exibido), feed­back comparativo com os últimos meses e autenticação
> simples por variáveis de ambiente.

## 1. Objetivo

Dar à família uma resposta visual e imediata para a pergunta:

> "Ainda dá para gastar este mês? Podemos sair / comprar algo ou não?"

O produto é um **PWA** pensado para um **tablet na sala**, aberto por qualquer
membro da família, com um dashboard cuja **cor de fundo vai do verde ao
vermelho** conforme a situação dos gastos do mês.

## 2. Personas e acesso

- **Família** (uso compartilhado, um único login). Não há perfis individuais
  nesta versão.
- Autenticação simples:
  - Usuário e senha vêm das variáveis de ambiente `FINFAM_USER` e `FINFAM_PASS`.
  - Sessão mantida em cookie `httpOnly`, assinado com `FINFAM_SESSION_SECRET`.
  - Rotas internas redirecionam para `/login` quando não autenticado.
  - A senha **nunca** é exibida em logs nem retornada pela API.

## 3. Conceitos de domínio

| Conceito | Descrição |
| --- | --- |
| **Entrada fixa** | Renda recorrente mensal (ex.: salário). |
| **Saída fixa** | Conta recorrente mensal (ex.: aluguel, luz, internet). |
| **Gasto avulso** | Despesa pontual, com data (ex.: mercado, farmácia). |
| **Cartão de crédito** | Meio de pagamento com data de fechamento e vencimento. |
| **Compra no cartão** | Gasto atribuído a um cartão, que pode ser parcelado. |
| **Fatura** | Soma das compras do cartão dentro de um ciclo (fechamento). |
| **Mês de competência** | Mês em que a despesa impacta o orçamento (ver §5). |

### 3.1 Entradas fixas

- Campos: nome, valor, dia de recebimento, vigência (início/fim), ativa.
- Somam-se para formar a **renda mensal** do mês de referência.

**Entradas avulsas** (venda de algo, saldo que sobrou no mês): descrição, valor
e data, sem recorrência nem vigência. Contam como **renda do mês da data** e
entram no **orçamento livre do ciclo** que contém a data (mesma janela dos
gastos avulsos, §4). CRUD em `/entradas` e `/api/variable-incomes`.

### 3.2 Saídas fixas

- Campos: nome, valor, dia de vencimento, categoria, vigência, ativa.
- Contam integralmente no mês de competência, independentemente do dia de
  pagamento.
- São as **obrigações fixas** do mês e as únicas subtraídas na fórmula do
  consumo disponível (§4.5). **Faturas de cartão e gastos avulsos não são
  fixas**: contam como **consumo variável** (§3.4, §4.1) e não entram na
  subtração `entradas − gastos fixos`.

### 3.3 Gastos avulsos

- Campos: descrição, valor, data, categoria, forma de pagamento, pago (sim/não).
- Gastos pagos com **cartão de crédito** entram pela **fatura** (§5.2), e não
  diretamente pelo gasto avulso.
- **Fonte de verdade da despesa de crédito:** a compra no cartão
  (`CardPurchase`) é a fonte de verdade da despesa de crédito; um gasto avulso
  (`VariableExpense`) com `paymentMethod = CREDIT` é apenas registro/anotação e
  **não** conta diretamente no orçamento — evitando dupla contagem com a fatura
  (§3.4).

### 3.4 Cartões e faturas

- Cartão: nome, limite, dia de fechamento, dia de vencimento, ativo.
- Compra no cartão: descrição, valor, data da compra, categoria, cartão,
  número da parcela / total de parcelas.
- **Cálculo do mês de competência da fatura**: o fechamento é **inclusivo** —
  se `dia(data da compra) <= closingDay`, a compra entra no ciclo do **mês da
  compra**; se `dia(data da compra) > closingDay`, entra no ciclo do **mês
  seguinte**. A fatura impacta o orçamento do **mês do vencimento** dessa
  fatura (`dueDay <= closingDay` avança o vencimento em 1 mês; senão ele fica
  no mês do ciclo).
  - Ex.: compra em 10/03 com fechamento dia 20 → fatura que fecha em 20/03;
    vencimento em 05/04 → impacta **abril**.
  - Ex.: compra em 20/03 (dia do fechamento) com fechamento dia 20 → entra no
    próprio ciclo de 20/03.
  - Ex.: compra em 27/03 com fechamento dia 20 → entra no ciclo de 20/04.
- Cada parcela de uma compra parcelada é alocada à fatura do mês
  correspondente (parcela 1 no ciclo da compra; parcela `k` em `k-1` meses
  depois).
- Para o **consumo disponível** (§4.5), a fatura é **consumo variável**, não
  obrigação fixa: ela **não** entra na subtração `entradas − gastos fixos`.

> Regra central: o mesmo gasto nunca é contado duas vezes. Gasto pago no
> cartão substitui o gasto avulso correspondente — por isso um gasto avulso
> com forma de pagamento **crédito** não conta diretamente (§3.3).

## 4. Dashboard

O dashboard exibe:

1. **% da renda mensal consumida** — número grande, é o protagonista.
2. **Dias para o fim do ciclo financeiro**, contando o dia corrente (o ciclo
   começa em `cycleStartDay`; ex.: dia 08 com o ciclo fechando no dia 15 ⇒
   "8 dias para o fim do ciclo"). O `%` e a projeção continuam no mês
   calendário.
3. **Feedback comparativo**: mensagem textual comparando o mês atual com os
   últimos `N` meses (padrão `N = 4`).
4. **Cor de fundo** do dashboard, interpolada do verde ao vermelho.

### 4.1 Fórmula do consumo

```
consumido_mes = saidas_fixas_ativas
              + gastos_avulsos_do_mes (não pagos no cartão)
              + faturas_de_cartao_do_mes (vencimento no mês)

percentual_consumido = consumido_mes / renda_mensal * 100
```

### 4.2 Regra de situação (cor)

Percentual cru não basta: gastar 80% com 2 dias para o fim do mês é diferente
de gastar 80% com 20 dias. Além disso, as saídas fixas e as faturas de cartão
já valem 100% logo no dia 1 (SPEC §5.2), então não podem inflar o ritmo: elas
são **obrigações conhecidas** e o ritmo mede apenas o **gasto avulso** contra o
orçamento diário disponível.

```
obrigacoes       = saidas_fixas_ativas + faturas_de_cartao_do_mes
orcamento_livre  = max(renda_mensal - obrigacoes, 0)
diaria_disponivel = orcamento_livre / dias_no_mes

gasto_diario = gastos_avulsos_do_mes / max(dias_decorridos, 1)
coeficiente  = gasto_diario / diaria_disponivel
```

Quando `diaria_disponivel == 0` (obrigações ≥ renda), o coeficiente cai no
fallback `projecao_mes / renda_mensal`, em que:

```
projecao_mes = obrigacoes + gasto_diario * dias_no_mes
```

Faixas do coeficiente → nível e intenção de cor:

| Ritmo | Nível | Cor |
| --- | --- | --- |
| `<= 0,80` | ok | verde |
| `0,81 – 1,00` | atenção | verde-limão |
| `1,01 – 1,25` | cuidado | amarelo |
| `1,26 – 1,60` | alerta | laranja |
| `> 1,60` | crítico | vermelho |

Regra adicional: se `percentual_consumido >= 100`, o nível é **crítico**
(vermelho), independentemente do coeficiente.

A cor final é interpolada continuamente (matiz de 120° → 0°) em função do
coeficiente, produzindo o degradê verde→vermelho. A implementação de referência
está em `src/lib/finance.ts`.

### 4.3 Feedback comparativo

- Guarda-se, por mês, o percentual consumido (pode ser derivado das transações).
- Compara-se o mês corrente com os últimos `N` meses fechados.
- Mensagens possíveis:
  - _"Estão melhores que os últimos N meses."_
  - _"Estão melhores que X dos últimos N meses."_
  - _"Estão piores que os últimos N meses."_
  - Sem meses anteriores: _"Ainda não há histórico suficiente."_
- Critério padrão de "melhor": percentual do mês corrente menor que o dos
  meses comparados. A fase de implementação pode refinar com projeção do mês
  (percentual projetado até o fim do mês).

### 4.4 Ampliação do dashboard (história #224)

Esta seção **supersede** restrições anteriores desta SPEC onde houver conflito.

- Valores monetários passam a ser exibidos em **R$ (`pt-BR`)**, além do
  percentual (supera o "sem valores monetários" do §7).
- Gráficos em **SVG/CSS puro** (`role="img"` + `aria-label`), sem biblioteca de
  charts: "Entradas vs Saídas" e "Gasto variável por dia" (uma barra por dia com
  os avulsos no orçamento + linha horizontal da **média de consumo**; dia de hoje
  destacado; dias futuros atenuados). As obrigações (fixas + faturas) ficam em
  nota separada, fora do eixo das barras.
- **Séries diárias** (`src/lib/dashboard-series.ts`, função pura): avulsos no
  orçamento na `date`; fixas ativas no `dueDay` (limitado ao tamanho do mês);
  faturas no `dueDay` do cartão pela competência (`invoices.ts`). Avulsos
  `CREDIT` não entram (evita dupla contagem, §3.3). A soma da série coincide com
  `consumedCents`. Mês corrente acumula até hoje; mês passado cobre o mês todo.
  `variableDailyExpensesCents` isola só os avulsos no orçamento (sem fixas nem
  faturas) e `consumptionDailyAverageCents` traz a média diária do consumo
  disponível (entradas − fixas, §4.5) para a linha de referência.
- **Avaliação de mês fechado por IA** (DeepSeek, opcional via
  `DEEPSEEK_API_KEY`): supervisor `src/lib/ai/deepseek.ts`. Somente agregados
  **numéricos** são enviados; o veredito e o fallback são locais. Cache em
  `MonthlyReview` (PostgreSQL) por `monthKey`. Sem chave →
  `503 { "error": "ai_unavailable" }` + fallback local.
- **Simulador "posso comprar?"**: veredito local determinístico
  (`ok`/`cuidado`/`nao`) pelo impacto no **poder de compra por dia** do ciclo:
  a compra ÷ dias restantes reduz a diária; compara-se a diária resultante com o
  **ritmo recente** de consumo (gastos avulsos do ciclo + fatura de cartão do
  mês ÷ dias decorridos). Não cabe no orçamento do ciclo ou cai abaixo de metade
  do ritmo → `nao`; fica abaixo do ritmo → `cuidado`; mantém o ritmo → `ok`. A
  IA apenas redige a justificativa; a rota sempre responde `200` com fallback
  local. O card só aparece no mês corrente (depende do ciclo).
- O seletor de mês do dashboard navega para `/?mes=YYYY-MM` (prop `basePath`).

### 4.5 Consumo disponível e média diária

Métrica **informativa** exibida como subtítulo do card principal, ao lado (não
no lugar) do `%` protagonista e do orçamento livre do ciclo:

```
consumo_disponivel = max(entradas_do_mes − gastos_fixos_ativos, 0)
media_diaria       = consumo_disponivel / dias_da_janela   (Math.round)
```

- `entradas_do_mes` = entradas fixas ativas no mês + entradas avulsas do mês.
- `gastos_fixos_ativos` = saídas fixas vigentes no mês (`isActiveInMonth`).
- **Faturas de cartão e gastos avulsos não entram na subtração** — são
  **consumo variável**, não obrigações fixas (§3.2/§3.4).
- Janelas: **mês** (dias do mês calendário), **dias decorridos** e **ciclo**
  (só quando o mês de referência é o corrente). `dias <= 0` ⇒ média
  `R$ 0,00`, sem divisão por zero nem `NaN`.
- UI: no **mês corrente**, o subtítulo do card principal exibe o disponível do
  ciclo (`cycleAvailabilityLabel`) — os mesmos números do "Pode gastar por
  dia", já líquidos de faturas e avulsos; em **mês fechado**, exibe a média da
  janela mês (`consumptionAverageLabel`).
- Quando `gastos_fixos_ativos >= entradas`, o consumo disponível é `0` e o card
  exibe apenas a mensagem de indisponibilidade, sem valores em R$.
- Implementação: `consumptionAvailableCents`/`consumptionDailyAverageCents`
  (`src/lib/finance.ts`), `buildConsumptionSummary`/`consumptionAverageLabel`
  (`src/lib/dashboard-series.ts`) e `loadDashboardData` (`src/lib/dashboard.ts`).
- Distinção: o `%` (`consumedCents`, §4.1) inclui fixas, avulsos e faturas; o
  orçamento livre do ciclo (`dailyAllowanceCents`) subtrai fixas, faturas e
  avulsos e divide pelos dias **restantes**; esta métrica separa o **consumo
  variável** das obrigações fixas, sem alterar nenhum desses cálculos.

## 5. Regras de negócio relevantes

1. **Renda mensal** = soma das entradas fixas ativas no mês.
2. **Saídas fixas** contam 100% no mês, pagas ou não.
3. **Gasto avulso** pago em dinheiro/débito/pix conta na data.
4. **Gasto no cartão** conta pela fatura do mês de vencimento (§3.4).
5. **Compra parcelada**: valor total dividido pelo número de parcelas; cada
   parcela em sua fatura.
6. Se `renda_mensal == 0`, o percentual é indefinido: exibir estado neutro e
   orientar o cadastro de entradas.
7. Não contam para o orçamento: transferências internas, receitas avulsas
   (podem ser adicionadas depois).
8. **Consumo disponível** = `max(entradas_do_mes − gastos_fixos_ativos, 0)`,
   nunca negativo. Faturas e avulsos são consumo variável e **não** entram.
   Métrica informativa, distinta do `%` e do orçamento livre do ciclo (§4.5).

## 6. Telas (MVP)

| Rota | Descrição |
| --- | --- |
| `/login` | Login da família. |
| `/` | Dashboard (pode ser o dashboard ou redirect para `/login`). |
| `/entradas` | CRUD de entradas fixas. |
| `/saidas` | CRUD de saídas fixas. |
| `/gastos` | Lançamento e listagem de gastos avulsos. |
| `/cartoes` | Cartões e compras/faturas. |
| `/historico` | Histórico mensal e comparações. |

O MVP desta fase entrega o **dashboard** funcional com dados; as telas de CRUD
são entregas seguintes.

## 7. Requisitos não funcionais

- **PWA**: instalável, com manifest e service worker.
- **Responsivo**: prioridade para tablet (paisagem) e desktop.
- **Valores monetários em R$ no dashboard** (história #224 supersede o "apenas
  %" anterior); o percentual continua sendo o protagonista.
- **Privacidade**: por padrão sem envio para terceiros; tudo no PostgreSQL
  próprio. Exceção restrita aos recursos de IA (avaliação de mês fechado e
  simulador), que enviam **somente agregados numéricos** à DeepSeek — nunca
  nomes, descrições, categorias ou texto do usuário.
- **Acessibilidade**: contraste adequado mesmo com fundo colorido; gráficos e
  estados usam `role`/`aria-label`/`aria-live` e rótulos textuais.

## 8. Fora de escopo (por agora)

- Múltiplos usuários/perfis e permissões.
- Open Finance / importação bancária.
- Notificações push.
- Aplicativo nativo.

## 9. Glossário de unidades

- Valores monetários são armazenados em **centavos** (`Int`), evitando erros de
  ponto flutuante.
- Percentuais são derivados, nunca armazenados como fonte de verdade (exceto
  cache de histórico, se necessário).
