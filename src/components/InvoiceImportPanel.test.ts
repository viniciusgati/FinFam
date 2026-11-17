import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { IMPORT_FAILURE_MESSAGE } from "@/lib/invoice-import";
import InvoiceImportPanel, {
  InvoiceImportBody,
  confirmationStatusText,
  competenceSummaryText,
  countsSummaryText,
  executeInvoiceImport,
  importTotalText,
  replaceConfirmMessage,
  runInvoiceImport,
  type InvoiceImportBodyProps,
  type InvoiceImportConfirmation,
  type InvoiceImportPreviewSummary,
  type InvoiceImportPanelProps,
} from "./InvoiceImportPanel";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

const CARDS = [
  { id: "card-1", name: "Nubank" },
  { id: "card-2", name: "Inter" },
];

function renderPanel(): string {
  const props: InvoiceImportPanelProps = { cards: CARDS };
  return renderToStaticMarkup(createElement(InvoiceImportPanel, props)).replace(
    /\u00a0/g,
    " ",
  );
}

function renderBody(
  overrides: Partial<InvoiceImportBodyProps> = {},
): string {
  const props: InvoiceImportBodyProps = {
    cards: CARDS,
    cardId: "",
    hasFile: false,
    busy: null,
    preview: null,
    status: null,
    error: null,
    onCardChange: vi.fn(),
    onFileChange: vi.fn(),
    onPreview: vi.fn(),
    onConfirm: vi.fn(),
    ...overrides,
  };
  return renderToStaticMarkup(createElement(InvoiceImportBody, props)).replace(
    /\u00a0/g,
    " ",
  );
}

function disabledButtonCount(html: string): number {
  const buttons = html.match(/<button[^>]*>/g) ?? [];
  return buttons.filter((tag) => tag.includes('disabled=""')).length;
}

type FetchImpl = (url: string, init: RequestInit) => Promise<Response>;

function makeFetch(impl: FetchImpl) {
  return vi.fn(impl);
}

function readSource(relativePath: string): string {
  return readFileSync(
    fileURLToPath(new URL(relativePath, import.meta.url)),
    "utf8",
  );
}

function runImportBody(source: string): string {
  const start = source.indexOf("async function run(");
  expect(start).toBeGreaterThanOrEqual(0);
  return source.slice(start, source.indexOf("\n  }\n", start));
}

describe("InvoiceImportPanel — estado inicial", () => {
  it("renderiza os textos exatos com os dois botões desabilitados", () => {
    const html = renderPanel();

    expect(html).toContain("Importar fatura (CSV)");
    expect(html).toContain("Pré-visualizar");
    expect(html).toContain("Substituir competência");
    expect(html.match(/<button[^>]*>/g)).toHaveLength(2);
    expect(disabledButtonCount(html)).toBe(2);
  });

  it("sem cartão selecionado ou sem arquivo ambos os botões ficam desabilitados", () => {
    expect(disabledButtonCount(renderBody({ cardId: "", hasFile: true }))).toBe(
      2,
    );
    expect(
      disabledButtonCount(renderBody({ cardId: "card-1", hasFile: false })),
    ).toBe(2);
  });

  it("com cartão e arquivo, substituir só habilita depois do preview", () => {
    expect(
      disabledButtonCount(
        renderBody({ cardId: "card-1", hasFile: true, preview: null }),
      ),
    ).toBe(1);
  });

  it("não mostra resumo, status nem alerta antes da primeira ação", () => {
    const html = renderPanel();

    expect(html).not.toContain('role="status"');
    expect(html).not.toContain('role="alert"');
    expect(html).not.toContain("Competência:");
    expect(html).not.toContain("Fatura substituída");
    expect(html).not.toContain("a importar");
  });

  it("leva ao glossário da competência", () => {
    const html = renderPanel();

    expect(html).toContain('href="/ajuda#competencia"');
    expect(html).toContain('aria-label="Saiba mais sobre Competência"');
  });
});

