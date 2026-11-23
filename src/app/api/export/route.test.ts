import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { prismaMock, getSessionMock } = vi.hoisted(() => ({
  prismaMock: {
    income: { findMany: vi.fn() },
    variableIncome: { findMany: vi.fn() },
    fixedExpense: { findMany: vi.fn() },
    creditCard: { findMany: vi.fn() },
    variableExpense: { findMany: vi.fn() },
    cardPurchase: { findMany: vi.fn() },
    monthlySnapshot: { findMany: vi.fn() },
    monthlyCategorySnapshot: { findMany: vi.fn() },
    appSettings: { findMany: vi.fn() },
    monthlyReview: { findMany: vi.fn() },
    shoppingItem: { findMany: vi.fn() },
  },
  getSessionMock: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ prisma: prismaMock }));
vi.mock("@/lib/auth", () => ({ getSession: getSessionMock }));

import { GET } from "./route";
import { EXPORT_TABLE_NAMES } from "@/lib/export-data";

const ORDER_BY = [{ createdAt: "asc" }, { id: "asc" }];

function exportRequest(query = ""): Request {
  return new Request(`http://localhost/api/export${query}`);
}

function normalize(value: string): string {
  return value.replace(/\u00a0/g, " ");
}

/** `response.text()` descarta o BOM UTF-8; decodifica preservando os bytes. */
async function responseTextPreservingBom(response: Response): Promise<string> {
  const buffer = await response.arrayBuffer();
  return new TextDecoder("utf-8", { ignoreBOM: true }).decode(buffer);
}

const incomeRow = {
  id: "inc_1",
  name: "Salário",
  amountCents: 123456,
  receiveDay: 5,
  active: true,
  startMonth: "2026-01",
  endMonth: null,
  createdAt: new Date("2026-10-03T02:30:00.000Z"),
  updatedAt: new Date("2026-10-04T10:00:00.000Z"),
};

beforeEach(() => {
  vi.clearAllMocks();
  getSessionMock.mockResolvedValue({ user: "familia" });
  for (const delegate of Object.values(prismaMock)) {
    delegate.findMany.mockResolvedValue([]);
  }
  delete process.env.FINFAM_TIME_ZONE;
  // 02:30Z ainda é dia 2 em São Paulo (UTC-3).
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-03T02:30:00.000Z"));
});

afterEach(() => {
  vi.useRealTimers();
  delete process.env.FINFAM_USER;
  delete process.env.FINFAM_PASS;
  delete process.env.FINFAM_SESSION_SECRET;
});

describe("GET /api/export sem sessão", () => {
  it("retorna 401 sem consultar o Prisma e sem Content-Disposition", async () => {
    getSessionMock.mockResolvedValue(null);

    const response = await GET(exportRequest());

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "Não autenticado" });
    expect(response.headers.get("content-disposition")).toBeNull();
    for (const delegate of Object.values(prismaMock)) {
      expect(delegate.findMany).not.toHaveBeenCalled();
    }
  });
});

describe("GET /api/export JSON", () => {
  it("sem formato retorna o bundle completo com as 11 chaves", async () => {
    prismaMock.income.findMany.mockResolvedValue([incomeRow]);

    const response = await GET(exportRequest());

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe(
      "application/json; charset=utf-8",
    );
    expect(response.headers.get("content-disposition")).toBe(
      'attachment; filename="finfam-dados-2026-10-02.json"',
    );

    const body = await response.json();
    expect(body.versao).toBe(1);
    expect(body.geradoEm).toBe("2026-10-03T02:30:00.000Z");
    expect(body.fuso).toBe("America/Sao_Paulo");
    expect(Object.keys(body.tabelas)).toEqual(EXPORT_TABLE_NAMES);
    expect(body.tabelas.incomes[0].amountCents).toBe(123456);

    expect(prismaMock.income.findMany).toHaveBeenCalledWith({
      orderBy: ORDER_BY,
    });
  });

  it("aceita formato=json explícito e consulta as 11 tabelas", async () => {
    const response = await GET(exportRequest("?formato=json"));

    expect(response.status).toBe(200);
    for (const delegate of Object.values(prismaMock)) {
      expect(delegate.findMany).toHaveBeenCalledWith({ orderBy: ORDER_BY });
    }
    const body = await response.json();
    expect(Object.keys(body.tabelas)).toHaveLength(11);
  });

  it("tabela vazia vira array vazio no JSON", async () => {
    const response = await GET(exportRequest());
    const body = await response.json();

    expect(body.tabelas.incomes).toEqual([]);
    expect(body.tabelas.monthly_reviews).toEqual([]);
    expect(body.tabelas.shopping_items).toEqual([]);
  });

  it("não inclui segredos de ambiente mesmo quando definidos", async () => {
    process.env.FINFAM_USER = "usuario-secreto";
    process.env.FINFAM_PASS = "senha-secreta";
    process.env.FINFAM_SESSION_SECRET = "segredo-da-sessao";
    prismaMock.income.findMany.mockResolvedValue([incomeRow]);

    const response = await GET(exportRequest());
    const text = await response.text();

    expect(text).not.toContain("usuario-secreto");
    expect(text).not.toContain("senha-secreta");
    expect(text).not.toContain("segredo-da-sessao");
  });
});

