"use client";

import { useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { shiftMonthKey } from "@/lib/finance";
import { MonthSelectorView } from "./MonthSelector";
import DashboardSkeleton from "./DashboardSkeleton";

export interface MonthNavigationViewProps {
  monthKey: string;
  isCurrentMonth: boolean;
  isPending: boolean;
  rangeLabel?: string;
  onPrevious: () => void;
  onNext: () => void;
  onSelectMonth: (monthKey: string) => void;
  children: ReactNode;
}

/**
 * Apresentação pura do seletor + conteúdo do dashboard. Enquanto a navegação
 * (`?mes`) está pendente, o conteúdo anterior é substituído pelo skeleton de
 * carregamento — inclusive o card "Pode gastar por dia".
 */
export function MonthNavigationView({
  monthKey,
  isCurrentMonth,
  isPending,
  rangeLabel,
  onPrevious,
  onNext,
  onSelectMonth,
  children,
}: MonthNavigationViewProps) {
  return (
    <>
      <MonthSelectorView
        monthKey={monthKey}
        isCurrentMonth={isCurrentMonth}
        isPending={isPending}
        rangeLabel={rangeLabel}
        onPrevious={onPrevious}
        onNext={onNext}
        onSelectMonth={onSelectMonth}
      />
      {isPending ? <DashboardSkeleton /> : children}
    </>
  );
}

interface MonthNavigationProps {
  monthKey: string;
  isCurrentMonth: boolean;
  basePath?: string;
  rangeLabel?: string;
  queryMonthShift?: number;
  children: ReactNode;
}

export default function MonthNavigation({
  monthKey,
  isCurrentMonth,
  basePath = "/",
  rangeLabel,
  queryMonthShift = 0,
  children,
}: MonthNavigationProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const displayMonth = shiftMonthKey(monthKey, queryMonthShift);
  const toQueryMonth = (display: string) =>
    shiftMonthKey(display, -queryMonthShift);

  function navigate(targetDisplay: string) {
    if (!targetDisplay) return;
    const query = toQueryMonth(targetDisplay);
    if (!query || query === monthKey) return;
    startTransition(() => {
      router.push(`${basePath}?mes=${query}`);
    });
  }

  return (
    <MonthNavigationView
      monthKey={displayMonth}
      isCurrentMonth={isCurrentMonth}
      isPending={isPending}
      rangeLabel={rangeLabel}
      onPrevious={() => navigate(shiftMonthKey(displayMonth, -1))}
      onNext={() => navigate(shiftMonthKey(displayMonth, 1))}
      onSelectMonth={navigate}
    >
      {children}
    </MonthNavigationView>
  );
}
