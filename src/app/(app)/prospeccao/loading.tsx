import { Skeleton } from "@/components/ui/skeleton";

export default function NewResearchLoading() {
  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6" aria-busy="true">
      <span className="sr-only">Carregando…</span>
      <Skeleton className="h-7 w-56" />
      <Skeleton className="h-10 w-full" />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <Skeleton className="h-96 rounded-lg" />
        <Skeleton className="h-72 rounded-lg" />
      </div>
    </div>
  );
}
