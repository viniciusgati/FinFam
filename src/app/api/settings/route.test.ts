import { beforeEach, describe, expect, it, vi } from "vitest";

const { appSettingsMock } = vi.hoisted(() => ({
  appSettingsMock: {
    findUnique: vi.fn(),
    upsert: vi.fn(),
  },
}));

vi.mock("@/lib/db", () => ({
  prisma: { appSettings: appSettingsMock },
}));

import { GET, PUT } from "./route";

function jsonRequest(method: string, body: unknown) {
  return new Request("http://localhost/api/settings", {
    method,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/settings", () => {
  it("retorna o default sem linha persistida", async () => {
    appSettingsMock.findUnique.mockResolvedValue(null);

    const response = await GET();

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      cycleStartDay: 1,
      savingsGoalCents: null,
      consumptionMode: "INCOME",
    });
  });

  it("retorna o valor persistido", async () => {
    appSettingsMock.findUnique.mockResolvedValue({
      cycleStartDay: 20,
      savingsGoalCents: 50000,
      consumptionMode: "VARIABLE_BUDGET",
    });

    const response = await GET();

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      cycleStartDay: 20,
      savingsGoalCents: 50000,
      consumptionMode: "VARIABLE_BUDGET",
    });
  });

  it("converte coluna nula em savingsGoalCents null", async () => {
    appSettingsMock.findUnique.mockResolvedValue({
      cycleStartDay: 10,
      savingsGoalCents: null,
      consumptionMode: "INCOME",
    });

    const response = await GET();

    expect(await response.json()).toEqual({
      cycleStartDay: 10,
      savingsGoalCents: null,
      consumptionMode: "INCOME",
    });
  });
});

describe("PUT /api/settings", () => {
  it("grava o singleton e responde 200 com valor válido", async () => {
    appSettingsMock.upsert.mockResolvedValue({
      cycleStartDay: 20,
      savingsGoalCents: null,
      consumptionMode: "INCOME",
    });

    const response = await PUT(jsonRequest("PUT", { cycleStartDay: 20 }));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      cycleStartDay: 20,
      savingsGoalCents: null,
      consumptionMode: "INCOME",
    });
    expect(appSettingsMock.upsert).toHaveBeenCalledWith({
      where: { id: "singleton" },
      create: {
        id: "singleton",
        cycleStartDay: 20,
        savingsGoalCents: null,
        consumptionMode: "INCOME",
      },
      update: { cycleStartDay: 20 },
    });
  });

  it("grava a meta de economia em centavos", async () => {
    appSettingsMock.upsert.mockResolvedValue({
      cycleStartDay: 5,
      savingsGoalCents: 50000,
      consumptionMode: "INCOME",
    });

    const response = await PUT(
      jsonRequest("PUT", { cycleStartDay: 5, savingsGoalCents: 50000 }),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      cycleStartDay: 5,
      savingsGoalCents: 50000,
      consumptionMode: "INCOME",
    });
    expect(appSettingsMock.upsert).toHaveBeenCalledWith({
      where: { id: "singleton" },
      create: {
        id: "singleton",
        cycleStartDay: 5,
        savingsGoalCents: 50000,
        consumptionMode: "INCOME",
      },
      update: { cycleStartDay: 5, savingsGoalCents: 50000 },
    });
  });

  it("limpa a meta quando savingsGoalCents é null", async () => {
    appSettingsMock.upsert.mockResolvedValue({
      cycleStartDay: 5,
      savingsGoalCents: null,
      consumptionMode: "INCOME",
    });

    const response = await PUT(
      jsonRequest("PUT", { cycleStartDay: 5, savingsGoalCents: null }),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      cycleStartDay: 5,
      savingsGoalCents: null,
      consumptionMode: "INCOME",
    });
    expect(appSettingsMock.upsert).toHaveBeenCalledWith({
      where: { id: "singleton" },
      create: {
        id: "singleton",
        cycleStartDay: 5,
        savingsGoalCents: null,
        consumptionMode: "INCOME",
      },
      update: { cycleStartDay: 5, savingsGoalCents: null },
    });
  });

  it("grava o modo de consumo VARIABLE_BUDGET", async () => {
    appSettingsMock.upsert.mockResolvedValue({
      cycleStartDay: 5,
      savingsGoalCents: null,
      consumptionMode: "VARIABLE_BUDGET",
    });

    const response = await PUT(
      jsonRequest("PUT", {
        cycleStartDay: 5,
        consumptionMode: "VARIABLE_BUDGET",
      }),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      cycleStartDay: 5,
      savingsGoalCents: null,
      consumptionMode: "VARIABLE_BUDGET",
    });
    expect(appSettingsMock.upsert).toHaveBeenCalledWith({
      where: { id: "singleton" },
      create: {
        id: "singleton",
        cycleStartDay: 5,
        savingsGoalCents: null,
        consumptionMode: "VARIABLE_BUDGET",
      },
      update: { cycleStartDay: 5, consumptionMode: "VARIABLE_BUDGET" },
    });
  });

  it.each(["SAVINGS", "", "income"])(
    "rejeita consumptionMode %p com 400 e não grava",
    async (value) => {
      const response = await PUT(
        jsonRequest("PUT", { cycleStartDay: 1, consumptionMode: value }),
      );

      expect(response.status).toBe(400);
      expect((await response.json()).error).toBe("Modo de consumo inválido");
      expect(appSettingsMock.upsert).not.toHaveBeenCalled();
    },
  );

  it.each([0, 29, "abc"])(
    "rejeita cycleStartDay %p com 400 e não grava",
    async (value) => {
      const response = await PUT(jsonRequest("PUT", { cycleStartDay: value }));

      expect(response.status).toBe(400);
      expect((await response.json()).error).toBe(
        "Dia do ciclo deve ser entre 1 e 28",
      );
      expect(appSettingsMock.upsert).not.toHaveBeenCalled();
    },
  );

  it.each([
    [-1, "Meta de economia deve ser maior ou igual a zero"],
    [1.5, "Meta de economia deve ser um número inteiro em centavos"],
    ["100", "Meta de economia deve ser um número inteiro em centavos"],
  ])(
    "rejeita savingsGoalCents %p com 400 e não grava",
    async (value, message) => {
      const response = await PUT(
        jsonRequest("PUT", { cycleStartDay: 1, savingsGoalCents: value }),
      );

      expect(response.status).toBe(400);
      expect((await response.json()).error).toBe(message);
      expect(appSettingsMock.upsert).not.toHaveBeenCalled();
    },
  );

  it("rejeita corpo sem cycleStartDay", async () => {
    const response = await PUT(jsonRequest("PUT", {}));

    expect(response.status).toBe(400);
    expect(appSettingsMock.upsert).not.toHaveBeenCalled();
  });
});
