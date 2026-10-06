import AppNav from "@/components/AppNav";
import FixedItemsSkeleton from "@/components/FixedItemsSkeleton";

export default function Loading() {
  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8">
      <div className="mx-auto max-w-3xl space-y-8">
        <AppNav current="/entradas" />
        <FixedItemsSkeleton title="entradas" />
      </div>
    </main>
  );
}
