import { Skeleton } from "@/components/ui/skeleton";

export default function IdeasLoading() {
  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6" aria-busy="true">
      <span className="sr-only">Carregando ideias…</span>
      <Skeleton className="h-7 w-56" />
      <Skeleton className="h-8 w-80 max-w-full" />
      <Skeleton className="h-96 rounded-lg" />
    </div>
  );
}
