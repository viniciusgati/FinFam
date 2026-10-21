import { describe, expect, it } from "vitest";
import { parseNubankInvoiceCsv } from "./invoice-csv";

const HEADER = "date,title,amount";

describe("parseNubankInvoiceCsv", () => {
  it("reconhece o cabeçalho date,title,amount e devolve as linhas na ordem do arquivo", () => {
    const csv = [
      HEADER,
      "2026-09-01,Netflix.Com,45.90",
      "2026-09-02,Pagamento recebido,- 200,00",
      "2026-09-03,Padaria,12,34",
    ].join("\n");

    const result = parseNubankInvoiceCsv(csv);

    expect(result.headerError).toBeUndefined();
    expect(result.positives).toEqual([
      { line: 2, date: "2026-09-01", title: "Netflix.Com", amountCents: 4590 },
      { line: 4, date: "2026-09-03", title: "Padaria", amountCents: 1234 },
    ]);
    expect(result.negatives).toEqual([
      {
        line: 3,
        date: "2026-09-02",
        title: "Pagamento recebido",
        amountCents: -20000,
      },
    ]);
    expect(result.invalid).toEqual([]);
  });

  it("tolera BOM, aspas escapadas e valores pt-BR (1,92 / 1.234,56 / - 17,60)", () => {
    const csv =
      "\uFEFF" +
      [
        HEADER,
        '2026-09-04,"IOF de ""Opencode""",1,92',
        '2026-09-05,"Mercado, Pão e Cia",1.234,56',
        '2026-09-06,"Estorno - 17,60",- 17,60',
      ].join("\r\n");

    const result = parseNubankInvoiceCsv(csv);

    expect(result.headerError).toBeUndefined();
    expect(result.positives).toEqual([
      { line: 2, date: "2026-09-04", title: 'IOF de "Opencode"', amountCents: 192 },
      { line: 3, date: "2026-09-05", title: "Mercado, Pão e Cia", amountCents: 123456 },
    ]);
    expect(result.negatives).toEqual([
      { line: 4, date: "2026-09-06", title: "Estorno - 17,60", amountCents: -1760 },
    ]);
    expect(result.negatives[0].amountCents).toBe(-1760);
  });

  it("valor zero (0 ou 0,00) é linha inválida sem derrubar as demais", () => {
    const csv = [
      HEADER,
      "2026-09-01,Loja A,0",
      "2026-09-02,Loja B,0,00",
      "2026-09-03,Loja C,10,00",
    ].join("\n");

    const result = parseNubankInvoiceCsv(csv);

    expect(result.invalid).toEqual([
      { line: 2, reason: "amount" },
      { line: 3, reason: "amount" },
    ]);
    expect(result.positives).toEqual([
      { line: 4, date: "2026-09-03", title: "Loja C", amountCents: 1000 },
    ]);
  });

  it("data inválida e valor não numérico vão para invalid com o número da linha", () => {
    const csv = [
      HEADER,
      "2026-02-30,Data impossível,10,00",
      "13/08/2026,Formato errado,10,00",
      "2026-09-07,Valor não numérico,abc",
      "2026-09-08,Loja boa,5,00",
      "2026-09-09",
    ].join("\n");

    const result = parseNubankInvoiceCsv(csv);

    expect(result.invalid).toEqual([
      { line: 2, reason: "date" },
      { line: 3, reason: "date" },
      { line: 4, reason: "amount" },
      { line: 6, reason: "columns" },
    ]);
    expect(result.positives).toEqual([
      { line: 5, date: "2026-09-08", title: "Loja boa", amountCents: 500 },
    ]);
  });

  it("outro cabeçalho devolve erro claro em pt-BR sem lançar exceção", () => {
    const result = parseNubankInvoiceCsv("data,descricao,valor\n2026-09-01,X,10,00");

    expect(result.headerError).toBe(
      'Cabeçalho inválido: era esperado "date,title,amount".',
    );
    expect(result.positives).toEqual([]);
    expect(result.negatives).toEqual([]);
    expect(result.invalid).toEqual([]);
  });

  it("texto vazio devolve headerError em pt-BR", () => {
    const result = parseNubankInvoiceCsv("");

    expect(result.headerError).toBe(
      'Cabeçalho inválido: era esperado "date,title,amount".',
    );
  });

  it("CSV sem nenhuma linha válida devolve positives vazio (a rota responderá 400)", () => {
    const csv = [
      HEADER,
      "2026-09-01,Pagamento recebido,- 500,00",
      "2026-13-01,Mês inválido,10,00",
      "2026-09-02,Cancelamento,- 25,00",
    ].join("\n");

    const result = parseNubankInvoiceCsv(csv);

    expect(result.headerError).toBeUndefined();
    expect(result.positives).toEqual([]);
    expect(result.negatives).toHaveLength(2);
    expect(result.invalid).toEqual([{ line: 3, reason: "date" }]);
  });
});

