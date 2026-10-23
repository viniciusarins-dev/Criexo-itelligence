import { ChevronLeft, ChevronRight, History, Plus, RefreshCw } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { EmptyState } from "@/components/states/empty-state";
import { PageHeader } from "@/components/states/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDateTime } from "@/lib/formatting/date";
import { RESEARCH_STATUS, RESEARCH_TYPE_LABELS } from "@/lib/presentation/labels";
import { listResearch } from "@/server/repositories/research";

export const metadata: Metadata = { title: "Pesquisas anteriores" };

function ideasSummary(row: { approvedIdeas: number; pendingIdeas: number }) {
  const parts = [`${row.approvedIdeas} aprovada(s)`];
  if (row.pendingIdeas) parts.push(`${row.pendingIdeas} pendente(s)`);
  return parts.join(" · ");
}

export default async function ResearchListPage({ searchParams }: PageProps<"/pesquisas">) {
  const raw = await searchParams;
  const requested = Number(typeof raw.pagina === "string" ? raw.pagina : 1);
  const page = Number.isInteger(requested) && requested > 0 ? requested : 1;
  const data = await listResearch(page);
  const newButton = (
    <Button asChild>
      <Link href="/prospeccao">
        <Plus aria-hidden="true" />
        Nova prospecção
      </Link>
    </Button>
  );

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6">
      <PageHeader
        title="Pesquisas anteriores"
        description="Cada pesquisa guarda os parâmetros, as configurações usadas, as ideias decididas e o que foi encontrado."
        actions={newButton}
      />

      {data.rows.length === 0 ? (
        <Card>
          <EmptyState
            icon={History}
            title={page > 1 ? "Página sem pesquisas" : "Nenhuma pesquisa ainda"}
            description={page > 1 ? "Volte para a primeira página." : "Crie a primeira pesquisa para começar a prospecção."}
            action={page > 1 ? (
              <Button asChild variant="secondary">
                <Link href="/pesquisas">Primeira página</Link>
              </Button>
            ) : newButton}
          />
        </Card>
      ) : (
        <>
          <ul className="space-y-3 md:hidden" aria-label="Pesquisas">
            {data.rows.map((row) => (
              <li key={row.id}>
                <Link href={`/pesquisas/${row.id}`} className="block rounded-lg border border-border bg-surface p-4 hover:border-border-strong">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-medium break-words">{row.query}</p>
                      <p className="text-xs text-subtle-foreground">
                        {RESEARCH_TYPE_LABELS[row.researchType]} · {formatDateTime(row.createdAt)}
                      </p>
                    </div>
                    <Badge tone={RESEARCH_STATUS[row.status].tone}>{RESEARCH_STATUS[row.status].label}</Badge>
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">
                    Ideias: {ideasSummary(row)} · {row.companiesFound} empresa(s)
                  </p>
                </Link>
              </li>
            ))}
          </ul>

          <Card className="hidden md:block">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Pesquisa</TableHead>
                  <TableHead>Situação</TableHead>
                  <TableHead>Ideias</TableHead>
                  <TableHead className="text-right">Empresas</TableHead>
                  <TableHead>Fontes</TableHead>
                  <TableHead>Criada em</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.rows.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell>
                      <Link href={`/pesquisas/${row.id}`} className="font-medium hover:underline">
                        {row.query}
                      </Link>
                      <p className="flex items-center gap-1 text-xs text-subtle-foreground">
                        {RESEARCH_TYPE_LABELS[row.researchType]}
                        {row.isRerun ? (
                          <>
                            {" · "}
                            <RefreshCw aria-hidden="true" className="size-3" /> nova execução
                          </>
                        ) : null}
                      </p>
                    </TableCell>
                    <TableCell>
                      <Badge tone={RESEARCH_STATUS[row.status].tone}>{RESEARCH_STATUS[row.status].label}</Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{ideasSummary(row)}</TableCell>
                    <TableCell className="text-right tabular-nums">{row.companiesFound}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{row.sources.length ? row.sources.join(", ") : "—"}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {formatDateTime(row.createdAt)}
                      {row.createdBy ? <span className="block">{row.createdBy}</span> : null}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>

          {data.pageCount > 1 ? (
            <nav aria-label="Paginação" className="flex items-center justify-between gap-3">
              {data.page > 1 ? (
                <Button asChild variant="secondary" size="sm">
                  <Link href={data.page === 2 ? "/pesquisas" : `/pesquisas?pagina=${data.page - 1}`} rel="prev">
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
                  <Link href={`/pesquisas?pagina=${data.page + 1}`} rel="next">
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
