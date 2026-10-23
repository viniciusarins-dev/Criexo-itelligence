import { Skeleton } from "@/components/ui/skeleton";

export default function ResearchListLoading() {
  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6" aria-busy="true">
      <span className="sr-only">Carregando pesquisas…</span>
      <Skeleton className="h-7 w-64" />
      <Skeleton className="h-96 rounded-lg" />
    </div>
  );
}
