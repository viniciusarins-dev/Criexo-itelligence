import { Skeleton } from "@/components/ui/skeleton";

export default function DashboardLoading() {
  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6" aria-busy="true" aria-live="polite">
      <span className="sr-only">Carregando dashboard…</span>
      <div className="space-y-2">
        <Skeleton className="h-3 w-32" />
        <Skeleton className="h-7 w-72" />
        <Skeleton className="h-4 w-full max-w-xl" />
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {Array.from({ length: 6 }, (_, index) => (
          <Skeleton key={index} className="h-[118px] rounded-lg" />
        ))}
      </div>
      <div className="grid gap-6 xl:grid-cols-3">
        <Skeleton className="h-72 rounded-lg xl:col-span-2" />
        <Skeleton className="h-72 rounded-lg" />
      </div>
    </div>
  );
}
