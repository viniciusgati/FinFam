/**
 * Aviso do dashboard quando o ciclo selecionado ainda não começou. O card
 * principal e os demais mostram uma **previsão** com o que já está lançado
 * (rendas, contas fixas e faturas); gastos avulsos e compras do cartão vão
 * entrando quando o ciclo chegar.
 */
export default function CyclePreviewNotice() {
  return (
    <section
      role="status"
      className="rounded-2xl border border-dashed border-border-strong bg-surface p-4 text-center sm:p-5"
    >
      <h2 className="text-lg font-semibold text-foreground">Ciclo futuro</h2>
      <p className="mt-1 text-sm text-foreground-muted">
        Este ciclo ainda não começou. Os números abaixo são uma previsão com o
        que já está lançado: rendas, contas fixas e faturas.
      </p>
    </section>
  );
}
