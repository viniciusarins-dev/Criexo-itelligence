import { Search } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/** Pesquisa de empresas a partir de qualquer página (abre a lista filtrada). */
export function GlobalSearch() {
  return (
    <>
      <form action="/empresas" role="search" aria-label="Pesquisa global" className="relative hidden w-full max-w-md sm:block">
        <Search aria-hidden="true" className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-subtle-foreground" />
        <label htmlFor="global-search" className="sr-only">
          Buscar empresas
        </label>
        <Input id="global-search" name="q" placeholder="Buscar empresas por nome, segmento ou bairro" className="h-9 pl-9" />
      </form>
      <Button asChild variant="ghost" size="icon" className="sm:hidden">
        <Link href="/empresas" aria-label="Buscar empresas">
          <Search aria-hidden="true" />
        </Link>
      </Button>
    </>
  );
}
