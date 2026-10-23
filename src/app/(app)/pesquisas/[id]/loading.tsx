import { Skeleton } from "@/components/ui/skeleton";

export default function ResearchLoading() {
  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6" aria-busy="true">
      <span className="sr-only">Carregando pesquisa…</span>
      <Skeleton className="h-4 w-40" />
      <Skeleton className="h-7 w-80 max-w-full" />
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-32 rounded-lg" />
      <Skeleton className="h-72 rounded-lg" />
    </div>
  );
}
