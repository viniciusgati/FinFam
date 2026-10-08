import type { Metadata } from "next";
import FixedItemsManager, {
  type FixedItem,
} from "@/components/FixedItemsManager";
import ExtraIncomesManager, {
  type VariableIncomeDTO,
} from "@/components/ExtraIncomesManager";
import { prisma } from "@/lib/db";
import { monthLabel, shiftMonthKey } from "@/lib/finance";
import {
  currentMonthParam,
  isValidMonthParam,
  monthRange,
} from "@/lib/variable-expenses";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Cadastrar entradas — FinFam" };

interface MonthOption {
  value: string;
  label: string;
}

function buildMonthOptions(currentMes: string, selected: string): MonthOption[] {
  const values = new Set<string>();
  for (let offset = -12; offset <= 12; offset += 1) {
    values.add(shiftMonthKey(currentMes, offset));
  }
  values.add(selected);
  return [...values]
    .sort()
    .map((value) => ({ value, label: monthLabel(value) }));
}

export default async function EntradasPage({
  searchParams,
}: {
  searchParams: Promise<{ mes?: string | string[] }>;
}) {
  const params = await searchParams;
  const rawMes = Array.isArray(params.mes) ? params.mes[0] : params.mes;
  const mes = isValidMonthParam(rawMes) ? rawMes : currentMonthParam();
  const currentMes = currentMonthParam();
  const today = new Date().toISOString().slice(0, 10);
  const monthOptions = buildMonthOptions(currentMes, mes);

  let items: FixedItem[] = [];
  let loadError: string | null = null;
  let extraIncomes: VariableIncomeDTO[] = [];
  let extraLoadError: string | null = null;

  try {
    items = await prisma.income.findMany({
      orderBy: [{ name: "asc" }, { id: "asc" }],
    });
  } catch {
    loadError = "Não foi possível carregar as entradas. Tente novamente.";
  }

  try {
    const { gte, lt } = monthRange(mes);
    const rows = await prisma.variableIncome.findMany({
      where: { date: { gte, lt } },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    });
    extraIncomes = rows.map((row) => ({
      id: row.id,
      description: row.description,
      amountCents: row.amountCents,
      date: row.date.toISOString(),
      createdAt: row.createdAt.toISOString(),
    }));
  } catch {
    extraLoadError =
      "Não foi possível carregar as entradas avulsas. Tente novamente.";
  }

  return (
    <div className="space-y-10">
      <FixedItemsManager
        endpoint="/api/incomes"
        title="Entradas fixas"
        dayField="receiveDay"
        dayLabel="Dia de recebimento"
        dayVerb="recebe"
        showCategory={false}
        emptyMessage="Nenhuma entrada cadastrada ainda."
        ctaLabel="Cadastrar entrada"
        savedMessage="Entrada salva."
        deactivatedMessage="Entrada desativada."
        reactivatedMessage="Entrada reativada."
        fallbackErrorMessage="Não foi possível salvar. Tente novamente."
        initialItems={items}
        initialError={loadError}
      />

      <ExtraIncomesManager
        key={mes}
        mes={mes}
        today={today}
        currentMes={currentMes}
        monthOptions={monthOptions}
        initialIncomes={extraIncomes}
        initialError={extraLoadError}
      />
    </div>
  );
}