describe("parseNubankInvoiceCsv — casos de borda", () => {
  it("cabeçalho entre aspas é reconhecido e valor entre aspas preservado", () => {
    const csv = '"date","title","amount"\n2026-09-01,X,"1.234,56"';

    const result = parseNubankInvoiceCsv(csv);

    expect(result.headerError).toBeUndefined();
    expect(result.positives).toEqual([
      { line: 2, date: "2026-09-01", title: "X", amountCents: 123456 },
    ]);
  });

  it("zero com sinal ou espaços é linha inválida", () => {
    const csv = [
      HEADER,
      "2026-09-01,A,- 0,00",
      "2026-09-02,B, 0 ",
      "2026-09-03,C,10,00",
    ].join("\n");

    const result = parseNubankInvoiceCsv(csv);

    expect(result.invalid).toEqual([
      { line: 2, reason: "amount" },
      { line: 3, reason: "amount" },
    ]);
    expect(result.positives).toHaveLength(1);
  });

  it("campo multilinha entre aspas mantém o número da linha de início", () => {
    const csv = [
      HEADER,
      "2026-09-01,\"Linha1",
      "Linha2\",10,00",
      "2026-09-02,Y,5,00",
    ].join("\n");

    const result = parseNubankInvoiceCsv(csv);

    expect(result.positives[0].title).toBe("Linha1\nLinha2");
    expect(result.positives[0].line).toBe(2);
    expect(result.positives[1].line).toBe(4);
  });

  it("arquivo só com cabeçalho não tem linhas válidas (a rota responderá 400)", () => {
    const result = parseNubankInvoiceCsv(`${HEADER}\n`);

    expect(result.headerError).toBeUndefined();
    expect(result.positives).toEqual([]);
    expect(result.negatives).toEqual([]);
    expect(result.invalid).toEqual([]);
  });

  it("texto que não é CSV devolve headerError em pt-BR sem exceção", () => {
    expect(() => parseNubankInvoiceCsv("qualquer\nlixo\nnada")).not.toThrow();

    const result = parseNubankInvoiceCsv("qualquer\nlixo\nnada");

    expect(result.headerError).toBe(
      'Cabeçalho inválido: era esperado "date,title,amount".',
    );
    expect(result.positives).toEqual([]);
  });
});

