import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6" aria-busy="true">
      <span className="sr-only">Carregando…</span>
      <Skeleton className="h-7 w-56" />
      <Skeleton className="h-4 w-full max-w-lg" />
      <Skeleton className="h-16 rounded-lg" />
      <Skeleton className="h-96 rounded-lg" />
    </div>
  );
}
