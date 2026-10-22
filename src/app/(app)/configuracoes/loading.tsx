import { Skeleton } from "@/components/ui/skeleton";

export default function SettingsLoading() {
  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6" aria-busy="true">
      <span className="sr-only">Carregando configurações…</span>
      <Skeleton className="h-7 w-48" />
      <Skeleton className="h-4 w-full max-w-lg" />
      <Skeleton className="h-64 rounded-lg" />
      <Skeleton className="h-96 rounded-lg" />
    </div>
  );
}