describe("parseNubankInvoiceCsv — validação da subtarefa 1", () => {
  it("campo multilinha com CRLF não deixa \\r sobrando no título (regressão)", () => {
    const csv = [
      HEADER,
      '2026-09-01,"Linha1\r\nLinha2",10,00',
      "2026-09-02,Y,5,00",
    ].join("\r\n");

    const result = parseNubankInvoiceCsv(csv);

    expect(result.headerError).toBeUndefined();
    expect(result.positives[0].title).toBe("Linha1\nLinha2");
    expect(result.positives[0].line).toBe(2);
    expect(result.positives[1].line).toBe(4);
  });

  it("título vazio vai para invalid reason title sem derrubar as demais", () => {
    const csv = [
      HEADER,
      "2026-09-01,,10,00",
      "2026-09-02,   ,10,00",
      "2026-09-03,Loja boa,10,00",
    ].join("\n");

    const result = parseNubankInvoiceCsv(csv);

    expect(result.invalid).toEqual([
      { line: 2, reason: "title" },
      { line: 3, reason: "title" },
    ]);
    expect(result.positives).toEqual([
      { line: 4, date: "2026-09-03", title: "Loja boa", amountCents: 1000 },
    ]);
  });

  it("valores pt-BR extras: inteiro, milhar sem decimal e negativo sem espaço", () => {
    const csv = [
      HEADER,
      "2026-09-01,Inteiro,12",
      "2026-09-02,Milhar,1.234",
      "2026-09-03,Estorno,-17,60",
      "2026-09-04,Vazio,",
    ].join("\n");

    const result = parseNubankInvoiceCsv(csv);

    expect(result.positives).toEqual([
      { line: 2, date: "2026-09-01", title: "Inteiro", amountCents: 1200 },
      { line: 3, date: "2026-09-02", title: "Milhar", amountCents: 123400 },
    ]);
    expect(result.negatives).toEqual([
      { line: 4, date: "2026-09-03", title: "Estorno", amountCents: -1760 },
    ]);
    expect(result.invalid).toEqual([{ line: 5, reason: "amount" }]);
  });

  it("cabeçalho tolera caixa e espaços; data e valor entre aspas são aceitos", () => {
    const csv = [
      " DATE , Title , AMOUNT ",
      '"2026-09-01",X,"10,00"',
    ].join("\n");

    const result = parseNubankInvoiceCsv(csv);

    expect(result.headerError).toBeUndefined();
    expect(result.positives).toEqual([
      { line: 2, date: "2026-09-01", title: "X", amountCents: 1000 },
    ]);
  });

  it("linhas em branco no meio preservam a numeração do arquivo", () => {
    const csv = [HEADER, "", "2026-09-01,X,10,00", "", "2026-09-02,Y,5,00"].join(
      "\n",
    );

    const result = parseNubankInvoiceCsv(csv);

    expect(result.positives).toEqual([
      { line: 3, date: "2026-09-01", title: "X", amountCents: 1000 },
      { line: 5, date: "2026-09-02", title: "Y", amountCents: 500 },
    ]);
  });
});

