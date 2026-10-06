import { describe, expect, it } from "vitest";
import {
  DEFAULT_TIME_ZONE,
  resolveTimeZone,
  zonedDateParts,
  zonedTimeToUtc,
} from "./time";

describe("resolveTimeZone", () => {
  it("usa America/Sao_Paulo por default", () => {
    expect(resolveTimeZone({})).toBe(DEFAULT_TIME_ZONE);
  });

  it("respeita FINFAM_TIME_ZONE válido", () => {
    expect(resolveTimeZone({ FINFAM_TIME_ZONE: "America/Manaus" })).toBe(
      "America/Manaus",
    );
  });

  it("cai no default para valor vazio ou inválido", () => {
    expect(resolveTimeZone({ FINFAM_TIME_ZONE: "   " })).toBe(DEFAULT_TIME_ZONE);
    expect(resolveTimeZone({ FINFAM_TIME_ZONE: "Marte/Olympus" })).toBe(
      DEFAULT_TIME_ZONE,
    );
  });
});

describe("zonedDateParts", () => {
  it("converte para o calendário do fuso (mês 0-based)", () => {
    expect(
      zonedDateParts(new Date("2026-11-01T02:30:00Z"), "America/Sao_Paulo"),
    ).toEqual({ year: 2026, month: 10, day: 31 });
  });

  it("vira o mês à meia-noite do Brasil", () => {
    expect(
      zonedDateParts(new Date("2026-11-01T03:00:00Z"), "America/Sao_Paulo"),
    ).toEqual({ year: 2026, month: 11, day: 1 });
  });
});

describe("zonedTimeToUtc", () => {
  it("converte meia-noite brasileira para o instante UTC correto", () => {
    expect(
      zonedTimeToUtc(2026, 11, 1, "America/Sao_Paulo").toISOString(),
    ).toBe("2026-11-01T03:00:00.000Z");
  });

  it("faz round-trip com zonedDateParts", () => {
    const instant = zonedTimeToUtc(2026, 1, 15, DEFAULT_TIME_ZONE);
    expect(zonedDateParts(instant, DEFAULT_TIME_ZONE)).toEqual({
      year: 2026,
      month: 1,
      day: 15,
    });
  });
});
