import { describe, expect, it, vi } from "vitest";
import {
  parseReserveAmountInput,
  reserveAmountInputValue,
  RESERVE_FORM_BUTTON,
  RESERVE_FORM_ERROR,
  RESERVE_FORM_INVALID,
  RESERVE_FORM_LABEL,
  RESERVE_FORM_SUCCESS,
  saveReserveSnapshot,
} from "./reserve";

describe("parseReserveAmountInput", () => {
  it("aceita zero, valores pt-BR e inteiros", () => {
    expect(parseReserveAmountInput("0")).toBe(0);
    expect(parseReserveAmountInput("0,00")).toBe(0);
    expect(parseReserveAmountInput("1.234,56")).toBe(123456);
    expect(parseReserveAmountInput("12,34")).toBe(1234);
    expect(parseReserveAmountInput("100")).toBe(10000);
  });

  it("rejeita vazio, negativo e texto inválido", () => {
    expect(parseReserveAmountInput("")).toBeNull();
    expect(parseReserveAmountInput("   ")).toBeNull();
    expect(parseReserveAmountInput("-1,00")).toBeNull();
    expect(parseReserveAmountInput("abc")).toBeNull();
  });
});

describe("reserveAmountInputValue", () => {
  it("formata centavos para o input e preserva null como vazio", () => {
    expect(reserveAmountInputValue(null)).toBe("");
    expect(reserveAmountInputValue(0)).toBe("0,00");
    expect(reserveAmountInputValue(160000)).toBe("1.600,00");
    expect(reserveAmountInputValue(3990)).toBe("39,90");
  });
});

describe("saveReserveSnapshot", () => {
  it("envia mês e saldo e devolve sucesso", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ monthKey: "2026-11", amountCents: 160000 }), {
        status: 200,
      }),
    );

    const result = await saveReserveSnapshot({
      monthKey: "2026-11",
      amountCents: 160000,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    expect(result).toEqual({ ok: true, error: null });
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe("/api/reserve");
    expect(JSON.parse(String((init as RequestInit).body))).toEqual({
      monthKey: "2026-11",
      amountCents: 160000,
    });
  });

  it("usa a mensagem da rota em erro de validação", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: "Mês inválido" }), { status: 400 }),
    );

    const result = await saveReserveSnapshot({
      monthKey: "2026-11",
      amountCents: 0,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    expect(result).toEqual({ ok: false, error: "Mês inválido" });
  });

  it("cai na mensagem genérica em falha de rede ou resposta quebrada", async () => {
    const failing = vi.fn().mockRejectedValue(new Error("boom"));
    expect(
      await saveReserveSnapshot({
        monthKey: "2026-11",
        amountCents: 0,
        fetchImpl: failing as unknown as typeof fetch,
      }),
    ).toEqual({ ok: false, error: RESERVE_FORM_ERROR });

    const broken = vi.fn().mockResolvedValue(new Response("nope", { status: 500 }));
    expect(
      await saveReserveSnapshot({
        monthKey: "2026-11",
        amountCents: 0,
        fetchImpl: broken as unknown as typeof fetch,
      }),
    ).toEqual({ ok: false, error: RESERVE_FORM_ERROR });
  });

  it("expõe os textos exatos do formulário", () => {
    expect(RESERVE_FORM_LABEL).toBe("Saldo guardado (R$)");
    expect(RESERVE_FORM_BUTTON).toBe("Salvar saldo");
    expect(RESERVE_FORM_SUCCESS).toBe("Saldo confirmado");
    expect(RESERVE_FORM_INVALID).toBe(
      "Informe um valor maior ou igual a zero",
    );
    expect(RESERVE_FORM_ERROR).toBe(
      "Não foi possível salvar o saldo. Tente novamente.",
    );
  });
});
