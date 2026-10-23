import { BookmarkCheck, ChevronLeft, ChevronRight, KanbanSquare, Search, SearchX, Target } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { OpportunityScore } from "@/components/opportunities/opportunity-score";
import { StatusBadge } from "@/components/opportunities/status-badge";
import { EmptyState } from "@/components/states/empty-state";
import { PageHeader } from "@/components/states/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDateTime } from "@/lib/formatting/date";
import {
  listOpportunities,
  OPPORTUNITY_PAGE_SIZE,
  OPPORTUNITY_SORTS,
  opportunityListParamsSchema,
  type OpportunityListParams,
} from "@/server/repositories/opportunities";

export const metadata: Metadata = { title: "Oportunidades" };

function pageHref(params: OpportunityListParams, page: number) {
  const search = new URLSearchParams();
  if (params.q) search.set("q", params.q);
  if (params.status) search.set("status", params.status);
  if (params.salvas) search.set("salvas", "1");
  if (params.ordem !== "atualizacao") search.set("ordem", params.ordem);
  if (page > 1) search.set("pagina", String(page));
  const query = search.toString();
  return query ? `/oportunidades?${query}` : "/oportunidades";
}

export default async function OpportunitiesPage({ searchParams }: PageProps<"/oportunidades">) {
  const raw = await searchParams;
  const params = opportunityListParamsSchema.parse({
    q: typeof raw.q === "string" ? raw.q : undefined,
    status: typeof raw.status === "string" && raw.status ? raw.status : undefined,
    salvas: raw.salvas === "1" ? "1" : undefined,
    ordem: raw.ordem,
    pagina: raw.pagina,
  });
  const data = await listOpportunities(params);
  const filtered = Boolean(params.q || params.status || params.salvas);
  const first = (data.page - 1) * OPPORTUNITY_PAGE_SIZE + 1;
  const last = Math.min(data.total, data.page * OPPORTUNITY_PAGE_SIZE);

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6">
      <PageHeader
        title="Oportunidades"
        description="Produtos que cada empresa poderia comprar, com status comercial e histórico."
        actions={
          <Button asChild variant="secondary">
            <Link href="/pipeline">
              <KanbanSquare aria-hidden="true" />
              Ver pipeline
            </Link>
          </Button>
        }
      />

      <form
        role="search"
        aria-label="Filtrar oportunidades"
        className="grid gap-3 rounded-lg border border-border bg-surface p-4 md:grid-cols-2 xl:grid-cols-[minmax(14rem,2fr)_repeat(2,minmax(12.5rem,1fr))_auto_auto]"
      >
        <div className="relative">
          <Search aria-hidden="true" className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-subtle-foreground" />
          <label htmlFor="q" className="sr-only">
            Buscar empresa
          </label>
          <Input id="q" name="q" defaultValue={params.q ?? ""} placeholder="Nome da empresa" className="pl-9" />
        </div>
        <div>
          <label htmlFor="status" className="sr-only">
            Status
          </label>
          <NativeSelect id="status" name="status" defaultValue={params.status ?? ""}>
            <option value="">Todos os status</option>
            {data.statuses.map((status) => (
              <option key={status.key} value={status.key}>
                {status.label}
              </option>
            ))}
          </NativeSelect>
        </div>
        <div>
          <label htmlFor="ordem" className="sr-only">
            Ordenar por
          </label>
          <NativeSelect id="ordem" name="ordem" defaultValue={params.ordem}>
            {Object.entries(OPPORTUNITY_SORTS).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </NativeSelect>
        </div>
        <Checkbox id="salvas" name="salvas" value="1" defaultChecked={Boolean(params.salvas)} label="Somente salvas" className="self-center" />
        <div className="flex gap-2">
          <Button type="submit" variant="secondary" className="flex-1 md:flex-none">
            Filtrar
          </Button>
          {filtered || params.ordem !== "atualizacao" ? (
            <Button asChild variant="ghost">
              <Link href="/oportunidades">Limpar</Link>
            </Button>
          ) : null}
        </div>
      </form>

      {data.rows.length === 0 ? (
        <Card>
          {filtered ? (
            <EmptyState
              icon={SearchX}
              title="Nenhuma oportunidade encontrada"
              description="Nenhuma oportunidade corresponde aos filtros."
              action={
                <Button asChild variant="secondary">
                  <Link href="/oportunidades">Limpar filtros</Link>
                </Button>
              }
            />
          ) : (
            <EmptyState
              icon={Target}
              title="Nenhuma oportunidade ainda"
              description="Crie uma oportunidade na página de uma empresa. As pesquisas de prospecção também vão gerar oportunidades."
              action={
                <Button asChild>
                  <Link href="/empresas">Ir para Empresas</Link>
                </Button>
              }
            />
          )}
        </Card>
      ) : (
        <>
          <p className="text-sm text-muted-foreground" aria-live="polite">
            {data.total === 1 ? "1 oportunidade" : `${first}–${last} de ${data.total.toLocaleString("pt-BR")} oportunidades`}
          </p>

          <ul className="space-y-3 md:hidden" aria-label="Oportunidades">
            {data.rows.map((row) => (
              <li key={row.id}>
                <Link href={`/oportunidades/${row.id}`} className="block rounded-lg border border-border bg-surface p-4 hover:border-border-strong">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-medium">{row.companyName}</p>
                      <p className="text-xs text-subtle-foreground">{row.productName ?? "Sem produto definido"}</p>
                    </div>
                    <OpportunityScore score={row.score} stars={row.stars} isComplete={row.isComplete} />
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <StatusBadge statusKey={row.status} statuses={data.statuses} />
                    {row.isSaved ? <BookmarkCheck aria-label="Salva" className="size-4 text-primary" /> : null}
                  </div>
                </Link>
              </li>
            ))}
          </ul>

          <Card className="hidden md:block">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Empresa</TableHead>
                  <TableHead>Produto</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Pontuação</TableHead>
                  <TableHead className="text-right">Confiança</TableHead>
                  <TableHead>Atualizada em</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.rows.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell>
                      <Link href={`/oportunidades/${row.id}`} className="font-medium hover:underline">
                        {row.companyName}
                      </Link>
                      <p className="text-xs text-subtle-foreground">{[row.segment, row.place].filter(Boolean).join(" · ") || "—"}</p>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{row.productName ?? "Sem produto definido"}</TableCell>
                    <TableCell>
                      <span className="inline-flex items-center gap-2">
                        <StatusBadge statusKey={row.status} statuses={data.statuses} />
                        {row.isSaved ? <BookmarkCheck aria-label="Salva" className="size-4 text-primary" /> : null}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <OpportunityScore score={row.score} stars={row.stars} isComplete={row.isComplete} />
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground tabular-nums">
                      {row.confidence === null ? "—" : `${row.confidence.toFixed(0)}%`}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{formatDateTime(row.updatedAt)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>

          {data.pageCount > 1 ? (
            <nav aria-label="Paginação" className="flex items-center justify-between gap-3">
              {data.page > 1 ? (
                <Button asChild variant="secondary" size="sm">
                  <Link href={pageHref(params, data.page - 1)} rel="prev">
                    <ChevronLeft aria-hidden="true" />
                    Anterior
                  </Link>
                </Button>
              ) : (
                <span />
              )}
              <span className="text-sm text-muted-foreground">
                Página {data.page} de {data.pageCount}
              </span>
              {data.page < data.pageCount ? (
                <Button asChild variant="secondary" size="sm">
                  <Link href={pageHref(params, data.page + 1)} rel="next">
                    Próxima
                    <ChevronRight aria-hidden="true" />
                  </Link>
                </Button>
              ) : (
                <span />
              )}
            </nav>
          ) : null}
        </>
      )}
    </div>
  );
}