describe("textos puros do painel", () => {
  it("monta competência, contagens e total com os textos exatos", () => {
    expect(competenceSummaryText("2026-09")).toBe("Competência: setembro/2026");
    expect(
      countsSummaryText({ toImport: 9, toRemove: 2, toMatch: 1, ignored: 4 }),
    ).toBe("9 a importar · 2 a remover · 1 a casar · 4 a ignorar");
    expect(importTotalText(325170).replace(/\u00a0/g, " ")).toBe(
      "Total a importar: R$ 3.251,70",
    );
  });

  it("monta a confirmação destrutiva com competência e contagens exatas", () => {
    expect(
      replaceConfirmMessage({ monthKey: "2026-09", toImport: 9, toRemove: 2 }),
    ).toBe(
      "Substituir a competência de setembro/2026? 9 lançamentos serão importados e 2 serão removidos. Esta ação não pode ser desfeita.",
    );
  });
});

describe("InvoiceImportBody — carregando", () => {
  it("pré-visualização em voo: rótulo, status e botões desabilitados", () => {
    const html = renderBody({
      cardId: "card-1",
      hasFile: true,
      busy: "preview",
    });

    expect(html).toContain("Pré-visualizando…");
    expect(html).not.toContain("Pré-visualizar<");
    expect(html).toContain("Substituir competência");
    expect(html).toMatch(
      /<p[^>]*role="status"[^>]*aria-live="polite"[^>]*>Lendo fatura…<\/p>/,
    );
    expect(disabledButtonCount(html)).toBe(2);
  });

  it("confirmação em voo: rótulo, status e botões desabilitados", () => {
    const html = renderBody({
      cardId: "card-1",
      hasFile: true,
      busy: "confirm",
    });

    expect(html).toContain("Importando…");
    expect(html).not.toContain("Substituir competência");
    expect(html).toContain("Pré-visualizar");
    expect(html).toMatch(
      /<p[^>]*role="status"[^>]*aria-live="polite"[^>]*>Substituindo fatura…<\/p>/,
    );
    expect(disabledButtonCount(html)).toBe(2);
  });
});

describe("InvoiceImportBody — resumo e sucesso", () => {
  const preview: InvoiceImportPreviewSummary = {
    monthKey: "2026-09",
    toImport: 9,
    toRemove: 2,
    toMatch: 1,
    ignored: 4,
    totalCents: 325170,
  };

  it("exibe competência por extenso, contagens e total em pt-BR", () => {
    const html = renderBody({ cardId: "card-1", hasFile: true, preview });

    expect(html).toContain("Competência: setembro/2026");
    expect(html).toContain("9 a importar · 2 a remover · 1 a casar · 4 a ignorar");
    expect(html).toContain("Total a importar: R$ 3.251,70");
    expect(disabledButtonCount(html)).toBe(0);
  });

  it("o novo resumo substitui o anterior (um único painel)", () => {
    const previous = renderBody({
      cardId: "card-1",
      hasFile: true,
      preview: { ...preview, monthKey: "2026-08", toImport: 3 },
    });
    const current = renderBody({ cardId: "card-1", hasFile: true, preview });

    expect(previous).toContain("Competência: agosto/2026");
    expect(current).toContain("Competência: setembro/2026");
    expect(current).not.toContain("Competência: agosto/2026");
    expect(current.match(/Competência:/g)).toHaveLength(1);
  });

  it("confirmação bem-sucedida exibe o texto exato com role=status", () => {
    const confirmation: InvoiceImportConfirmation = {
      imported: 9,
      removed: 2,
      matched: 1,
      ignored: 4,
    };
    const status = confirmationStatusText(confirmation);
    expect(status).toBe(
      "Fatura substituída: 9 importadas, 2 removidas, 1 casadas, 4 ignoradas.",
    );

    const html = renderBody({ cardId: "card-1", hasFile: true, status });

    expect(html).toContain(
      "Fatura substituída: 9 importadas, 2 removidas, 1 casadas, 4 ignoradas.",
    );
    expect(html).toContain('role="status"');
  });

  it("erro aparece em role=alert com aria-live=assertive abaixo dos botões", () => {
    const html = renderBody({
      cardId: "card-1",
      hasFile: true,
      error: "Cartão não encontrado",
    });

    expect(html).toContain("Cartão não encontrado");
    expect(html).toMatch(
      /<p[^>]*role="alert"[^>]*aria-live="assertive"[^>]*>Cartão não encontrado<\/p>/,
    );
    expect(html.indexOf('role="alert"')).toBeGreaterThan(
      html.lastIndexOf("</button>"),
    );
  });
});

