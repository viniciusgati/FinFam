/**
 * Glossário dos conceitos financeiros do FinFam.
 *
 * Conteúdo puro, sem banco, rede ou DOM: a página `/ajuda` apenas renderiza
 * estes termos e os cards apontam para as âncoras via `glossaryHref`. As
 * definições seguem a SPEC (`docs/SPEC.md` §§3–5). Os textos são testados
 * literalmente em `glossary.test.ts` (sem snapshot).
 */

export type GlossaryTermId =
  | "ciclo"
  | "percentual-consumido"
  | "consumo-disponivel"
  | "orcamento-livre"
  | "competencia"
  | "em-aberto"
  | "comprometido"
  | "limite-disponivel"
  | "meta"
  | "diaria";

export interface GlossaryTerm {
  id: GlossaryTermId;
  term: string;
  definition: string;
  example: string;
}

export const GLOSSARY: readonly GlossaryTerm[] = [
  {
    id: "ciclo",
    term: "Ciclo financeiro",
    definition:
      "Janela de tempo que começa no dia de início do ciclo e vai até a véspera do próximo início, no fuso da família. Com início no dia 1, o ciclo coincide com o mês calendário.",
    example:
      "Com ciclo começando no dia 20, o ciclo de 20/03 até 19/04 reúne tudo o que vence ou acontece nesse intervalo.",
  },
  {
    id: "percentual-consumido",
    term: "% da renda consumida",
    definition:
      "Parcela da renda do ciclo já consumida. Inclui as saídas fixas que vencem na janela, os gastos avulsos e o cartão pela data da compra. Sem renda cadastrada, o percentual fica indefinido.",
    example:
      "Renda de R$ 5.000,00 e R$ 4.400,00 consumidos no ciclo mostram 88% da renda consumida.",
  },
  {
    id: "consumo-disponivel",
    term: "Consumo disponível",
    definition:
      "Quanto sobra da renda do mês depois de descontar apenas as saídas fixas ativas, nunca abaixo de zero: entradas menos fixas ativas. Faturas e gastos avulsos não entram nessa conta.",
    example:
      "Entradas de R$ 5.000,00 e fixas ativas de R$ 3.200,00 resultam em R$ 1.800,00 de consumo disponível.",
  },
  {
    id: "orcamento-livre",
    term: "Orçamento livre",
    definition:
      "Renda do ciclo menos as saídas fixas do ciclo, nunca abaixo de zero. É o valor que pode ser gasto com o variável (avulsos e cartão) sem comprometer as contas fixas.",
    example:
      "Renda do ciclo de R$ 5.000,00 e fixas de R$ 3.200,00 deixam R$ 1.800,00 de orçamento livre.",
  },
  {
    id: "competencia",
    term: "Competência",
    definition:
      "Mês em que a despesa impacta o orçamento. Na fatura do cartão é o mês de vencimento; no dashboard, o gasto no cartão conta pela data da compra.",
    example:
      "Uma compra de janeiro que vence na fatura de fevereiro pertence à competência de fevereiro na tela de cartões.",
  },
  {
    id: "em-aberto",
    term: "Em aberto",
    definition:
      "Gasto avulso registrado que ainda não foi marcado como pago. Continua contando no consumo do ciclo, mas o dinheiro ainda não saiu do caixa.",
    example:
      "Um mercado de R$ 120,00 lançado hoje e não pago aparece como em aberto até ser marcado como pago.",
  },
  {
    id: "comprometido",
    term: "Comprometido",
    definition:
      "Dinheiro já destinado a contas fixas e a parcelas futuras de compras no cartão. Indica o que da renda futura já tem destino certo antes de qualquer gasto novo.",
    example:
      "Uma compra em 3 parcelas de R$ 200,00 compromete R$ 400,00 das próximas duas faturas.",
  },
  {
    id: "limite-disponivel",
    term: "Limite disponível",
    definition:
      "Limite do cartão menos o valor já comprometido nele. Sem limite cadastrado, o cartão aparece como sem limite.",
    example:
      "Limite de R$ 4.000,00 com R$ 1.500,00 comprometidos deixam R$ 2.500,00 de limite disponível.",
  },
  {
    id: "meta",
    term: "Meta",
    definition:
      "Valor-alvo de economia ou reserva definido pela família. Serve apenas como referência de planejamento e não altera os cálculos do ciclo.",
    example:
      "Definir uma meta de R$ 10.000,00 de reserva orienta quanto guardar por mês sem mudar o orçamento livre.",
  },
  {
    id: "diaria",
    term: "Diária",
    definition:
      "Orçamento livre que ainda resta dividido pelos dias que faltam até o fim do ciclo, contando o dia de hoje e o último dia. Pode ficar negativa quando o ciclo já foi estourado.",
    example:
      "Restando R$ 900,00 de orçamento livre e 30 dias de ciclo, a diária é de R$ 30,00 por dia.",
  },
];

/** Localiza um termo pelo seu identificador de âncora. */
export function getGlossaryTerm(id: GlossaryTermId): GlossaryTerm {
  const term = GLOSSARY.find((entry) => entry.id === id);
  if (!term) {
    throw new Error(`Termo do glossário não encontrado: ${id}`);
  }
  return term;
}

/** Link para a âncora do termo na página `/ajuda`. */
export function glossaryHref(id: GlossaryTermId): string {
  return `/ajuda#${id}`;
}
