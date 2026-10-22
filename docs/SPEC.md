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
- **No dashboard** (moldura do ciclo, §4), a despesa de crédito conta pela
  **data da compra** (competência de consumo): a parcela `k` cai no ciclo da
  data da compra + `k−1` meses. A fatura **paga** dentro da janela por compras
  anteriores **não** entra no consumo — aparece só como linha informativa
  ("Faturas a pagar no ciclo"). A tela `/cartoes` continua pela competência de
  vencimento (o que vai ser pago e quando).
- Para o **consumo disponível** (§4.5), a fatura é **consumo variável**, não
  obrigação fixa: ela **não** entra na subtração `entradas − gastos fixos`.
- **Importação de fatura via CSV** (história #269): o usuário pode importar a
  fatura de um cartão a partir do CSV exportado no padrão do Nubank (formato
  `date,title,amount`, valores em pt-BR) na tela `/cartoes`. A competência alvo
  é detectada pela **maioria** das linhas do arquivo (moda; empate de linhas →
  maior soma absoluta; empate de soma → mês mais recente), aplicando as regras
  de ciclo da §3.4. Linhas da minoria discordantes têm a data ajustada em
  no mínimo para caírem na janela do ciclo detectado, preservando o valor
  original. A importação **substitui** as compras à vista (`installmentsTotal
  = 1`) da competência detectada naquele cartão — isso inclui ajustes de
  fatura e gastos lançados manualmente — numa única transação Prisma (exclusão
  + inserção ou nada). Compras **parceladas nunca são apagadas**; linhas
  `… - Parcela k/N` que casarem com uma parcelada existente (mesma descrição,
  mesmo total, valor igual à k-ésima) são mantidas e não reinseridas. Linhas
  negativas (pagamentos, estornos) e inválidas (data/valor malformados ou
  zero) não viram lançamento: são contadas e devolvidas no resumo. A
  classificação das descrições usa o histórico local primeiro e, para o que
  restar, uma única chamada em lote à DeepSeek (exceção documentada à §7).
  Um modo de pré-visualização (`dryRun`) devolve o plano sem escrever nada.

> Regra central: o mesmo gasto nunca é contado duas vezes. Gasto pago no
> cartão substitui o gasto avulso correspondente — por isso um gasto avulso
> com forma de pagamento **crédito** não conta diretamente (§3.3).

## 4. Dashboard

O dashboard exibe:

1. **% da renda mensal consumida** — número grande, é o protagonista.
2. **Dias para o fim do ciclo financeiro**, contando o dia corrente (o ciclo
   começa em `cycleStartDay`; ex.: dia 08 com o ciclo fechando no dia 15 ⇒
   "8 dias para o fim do ciclo"). A **moldura do dashboard é o ciclo**: com
   `cycleStartDay ≠ 1`, o `%`, a projeção e os valores em R$ do card usam a
   janela `[início do ciclo, próximo início)` para renda, obrigações, avulsos,
   cartão (pela **data da compra** — §3.4), série e categorias (§4.1). Com
   `cycleStartDay = 1` a janela coincide com o mês calendário. O `?mes` do
   seletor é o **mês de início do ciclo** (ex.: `2026-10` = 15/10–14/11),
   exibido pelo **mês da fatura** (início + 1 ⇒ "novembro de 2026"). O ciclo
   futuro pode ser pré-visualizado (previsão com o que já está lançado: rendas,
   contas fixas e faturas) — "O ciclo começa em N dias" e o aviso "Ciclo
   futuro".
3. **Feedback comparativo**: mensagem textual comparando o mês atual com os
   últimos `N` meses (padrão `N = 4`).
4. **Cor de fundo** do dashboard, interpolada do verde ao vermelho.
5. **Valores em R$ do card principal** — renda, já consumido, ainda disponível
   (ou estourado em) e projeção de fechamento — para decompor o `%` em dinheiro
   e responder "quanto ainda cabe" sem cálculo mental. Usam exatamente a mesma
   janela do `%` (§4.1). As faturas que **vencem** na janela (compras de ciclos
   anteriores) aparecem numa **linha informativa** ("Faturas a pagar no ciclo"),
   fora do consumo.

### 4.1 Fórmula do consumo

A **janela do dashboard** (com `cycleStartDay ≠ 1`) é o ciclo financeiro:
`[início do ciclo, próximo início)`; com `cycleStartDay = 1` ela coincide com
o mês calendário. Tudo que entra na conta usa essa janela:

- **entradas fixas** cuja ocorrência de `receiveDay` cai na janela (vigência
  checada no mês da ocorrência) e **entradas avulsas** pela `date`;
- **saídas fixas** cuja ocorrência de `dueDay` cai na janela (vigência no mês
  da ocorrência) — cada ocorrência pertence a exatamente um ciclo, então uma
  despesa paga antes do início da janela **não** reaparece nela;
- **compras no cartão pela data** (competência de consumo, §3.4): a parcela
  `k` entra no ciclo da data da compra + `k−1` meses. A fatura paga dentro da
  janela por compras anteriores **não** entra no consumo (vira a linha
  informativa de caixa);
- **gastos avulsos** no orçamento pela `date` — no ciclo corrente, até hoje;
  em ciclo fechado, a janela inteira.

```
consumido_ciclo = saidas_fixas_que_vencem_na_janela
              + gastos_avulsos_da_janela (não pagos no cartão)
              + compras_no_cartao_da_janela (parcela k na compra + k−1 meses)

renda_ciclo = entradas_fixas_recebidas_na_janela + entradas_avulsas_da_janela
percentual_consumido = consumido_ciclo / renda_ciclo * 100
```

O dia é limitado ao tamanho do mês (vencimento 31 em mês de 30 vence no dia
30); como a janela tem 28–31 dias, cada dia-do-mês ocorre no máximo uma vez
nela. A série diária usa a mesma janela e o eixo é o do ciclo (dia 1 =
`cycleStartDay`), de modo que `sum(série) === consumido_ciclo`.

### 4.2 Regra de situação (cor)

Percentual cru não basta: gastar 80% com 2 dias para o fim do ciclo é diferente
de gastar 80% com 20 dias. Além disso, as saídas fixas já valem 100% desde o
início da janela (SPEC §5.2), então não podem inflar o ritmo: elas
são **obrigações conhecidas** e o ritmo mede o **gasto variável** (avulsos +
compras do cartão) contra o orçamento diário disponível.

```
obrigacoes       = saidas_fixas_que_vencem_na_janela
orcamento_livre  = max(renda_ciclo - obrigacoes, 0)
diaria_disponivel = orcamento_livre / dias_da_janela

gasto_diario = (gastos_avulsos_da_janela + compras_do_cartao_da_janela)
             / max(dias_decorridos_da_janela, 1)
coeficiente  = gasto_diario / diaria_disponivel
```

`dias_da_janela`/`dias_decorridos_da_janela` são os dias do ciclo (28–31) e os
dias decorridos contando hoje; com `cycleStartDay = 1`, os do mês calendário.

Quando `diaria_disponivel == 0` (obrigações ≥ renda), o coeficiente cai no
fallback `projecao_ciclo / renda_ciclo`, em que:

```
projecao_ciclo = obrigacoes + gasto_diario * dias_da_janela
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
- **Mês válido para comparação**: só entra na base (média, contador "últimos N
  meses" e alertas) um mês com **pelo menos 1 entrada e 1 saída** registradas.
  Meses vazios ou pela metade (só renda, ou só gasto) são ignorados.
- **Mínimo de 2 meses válidos** antes de qualquer comparação ou média
  histórica (`MIN_COMPARISON_MONTHS`). Abaixo disso não há base estatística:
  - o feedback do card é _"Ainda não há histórico suficiente."_;
  - os alertas de categoria ("acima da média dos últimos N meses") e o texto
    _"Tudo certo: nenhuma categoria ficou acima da média…"_ não aparecem;
  - a avaliação de mês fechado pela IA não envia média de meses anteriores.
- Mensagens possíveis (com base suficiente):
  - _"Estão melhores que os últimos N meses."_
  - _"Estão melhores que X dos últimos N meses."_
  - _"Estão piores que os últimos N meses."_
- Critério padrão de "melhor": percentual do mês corrente menor que o dos
  meses comparados. A fase de implementação pode refinar com projeção do mês
  (percentual projetado até o fim do mês).

### 4.4 Ampliação do dashboard (história #224)

Esta seção **supersede** restrições anteriores desta SPEC onde houver conflito.

- Valores monetários passam a ser exibidos em **R$ (`pt-BR`)**, além do
  percentual (supera o "sem valores monetários" do §7).
- Gráficos em **SVG/CSS puro** (`role="img"` + `aria-label`), sem biblioteca de
  charts:
  - **"Para onde vai a renda"**: barra empilhada + lista com o destino da renda
    do mês (contas fixas, fatura do cartão, gastos avulsos e o que sobra); se o
    consumo passar da renda, mostra "no vermelho" com o excesso.
  - **"Consumo por dia"**: barras do consumo **variável** do dia (avulsos no
    orçamento pela `date` + parcelas de cartão de compras do próprio mês pela
    data da compra) + marcadores de vencimento (fixas/fatura) no rodapé, fora
    da escala; dia de hoje destacado e dias futuros atenuados
    (`buildConsumptionChartView`, `src/lib/dashboard-charts.ts`). Abaixo do
    plot, **eixo de dias**: uma célula por dia (mesma largura do slot da barra)
    com o número do dia — hoje em destaque (negrito/verde), vencimento em
    âmbar, futuro atenuado. O card é `@container`: com **container < 512px**
    (`@lg`) só os marcos de `narrowDayLabels` aparecem (1, hoje, último e
    múltiplos de 5; nunca dois consecutivos de dois dígitos, senão "30 31" fica
    colado como "3031"), e com card largo vêm **todos os dias**. O **dia
    típico** (moda; mediana como
    fallback, `typicalDailySpend`) aparece **só no resumo** ("Dia típico (Moda):
    R$ X · N dias acima") — sem linha no plot, pois a linha de referência
    cruzava o gráfico no meio e confundia a leitura.
- **Séries diárias** (`src/lib/dashboard-series.ts`, funções puras): eixo da
  **janela do dashboard**. Avulsos no orçamento na `date`; fixas na ocorrência
  do `dueDay` dentro da janela (limitado ao tamanho do mês); compras do cartão
  pela **data** (parcela `k` no ciclo da compra + `k−1` meses — §3.4), como
  consumo. Avulsos `CREDIT` não entram (evita dupla contagem, §3.3). A soma da
  série coincide com `consumedCents` (mesma janela, §4.1). Ciclo corrente
  acumula até hoje; ciclo fechado cobre a janela toda; com `cycleStartDay = 1`
  a janela é o mês calendário.
  A mesma série expõe `variableDailyCents` (barras do "Consumo por dia") e
  `obligationDailyCents` (marcadores de vencimento das fixas).
- **Avaliação de ciclo fechado por IA** (DeepSeek, opcional via
  `DEEPSEEK_API_KEY`): supervisor `src/lib/ai/deepseek.ts`. Somente agregados
  **numéricos** são enviados; o veredito e o fallback são locais. Cache em
  `MonthlyReview` (PostgreSQL) pelo mês de início do ciclo. Sem chave →
  `503 { "error": "ai_unavailable" }` + fallback local.
- **Simulador "posso comprar?"**: veredito local determinístico
  (`ok`/`cuidado`/`nao`) pelo impacto no **poder de compra por dia** do ciclo:
  a compra ÷ dias restantes reduz a diária; compara-se a diária resultante com o
  **ritmo recente** de consumo (avulsos + compras do cartão do ciclo ÷ dias
  decorridos). Não cabe no orçamento do ciclo ou cai abaixo de metade do ritmo
  → `nao`; fica abaixo do ritmo → `cuidado`; mantém o ritmo → `ok`. A IA apenas
  redige a justificativa; a rota sempre responde `200` com fallback local. O
  card só aparece no ciclo corrente (depende do ciclo).
- O seletor de mês do dashboard navega para `/?mes=YYYY-MM` (prop `basePath`),
  onde `YYYY-MM` é o **mês de início do ciclo** — exibido, no dashboard, pelo
  **mês da fatura** (`início + 1`: `?mes=2026-10` aparece como "novembro de
  2026"; `cycleStartDay = 1` mantém o rótulo do próprio mês). O intervalo da
  janela ("15/10 a 14/11") fica abaixo do rótulo.
- **Resolução do `?mes`** (`resolveCycleReference`): ausente/inválido → ciclo
  **corrente** (dados acumulados até agora); ciclo **fechado** → janela inteira
  (cálculo ao vivo); ciclo **futuro** → **pré-visualização**: o dashboard
  mostra a previsão com o que já está lançado (rendas, contas fixas e faturas),
  com o aviso "Ciclo futuro" e o contador "O ciclo começa em N dias"; o
  seletor avança um ciclo por vez. Com `cycleStartDay = 1`, tudo isso coincide
  com o mês calendário. `resolveReferenceDate`/mês calendário continuam valendo
  para o `/historico` e para os snapshots (§4.6).

### 4.5 Consumo disponível e média diária

Métrica **informativa** exibida como subtítulo do card principal, ao lado (não
no lugar) do `%` protagonista e do orçamento livre do ciclo:

```
consumo_disponivel = max(entradas_do_mes − gastos_fixos_ativos, 0)
media_diaria       = consumo_disponivel / dias_da_janela   (Math.round)
```

- `entradas_do_mes` = entradas fixas cuja ocorrência de `receiveDay` cai na
  janela + entradas avulsas da janela (com `cycleStartDay = 1`, o mês
  calendário).
- `gastos_fixos_ativos` = saídas fixas cuja ocorrência de `dueDay` cai na
  janela (`isActiveInMonth` no mês da ocorrência).
- **Faturas de cartão e gastos avulsos não entram na subtração** — são
  **consumo variável**, não obrigações fixas (§3.2/§3.4).
- Janelas: **ciclo** (dias da janela), **mês** (dias do mês calendário) e
  **dias decorridos**. `dias <= 0` ⇒ média `R$ 0,00`, sem divisão por zero nem
  `NaN`.
- UI: no **ciclo corrente**, o subtítulo do card principal exibe o disponível do
  ciclo (`cycleAvailabilityLabel`) — os mesmos números do "Pode gastar por
  dia", já líquidos de faturas e avulsos; em **ciclo fechado**, exibe a média da
  janela mês (`consumptionAverageLabel`).
- Quando `gastos_fixos_ativos >= entradas`, o consumo disponível é `0` e o card
  exibe apenas a mensagem de indisponibilidade, sem valores em R$.
- Implementação: `consumptionAvailableCents`/`consumptionDailyAverageCents`
  (`src/lib/finance.ts`), `buildConsumptionSummary`/`consumptionAverageLabel`
  (`src/lib/dashboard-series.ts`) e `loadDashboardData` (`src/lib/dashboard.ts`).
- Distinção: o `%` (`consumedCents`, §4.1) inclui fixas, avulsos e compras do
  cartão; o orçamento livre do ciclo (`dailyAllowanceCents`) subtrai as fixas e
  divide pelos dias **restantes** (avulsos e cartão consomem esse orçamento ao
  longo do ciclo); esta métrica separa o **consumo variável** das obrigações
  fixas, sem alterar nenhum desses cálculos.

### 4.6 Mês fechado é imutável (snapshots)

Um mês estritamente anterior ao corrente é **fechado**: seus números viram um
snapshot (`monthly_snapshots`) e **não mudam mais**, mesmo que os dados de
origem sejam editados, desativados ou apagados depois.

- **Captura sem cron:** a primeira escrita (gancho no client Prisma) ou a
  primeira leitura de `/` ou `/historico` no mês seguinte captura os meses
  fechados ausentes (janela automática de 12 meses). Meses sem movimentação não
  geram snapshot; se receberem um lançamento retroativo, a captura seguinte os
  pega.
- **Nunca sobrescreve:** existente nunca é recalculado automaticamente. A
  correção explícita é `npm run db:snapshots -- --force [--month AAAA-MM]`
  (§README).
- **Leitura:** o `/historico` e as comparações do dashboard leem o snapshot
  (agregados, série diária, consumo disponível e categorias) — `elapsedDay` é o
  mês inteiro. O **dashboard** em si é sempre recalculado ao vivo na janela do
  ciclo (§4.1), incluindo ciclos fechados. Os snapshots continuam por **mês
  calendário**.
- **Legado:** capturas anteriores à série diária (sem
  `variableDailyCents`/`obligationDailyCents`/split de renda) caem no cálculo ao
  vivo até um `--force`. Snapshots são retidos por tempo indeterminado
  (alvo ≥ 5 anos), sem expurgo automático.

## 5. Regras de negócio relevantes

No **dashboard** (com `cycleStartDay ≠ 1`), "mês" significa a **janela do
ciclo** (§4.1); fora dele (CRUDs, `/historico`, snapshots) a referência segue
o mês calendário. Com `cycleStartDay = 1` as duas coisas coincidem.

1. **Renda do período** = entradas fixas recebidas na janela (ocorrência de
   `receiveDay`) + entradas avulsas pela `date`.
2. **Saídas fixas** contam 100% na janela em que **vencem** (ocorrência de
   `dueDay`), pagas ou não — cada ocorrência pertence a um único ciclo, então
   uma conta já paga antes da janela não reaparece nela.
3. **Gasto avulso** pago em dinheiro/débito/pix conta na data (dentro da
   janela).
4. **Gasto no cartão** conta pela fatura do mês de vencimento (§3.4) na tela
   de cartões; **no dashboard**, pela **data da compra** (parcela `k` no ciclo
   da compra + `k−1` meses), com as faturas pagas na janela aparecendo só como
   linha informativa.
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
  nomes, descrições, categorias ou texto do usuário. **Exceção documentada à
  importação de fatura CSV (história #269):** na classificação de títulos da
  importação trafegam **apenas títulos de lançamento e rótulos de categoria**
  já usados pela família para a DeepSeek, e somente nesta função — nenhum outro
  dado pessoal ou agregado sai do sistema.
- **Acessibilidade**: contraste adequado mesmo com fundo colorido; gráficos e
  estados usam `role`/`aria-label`/`aria-live` e rótulos textuais.

## 8. Fora de escopo (por agora)

- Múltiplos usuários/perfis e permissões.
- Open Finance / importação bancária automática. (A importação **manual** de
  fatura de cartão via CSV no padrão do Nubank está **dentro** do escopo —
  história #269, §3.4.)
- Notificações push.
- Aplicativo nativo.

## 9. Glossário de unidades

- Valores monetários são armazenados em **centavos** (`Int`), evitando erros de
  ponto flutuante.
- Percentuais são derivados, nunca armazenados como fonte de verdade (exceto
  cache de histórico, se necessário).