describe("executeInvoiceImport — requisição", () => {
  const CSV = "date,title,amount\n2026-09-01,Padaria,10,00";

  function fileOf(csv: string) {
    return { text: vi.fn(async () => csv) };
  }

  function jsonResponse(body: unknown, status = 200): Response {
    return new Response(JSON.stringify(body), {
      status,
      headers: { "content-type": "application/json" },
    });
  }

  it("lê o arquivo com File.text() e envia JSON {cardId, csv} (sem multipart)", async () => {
    const file = fileOf(CSV);
    const onImported = vi.fn();
    const fetchImpl = makeFetch(async () =>
      jsonResponse({
        monthKey: "2026-09",
        toImport: 1,
        toRemove: 0,
        toMatch: 0,
        ignored: 0,
        totalCents: 1000,
      }),
    );

    const outcome = await executeInvoiceImport({
      mode: "preview",
      cardId: "card-1",
      file,
      fetchImpl: fetchImpl as unknown as typeof fetch,
      onImported,
    });

    expect(file.text).toHaveBeenCalledTimes(1);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/card-invoices/import");
    expect(init.method).toBe("POST");
    expect(init.headers).toEqual({ "Content-Type": "application/json" });
    expect(typeof init.body).toBe("string");
    expect(JSON.parse(String(init.body))).toEqual({
      cardId: "card-1",
      csv: CSV,
      dryRun: true,
    });
    expect(outcome).toEqual({
      preview: {
        monthKey: "2026-09",
        toImport: 1,
        toRemove: 0,
        toMatch: 0,
        ignored: 0,
        totalCents: 1000,
      },
      confirmation: null,
      error: null,
    });
    // O refresh da página só acontece na confirmação.
    expect(onImported).not.toHaveBeenCalled();
  });

  it("confirmação devolve o resumo e chama onImported (router.refresh) uma vez", async () => {
    const file = fileOf(CSV);
    const onImported = vi.fn();
    const fetchImpl = makeFetch(async () =>
      jsonResponse({ imported: 1, removed: 0, matched: 0, ignored: 0 }),
    );

    const outcome = await executeInvoiceImport({
      mode: "confirm",
      cardId: "card-1",
      file,
      fetchImpl: fetchImpl as unknown as typeof fetch,
      onImported,
    });

    const [, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(String(init.body))).toEqual({ cardId: "card-1", csv: CSV });
    expect(outcome.confirmation).toEqual({
      imported: 1,
      removed: 0,
      matched: 0,
      ignored: 0,
    });
    expect(outcome.error).toBeNull();
    expect(onImported).toHaveBeenCalledTimes(1);
  });

  it("erro da rota (400) vira a mensagem em pt-BR sem chamar onImported", async () => {
    const file = fileOf(CSV);
    const onImported = vi.fn();
    const fetchImpl = makeFetch(async () =>
      jsonResponse({ error: "Cartão não encontrado" }, 400),
    );

    const outcome = await executeInvoiceImport({
      mode: "confirm",
      cardId: "inexistente",
      file,
      fetchImpl: fetchImpl as unknown as typeof fetch,
      onImported,
    });

    expect(outcome.error).toBe("Cartão não encontrado");
    expect(outcome.confirmation).toBeNull();
    expect(onImported).not.toHaveBeenCalled();
  });

  it("falha de rede usa a mensagem fixa e não propaga exceção", async () => {
    const file = fileOf(CSV);
    const fetchImpl = makeFetch(async () => {
      throw new Error("rede indisponível");
    });

    const outcome = await executeInvoiceImport({
      mode: "confirm",
      cardId: "card-1",
      file,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    expect(outcome.error).toBe(
      "Não foi possível importar a fatura. Tente novamente.",
    );
    expect(outcome.error).toBe(IMPORT_FAILURE_MESSAGE);
  });

  it("resposta 200 sem JSON válido usa a mensagem fixa", async () => {
    const file = fileOf(CSV);
    const fetchImpl = makeFetch(
      async () => new Response("não é json", { status: 200 }),
    );

    const outcome = await executeInvoiceImport({
      mode: "preview",
      cardId: "card-1",
      file,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    expect(outcome.error).toBe(IMPORT_FAILURE_MESSAGE);
    expect(outcome.preview).toBeNull();
  });
});

describe("runInvoiceImport — gate de confirmação", () => {
  const CSV = "date,title,amount\n2026-09-01,Padaria,10,00";
  const preview: InvoiceImportPreviewSummary = {
    monthKey: "2026-09",
    toImport: 9,
    toRemove: 2,
    toMatch: 1,
    ignored: 4,
    totalCents: 325170,
  };

  function fileOf(csv: string) {
    return { text: vi.fn(async () => csv) };
  }

  function jsonResponse(body: unknown, status = 200): Response {
    return new Response(JSON.stringify(body), {
      status,
      headers: { "content-type": "application/json" },
    });
  }

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("sem preview não confirma, não pergunta e não faz requisição", async () => {
    const confirm = vi.fn(() => true);
    vi.stubGlobal("window", { confirm });
    const fetchImpl = vi.fn();

    const outcome = await runInvoiceImport({
      mode: "confirm",
      cardId: "card-1",
      file: fileOf(CSV),
      preview: null,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    expect(outcome).toBeNull();
    expect(confirm).not.toHaveBeenCalled();
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("sem cartão ou sem arquivo não pergunta e não faz requisição", async () => {
    const confirm = vi.fn(() => true);
    vi.stubGlobal("window", { confirm });
    const fetchImpl = vi.fn();

    for (const params of [
      { cardId: "", file: fileOf(CSV) },
      { cardId: "card-1", file: null },
    ]) {
      const outcome = await runInvoiceImport({
        mode: "confirm",
        ...params,
        preview,
        fetchImpl: fetchImpl as unknown as typeof fetch,
      });

      expect(outcome).toBeNull();
    }

    expect(confirm).not.toHaveBeenCalled();
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("modo preview não pede confirmação e envia dryRun", async () => {
    const confirm = vi.fn(() => true);
    vi.stubGlobal("window", { confirm });
    const fetchImpl = makeFetch(async () =>
      jsonResponse({
        monthKey: "2026-09",
        toImport: 9,
        toRemove: 2,
        toMatch: 1,
        ignored: 4,
        totalCents: 325170,
      }),
    );

    const outcome = await runInvoiceImport({
      mode: "preview",
      cardId: "card-1",
      file: fileOf(CSV),
      preview,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    expect(confirm).not.toHaveBeenCalled();
    expect(outcome?.preview?.monthKey).toBe("2026-09");
    const [, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(String(init.body))).toEqual({
      cardId: "card-1",
      csv: CSV,
      dryRun: true,
    });
  });

  it("window.confirm falso: nenhuma requisição e nenhum estado é iniciado", async () => {
    const confirm = vi.fn(() => false);
    vi.stubGlobal("window", { confirm });
    const fetchImpl = vi.fn();
    const onStart = vi.fn();

    const outcome = await runInvoiceImport({
      mode: "confirm",
      cardId: "card-1",
      file: fileOf(CSV),
      preview,
      fetchImpl: fetchImpl as unknown as typeof fetch,
      onStart,
    });

    expect(outcome).toBeNull();
    expect(confirm).toHaveBeenCalledWith(replaceConfirmMessage(preview));
    expect(onStart).not.toHaveBeenCalled();
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("window.confirm verdadeiro: envia mode confirm uma única vez", async () => {
    const confirm = vi.fn(() => true);
    vi.stubGlobal("window", { confirm });
    const fetchImpl = makeFetch(async () =>
      jsonResponse({ imported: 9, removed: 2, matched: 1, ignored: 4 }),
    );
    const onStart = vi.fn();

    const outcome = await runInvoiceImport({
      mode: "confirm",
      cardId: "card-1",
      file: fileOf(CSV),
      preview,
      fetchImpl: fetchImpl as unknown as typeof fetch,
      onStart,
    });

    expect(confirm).toHaveBeenCalledWith(replaceConfirmMessage(preview));
    expect(onStart).toHaveBeenCalledTimes(1);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(String(init.body))).toEqual({ cardId: "card-1", csv: CSV });
    expect(outcome?.confirmation).toEqual({
      imported: 9,
      removed: 2,
      matched: 1,
      ignored: 4,
    });
  });
});

describe("InvoiceImportPanel — fonte (guard e wiring)", () => {
  const source = readSource("./InvoiceImportPanel.tsx");

  it("ignora cliques repetidos enquanto há requisição em voo", () => {
    const body = runImportBody(source);

    expect(body).toContain("if (busyRef.current) return;");
    const guard = body.indexOf("if (busyRef.current) return;");
    const start = body.indexOf("onStart:");
    const call = body.indexOf("runInvoiceImport({");
    expect(guard).toBeGreaterThanOrEqual(0);
    expect(guard).toBeLessThan(call);
    expect(call).toBeLessThan(start);
    expect(body).toContain("busyRef.current = true;");
    expect(body).toContain("busyRef.current = false;");
  });

  it("exige preview e window.confirm antes de executeInvoiceImport", () => {
    const start = source.indexOf("export async function runInvoiceImport(");
    expect(start).toBeGreaterThanOrEqual(0);
    const body = source.slice(start, source.indexOf("\n}\n", start));

    expect(body).toContain("if (!params.cardId || params.file === null) return null;");
    expect(body).toContain("if (params.preview === null) return null;");
    expect(body).toContain("window.confirm(message)");
    expect(body).toContain("if (!confirmImpl(");
    const confirmIndex = body.indexOf("if (!confirmImpl(");
    const startIndex = body.indexOf("params.onStart?.()");
    const callIndex = body.indexOf("executeInvoiceImport(");
    expect(confirmIndex).toBeGreaterThanOrEqual(0);
    expect(confirmIndex).toBeLessThan(startIndex);
    expect(startIndex).toBeLessThan(callIndex);
  });

  it("descarta o preview ao trocar o cartão ou o arquivo", () => {
    for (const name of ["resetFeedback", "handleCardChange", "handleFileChange"]) {
      const start = source.indexOf(`function ${name}(`);
      expect(start).toBeGreaterThanOrEqual(0);
      const body = source.slice(start, source.indexOf("\n  }\n", start));
      if (name === "resetFeedback") {
        expect(body).toContain("setPreview(null)");
      } else {
        expect(body).toContain("resetFeedback();");
      }
    }
  });

  it("chama router.refresh() após a confirmação persistida", () => {
    expect(source).toContain("onImported: () => router.refresh()");
    expect(source).toContain("confirmationStatusText(outcome.confirmation)");
  });

  it("mantém controles, payload em JSON e envio do arquivo pela UI", () => {
    expect(source).toContain('type="file"');
    expect(source).toContain('accept=".csv,text/csv"');
    expect(source).toContain("await params.file.text()");
    expect(source).toContain("body: JSON.stringify(payload)");
    expect(source.split("disabled={actionsDisabled}").length - 1).toBe(1);
    expect(source.split("disabled={confirmDisabled}").length - 1).toBe(1);
  });
});