describe("GET /api/export CSV", () => {
  it("exporta incomes com cabeçalho exato, formatCents e nome do dia", async () => {
    prismaMock.income.findMany.mockResolvedValue([incomeRow]);

    const response = await GET(exportRequest("?formato=csv&tabela=incomes"));

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("text/csv; charset=utf-8");
    expect(response.headers.get("content-disposition")).toBe(
      'attachment; filename="finfam-incomes-2026-10-02.csv"',
    );

    const csv = await responseTextPreservingBom(response);
    expect(csv.startsWith("\uFEFF")).toBe(true);
    const [header, line] = csv.split("\n");
    expect(header).toBe(
      "\uFEFFid,name,amountCents,receiveDay,active,startMonth,endMonth,createdAt,updatedAt",
    );
    expect(normalize(line)).toBe(
      'inc_1,Salário,"R$ 1.234,56",5,true,2026-01,,2026-10-03T02:30:00.000Z,2026-10-04T10:00:00.000Z',
    );

    expect(prismaMock.income.findMany).toHaveBeenCalledWith({
      orderBy: ORDER_BY,
    });
    expect(prismaMock.monthlyReview.findMany).not.toHaveBeenCalled();
  });

  it("tabela sem registros gera somente o cabeçalho", async () => {
    const response = await GET(
      exportRequest("?formato=csv&tabela=monthly_reviews"),
    );
    const csv = await responseTextPreservingBom(response);

    expect(csv).toBe("\uFEFFid,monthKey,summary,createdAt,updatedAt\n");
  });

  it("não inclui segredos de ambiente no CSV", async () => {
    process.env.FINFAM_USER = "usuario-secreto";
    process.env.FINFAM_PASS = "senha-secreta";
    process.env.FINFAM_SESSION_SECRET = "segredo-da-sessao";

    const response = await GET(exportRequest("?formato=csv&tabela=incomes"));
    const csv = await responseTextPreservingBom(response);

    expect(csv).not.toContain("usuario-secreto");
    expect(csv).not.toContain("senha-secreta");
    expect(csv).not.toContain("segredo-da-sessao");
  });
});

describe("GET /api/export parâmetros inválidos", () => {
  it("rejeita formato fora de json/csv sem consultar o Prisma", async () => {
    const response = await GET(exportRequest("?formato=xml"));

    expect(response.status).toBe(400);
    for (const delegate of Object.values(prismaMock)) {
      expect(delegate.findMany).not.toHaveBeenCalled();
    }
  });

  it("rejeita csv sem tabela sem consultar o Prisma", async () => {
    const response = await GET(exportRequest("?formato=csv"));

    expect(response.status).toBe(400);
    for (const delegate of Object.values(prismaMock)) {
      expect(delegate.findMany).not.toHaveBeenCalled();
    }
  });

  it("rejeita tabela desconhecida sem consultar o Prisma", async () => {
    const response = await GET(
      exportRequest("?formato=csv&tabela=segredos"),
    );

    expect(response.status).toBe(400);
    for (const delegate of Object.values(prismaMock)) {
      expect(delegate.findMany).not.toHaveBeenCalled();
    }
  });

  it("rejeita tabela junto de formato=json sem consultar o Prisma", async () => {
    const response = await GET(
      exportRequest("?formato=json&tabela=incomes"),
    );

    expect(response.status).toBe(400);
    for (const delegate of Object.values(prismaMock)) {
      expect(delegate.findMany).not.toHaveBeenCalled();
    }
  });
});

describe("GET /api/export falha do Prisma", () => {
  it("retorna 500 sem Content-Disposition e sem corpo parcial no JSON", async () => {
    prismaMock.income.findMany.mockRejectedValue(new Error("boom"));

    const response = await GET(exportRequest());

    expect(response.status).toBe(500);
    expect(response.headers.get("content-disposition")).toBeNull();
    expect(await response.json()).toEqual({
      error: "Não foi possível gerar a exportação.",
    });
  });

  it("retorna 500 sem Content-Disposition no CSV", async () => {
    prismaMock.income.findMany.mockRejectedValue(new Error("boom"));

    const response = await GET(exportRequest("?formato=csv&tabela=incomes"));

    expect(response.status).toBe(500);
    expect(response.headers.get("content-disposition")).toBeNull();
    expect(await response.json()).toEqual({
      error: "Não foi possível gerar a exportação.",
    });
  });
});
