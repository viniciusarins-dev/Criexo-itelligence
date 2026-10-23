import { Skeleton } from "@/components/ui/skeleton";

export default function ReportsLoading() {
  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6" aria-busy="true">
      <span className="sr-only">Carregando relatórios…</span>
      <Skeleton className="h-7 w-64" />
      <Skeleton className="h-96 rounded-lg" />
    </div>
  );
}