describe("parseNubankInvoiceCsv — revalidação da subtarefa 1", () => {
  it("arquivo com quebra de linha CR única é parseado (regressão)", () => {
    const csv = [
      HEADER,
      "2026-09-01,Loja A,10,00",
      "2026-09-02,Pagamento recebido,- 5,00",
      "2026-09-03,Loja B,5,00",
    ].join("\r");

    const result = parseNubankInvoiceCsv(csv);

    expect(result.headerError).toBeUndefined();
    expect(result.positives).toEqual([
      { line: 2, date: "2026-09-01", title: "Loja A", amountCents: 1000 },
      { line: 4, date: "2026-09-03", title: "Loja B", amountCents: 500 },
    ]);
    expect(result.negatives).toEqual([
      {
        line: 3,
        date: "2026-09-02",
        title: "Pagamento recebido",
        amountCents: -500,
      },
    ]);
  });

  it("CR único dentro de campo entre aspas vira quebra de linha", () => {
    const csv = `${HEADER}\r2026-09-01,"Linha1\rLinha2",10,00\r2026-09-02,Y,5,00`;

    const result = parseNubankInvoiceCsv(csv);

    expect(result.headerError).toBeUndefined();
    expect(result.positives[0].title).toBe("Linha1\nLinha2");
    expect(result.positives[0].line).toBe(2);
    expect(result.positives[1].line).toBe(4);
  });

  it("aspas escapadas com vírgula dentro do título", () => {
    const csv = `${HEADER}\n2026-09-01,"Mercado ""Pão e Cia"", Ltda",10,00`;

    const result = parseNubankInvoiceCsv(csv);

    expect(result.headerError).toBeUndefined();
    expect(result.positives[0].title).toBe('Mercado "Pão e Cia", Ltda');
    expect(result.positives[0].amountCents).toBe(1000);
  });

  it("milhar completo e negativo com milhar", () => {
    const csv = [
      HEADER,
      "2026-09-01,A,1.234.567,89",
      "2026-09-02,B,- 1.234,56",
      "2026-09-03,C,999.999.999,99",
    ].join("\n");

    const result = parseNubankInvoiceCsv(csv);

    expect(result.positives.map((p) => p.amountCents)).toEqual([
      123456789, 99999999999,
    ]);
    expect(result.negatives.map((p) => p.amountCents)).toEqual([-123456]);
  });

  it("valor negativo entre aspas e espaço não separável antes do número", () => {
    const csv = [
      HEADER,
      '2026-09-01,Estorno,"- 17,60"',
      "2026-09-02,Estorno,-\u00a017,60",
    ].join("\n");

    const result = parseNubankInvoiceCsv(csv);

    expect(result.negatives.map((n) => n.amountCents)).toEqual([-1760, -1760]);
    expect(result.positives).toEqual([]);
  });

  it("datas limite do calendário: 31/04 e 29/02/2026 inválidas, 31/12 e 01/01 válidas", () => {
    const csv = [
      HEADER,
      "2026-04-31,A,10,00",
      "2026-02-29,B,10,00",
      "2026-12-31,C,10,00",
      "2026-01-01,D,10,00",
    ].join("\n");

    const result = parseNubankInvoiceCsv(csv);

    expect(result.invalid.map((i) => i.line)).toEqual([2, 3]);
    expect(result.positives.map((p) => p.date)).toEqual([
      "2026-12-31",
      "2026-01-01",
    ]);
  });

  it("BOM + CRLF com todas as colunas entre aspas", () => {
    const csv =
      "\uFEFF" +
      ['"date","title","amount"', '"2026-09-01","Netflix.Com","45,90"'].join(
        "\r\n",
      );

    const result = parseNubankInvoiceCsv(csv);

    expect(result.headerError).toBeUndefined();
    expect(result.positives).toEqual([
      { line: 2, date: "2026-09-01", title: "Netflix.Com", amountCents: 4590 },
    ]);
  });

  it("valores ambíguos: 1,234 inválido, 45.90 aceito, 0.00 inválido", () => {
    const csv = [
      HEADER,
      "2026-09-01,A,1,234",
      "2026-09-02,B,45.90",
      "2026-09-03,C,0.00",
      "2026-09-04,D,1,00",
    ].join("\n");

    const result = parseNubankInvoiceCsv(csv);

    expect(result.invalid.map((i) => i.line)).toEqual([2, 4]);
    expect(result.positives.map((p) => p.amountCents)).toEqual([4590, 100]);
  });

  it("cabeçalho repetido no meio vira linha inválida e não trava o parse", () => {
    const csv = [
      HEADER,
      "2026-09-01,A,5,00",
      HEADER,
      "2026-09-02,B,6,00",
    ].join("\n");

    const result = parseNubankInvoiceCsv(csv);

    expect(result.positives).toHaveLength(2);
    expect(result.invalid).toEqual([{ line: 3, reason: "date" }]);
  });

  it("ordem das linhas preservada com mistura de válidas, inválidas e negativas", () => {
    const csv = [
      HEADER,
      "2026-09-01,A,10,00",
      "2026-09-02,B,0,00",
      "2026-09-03,C,- 5,00",
      "2026-09-04,D,20,00",
    ].join("\n");

    const result = parseNubankInvoiceCsv(csv);

    expect(result.positives.map((p) => p.line)).toEqual([2, 5]);
    expect(result.invalid.map((i) => i.line)).toEqual([3]);
    expect(result.negatives.map((n) => n.line)).toEqual([4]);
  });

  it("título vazio entre aspas vai para invalid title", () => {
    const csv = `${HEADER}\n2026-09-01,"",10,00`;

    const result = parseNubankInvoiceCsv(csv);

    expect(result.invalid).toEqual([{ line: 2, reason: "title" }]);
  });
});
