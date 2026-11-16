import { describe, expect, it } from "vitest";
import {
  GLOSSARY,
  glossaryHref,
  getGlossaryTerm,
  type GlossaryTerm,
} from "./glossary";

describe("GLOSSARY", () => {
  it("lista os 10 termos na ordem e com os títulos definidos", () => {
    expect(GLOSSARY.map(({ id, term }) => [id, term])).toEqual([
      ["ciclo", "Ciclo financeiro"],
      ["percentual-consumido", "% da renda consumida"],
      ["consumo-disponivel", "Consumo disponível"],
      ["orcamento-livre", "Orçamento livre"],
      ["competencia", "Competência"],
      ["em-aberto", "Em aberto"],
      ["comprometido", "Comprometido"],
      ["limite-disponivel", "Limite disponível"],
      ["meta", "Meta"],
      ["diaria", "Diária"],
    ]);
  });

  it("traz o texto exato de cada definição e exemplo", () => {
    expect(GLOSSARY).toEqual<GlossaryTerm[]>([
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
    ]);
  });

  it("não deixa definição nem exemplo vazios", () => {
    for (const term of GLOSSARY) {
      expect(term.definition.trim().length).toBeGreaterThan(0);
      expect(term.example.trim().length).toBeGreaterThan(0);
    }
  });

  it("usa identificadores únicos", () => {
    const ids = GLOSSARY.map((term) => term.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("glossaryHref", () => {
  it("monta a âncora da página de ajuda", () => {
    expect(glossaryHref("em-aberto")).toBe("/ajuda#em-aberto");
  });

  it("aponta para a âncora de cada termo", () => {
    for (const term of GLOSSARY) {
      expect(glossaryHref(term.id)).toBe(`/ajuda#${term.id}`);
    }
  });
});

describe("getGlossaryTerm", () => {
  it("retorna o termo Diária", () => {
    expect(getGlossaryTerm("diaria").term).toBe("Diária");
  });

  it("retorna o termo completo pelo id", () => {
    expect(getGlossaryTerm("ciclo")).toEqual(GLOSSARY[0]);
  });
});
