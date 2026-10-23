import { Skeleton } from "@/components/ui/skeleton";

export default function OpportunityLoading() {
  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6" aria-busy="true">
      <span className="sr-only">Carregando oportunidade…</span>
      <Skeleton className="h-4 w-28" />
      <Skeleton className="h-7 w-80 max-w-full" />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <Skeleton className="h-72 rounded-lg" />
        <Skeleton className="h-72 rounded-lg" />
      </div>
    </div>
  );
}
