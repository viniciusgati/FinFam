import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  EXPORT_TABLE_NAMES,
  buildExportBundle,
  isExportTableName,
  toCsvExport,
  toJsonExport,
  type ExportRow,
  type ExportTableName,
} from "@/lib/export-data";
import { resolveTimeZone, zonedDateParts } from "@/lib/time";

export const runtime = "nodejs";

/** Ordenação determinística para o backup (instante e desempate por id). */
const ORDER_BY = [{ createdAt: "asc" }, { id: "asc" }] as const;

const TABLE_QUERIES: Record<ExportTableName, () => Promise<ExportRow[]>> = {
  incomes: () => prisma.income.findMany({ orderBy: [...ORDER_BY] }),
  variable_incomes: () =>
    prisma.variableIncome.findMany({ orderBy: [...ORDER_BY] }),
  fixed_expenses: () =>
    prisma.fixedExpense.findMany({ orderBy: [...ORDER_BY] }),
  credit_cards: () =>
    prisma.creditCard.findMany({ orderBy: [...ORDER_BY] }),
  variable_expenses: () =>
    prisma.variableExpense.findMany({ orderBy: [...ORDER_BY] }),
  card_purchases: () =>
    prisma.cardPurchase.findMany({ orderBy: [...ORDER_BY] }),
  monthly_snapshots: () =>
    prisma.monthlySnapshot.findMany({ orderBy: [...ORDER_BY] }),
  monthly_category_snapshots: () =>
    prisma.monthlyCategorySnapshot.findMany({ orderBy: [...ORDER_BY] }),
  app_settings: () =>
    prisma.appSettings.findMany({ orderBy: [...ORDER_BY] }),
  monthly_reviews: () =>
    prisma.monthlyReview.findMany({ orderBy: [...ORDER_BY] }),
  shopping_items: () =>
    prisma.shoppingItem.findMany({ orderBy: [...ORDER_BY] }),
};

function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

/** Dia corrente no fuso da família, sempre `YYYY-MM-DD`. */
function isoDay(date: Date, timeZone: string): string {
  const { year, month, day } = zonedDateParts(date, timeZone);
  return `${year}-${pad2(month)}-${pad2(day)}`;
}

function attachment(filename: string): string {
  return `attachment; filename="${filename}"`;
}

function badRequest(error: string): NextResponse {
  return NextResponse.json({ error }, { status: 400 });
}

export async function GET(request: Request): Promise<NextResponse> {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const formato = searchParams.get("formato") ?? "json";
  const tabela = searchParams.get("tabela");

  if (formato !== "json" && formato !== "csv") {
    return badRequest("Formato inválido: use json ou csv.");
  }

  if (formato === "json" && tabela !== null) {
    return badRequest("A exportação em JSON inclui todas as tabelas.");
  }

  if (formato === "csv" && tabela === null) {
    return badRequest("Informe a tabela para exportar em CSV.");
  }

  if (tabela !== null && !isExportTableName(tabela)) {
    return badRequest("Tabela desconhecida.");
  }

  const now = new Date();
  const timeZone = resolveTimeZone();
  const today = isoDay(now, timeZone);

  try {
    if (formato === "csv") {
      const table = tabela as ExportTableName;
      const rows = await TABLE_QUERIES[table]();
      const csv = toCsvExport(table, rows, { timeZone });

      return new NextResponse(csv, {
        status: 200,
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": attachment(`finfam-${table}-${today}.csv`),
        },
      });
    }

    const entries = await Promise.all(
      EXPORT_TABLE_NAMES.map(
        async (name) => [name, await TABLE_QUERIES[name]()] as const,
      ),
    );
    const tables = Object.fromEntries(entries) as Record<
      ExportTableName,
      ExportRow[]
    >;
    const bundle = buildExportBundle({ generatedAt: now, timeZone, tables });

    return new NextResponse(toJsonExport(bundle), {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": attachment(`finfam-dados-${today}.json`),
      },
    });
  } catch {
    return NextResponse.json(
      { error: "Não foi possível gerar a exportação." },
      { status: 500 },
    );
  }
}
