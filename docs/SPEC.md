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

### 3.2 Saídas fixas

- Campos: nome, valor, dia de vencimento, categoria, vigência, ativa.
- Contam integralmente no mês de competência, independentemente do dia de
  pagamento.

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

> Regra central: o mesmo gasto nunca é contado duas vezes. Gasto pago no
> cartão substitui o gasto avulso correspondente — por isso um gasto avulso
> com forma de pagamento **crédito** não conta diretamente (§3.3).

## 4. Dashboard

O dashboard exibe:

1. **% da renda mensal consumida** — número grande, é o protagonista.
2. **Dias para o fim do mês**.
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
de gastar 80% com 20 dias. Usamos o **ritmo esperado**:

```
fração_do_mes_decorrida = dias_decorridos / dias_no_mes
ritmo = percentual_consumido / max(fração_do_mes_decorrida, epsilon)
```

Faixas de `ritmo` → nível e intenção de cor:

| Ritmo | Nível | Cor |
| --- | --- | --- |
| `<= 0,80` | ok | verde |
| `0,81 – 1,00` | atenção | verde-limão |
| `1,01 – 1,25` | cuidado | amarelo |
| `1,26 – 1,60` | alerta | laranja |
| `> 1,60` | crítico | vermelho |

Regra adicional: se `percentual_consumido >= 100`, o nível é **crítico**
(vermelho), independentemente do ritmo.

A cor final é interpolada continuamente (matiz de 120° → 0°) em função do
ritmo, produzindo o degradê verde→vermelho. A implementação de referência está
em `src/lib/finance.ts`.

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
- **Sem exibir valores monetários no dashboard** nesta versão; apenas %.
- **Privacidade**: sem envio para terceiros; tudo no PostgreSQL próprio.
- **Acessibilidade**: contraste adequado mesmo com fundo colorido.

## 8. Fora de escopo (por agora)

- Múltiplos usuários/perfis e permissões.
- Valores em reais no dashboard.
- Open Finance / importação bancária.
- Notificações push.
- Aplicativo nativo.

## 9. Glossário de unidades

- Valores monetários são armazenados em **centavos** (`Int`), evitando erros de
  ponto flutuante.
- Percentuais são derivados, nunca armazenados como fonte de verdade (exceto
  cache de histórico, se necessário).
