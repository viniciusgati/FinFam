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
  it("retorna o default 1 quando não há linha persistida", async () => {
    appSettingsMock.findUnique.mockResolvedValue(null);

    const response = await GET();

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ cycleStartDay: 1 });
  });

  it("retorna o valor persistido", async () => {
    appSettingsMock.findUnique.mockResolvedValue({ cycleStartDay: 20 });

    const response = await GET();

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ cycleStartDay: 20 });
  });
});

describe("PUT /api/settings", () => {
  it("grava o singleton e responde 200 com valor válido", async () => {
    appSettingsMock.upsert.mockResolvedValue({ cycleStartDay: 20 });

    const response = await PUT(jsonRequest("PUT", { cycleStartDay: 20 }));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ cycleStartDay: 20 });
    expect(appSettingsMock.upsert).toHaveBeenCalledWith({
      where: { id: "singleton" },
      create: { id: "singleton", cycleStartDay: 20 },
      update: { cycleStartDay: 20 },
    });
  });

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

  it("rejeita corpo sem cycleStartDay", async () => {
    const response = await PUT(jsonRequest("PUT", {}));

    expect(response.status).toBe(400);
    expect(appSettingsMock.upsert).not.toHaveBeenCalled();
  });
});
