import { BookmarkCheck, LayoutList, Rows3, Target } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { MoveSelect } from "@/components/opportunities/move-select";
import { OpportunityScore } from "@/components/opportunities/opportunity-score";
import { StatusBadge } from "@/components/opportunities/status-badge";
import { EmptyState } from "@/components/states/empty-state";
import { Notice } from "@/components/states/notice";
import { PageHeader } from "@/components/states/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { loadPipeline, PIPELINE_LIMIT } from "@/server/repositories/opportunities";

export const metadata: Metadata = { title: "Pipeline comercial" };

const CATEGORY_ACCENT = { open: "bg-border-strong", won: "bg-success", lost: "bg-danger" } as const;

export default async function PipelinePage({ searchParams }: PageProps<"/pipeline">) {
  const raw = await searchParams;
  const view = raw.visao === "tabela" ? "tabela" : "colunas";
  const onlySaved = raw.salvas === "1";
  const data = await loadPipeline({ onlySaved });
  const href = (next: { visao?: string; salvas?: boolean }) => {
    const search = new URLSearchParams();
    const v = next.visao ?? view;
    const s = next.salvas ?? onlySaved;
    if (v === "tabela") search.set("visao", "tabela");
    if (s) search.set("salvas", "1");
    const query = search.toString();
    return query ? `/pipeline?${query}` : "/pipeline";
  };
  const rows = data.columns.flatMap((column) => column.cards);

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <PageHeader
        title="Pipeline comercial"
        description="Oportunidades por etapa. Cada mudança de status fica no histórico."
        actions={
          <div className="flex flex-wrap gap-2" role="group" aria-label="Visualização">
            <Button asChild variant={view === "colunas" ? "primary" : "secondary"} size="sm">
              <Link href={href({ visao: "colunas" })} aria-current={view === "colunas" ? "page" : undefined}>
                <LayoutList aria-hidden="true" />
                Colunas
              </Link>
            </Button>
            <Button asChild variant={view === "tabela" ? "primary" : "secondary"} size="sm">
              <Link href={href({ visao: "tabela" })} aria-current={view === "tabela" ? "page" : undefined}>
                <Rows3 aria-hidden="true" />
                Tabela
              </Link>
            </Button>
          </div>
        }
      />

      <div className="flex flex-wrap items-center gap-3 text-sm">
        <span className="text-muted-foreground">{data.total.toLocaleString("pt-BR")} oportunidade(s)</span>
        <Link
          href={href({ salvas: !onlySaved })}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 transition-colors",
            onlySaved ? "border-primary/40 bg-primary-subtle text-foreground" : "border-border text-muted-foreground hover:text-foreground",
          )}
          aria-current={onlySaved ? "true" : undefined}
        >
          <BookmarkCheck aria-hidden="true" className="size-4" />
          Somente salvas
        </Link>
      </div>

      {data.truncated ? (
        <Notice tone="info" title={`Mostrando as ${PIPELINE_LIMIT} oportunidades com maior pontuação`}>
          Use a lista de Oportunidades para filtrar e ver todas.
        </Notice>
      ) : null}

      {rows.length === 0 ? (
        <Card>
          <EmptyState
            icon={Target}
            title={onlySaved ? "Nenhuma oportunidade salva" : "Nenhuma oportunidade no pipeline"}
            description="Crie uma oportunidade na página de uma empresa para acompanhá-la aqui."
            action={
              <Button asChild>
                <Link href="/empresas">Ir para Empresas</Link>
              </Button>
            }
          />
        </Card>
      ) : view === "colunas" ? (
        // Só o quadro rola na horizontal; a página nunca.
        <div className="relative w-full min-w-0 overflow-x-auto pb-2" tabIndex={0} aria-label="Quadro do pipeline (role para os lados)">
          <div className="flex min-w-max items-start gap-4">
            {data.columns.map((column) => (
              <section
                key={column.status.key}
                aria-labelledby={`coluna-${column.status.key}`}
                className="flex w-72 shrink-0 flex-col rounded-lg border border-border bg-surface"
              >
                <header className="flex items-center gap-2 border-b border-border px-3 py-2.5">
                  <span aria-hidden="true" className={cn("size-2 rounded-full", CATEGORY_ACCENT[column.status.category])} />
                  <h2 id={`coluna-${column.status.key}`} className="text-sm font-semibold">
                    {column.status.label}
                  </h2>
                  <span className="ml-auto text-xs text-muted-foreground tabular-nums">{column.cards.length}</span>
                </header>
                <ul className="flex flex-1 flex-col gap-2 p-2" aria-label={`Oportunidades em ${column.status.label}`}>
                  {column.cards.length === 0 ? (
                    <li className="px-2 py-6 text-center text-xs text-subtle-foreground">Vazio</li>
                  ) : (
                    column.cards.map((card) => (
                      <li key={card.id} className="space-y-2 rounded-md border border-border bg-surface-raised p-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <Link href={`/oportunidades/${card.id}`} className="text-sm font-medium break-words hover:underline">
                              {card.companyName}
                            </Link>
                            <p className="text-xs text-subtle-foreground">{card.productName ?? "Sem produto definido"}</p>
                          </div>
                          {card.isSaved ? <BookmarkCheck aria-label="Salva" className="size-4 shrink-0 text-primary" /> : null}
                        </div>
                        <div className="flex items-end justify-between gap-2 text-xs">
                          <span className="text-muted-foreground">{card.place ?? ""}</span>
                          <OpportunityScore score={card.score} stars={card.stars} isComplete={card.isComplete} />
                        </div>
                        <MoveSelect opportunityId={card.id} companyName={card.companyName} current={card.status} statuses={data.statuses} />
                      </li>
                    ))
                  )}
                </ul>
              </section>
            ))}
          </div>
        </div>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Empresa</TableHead>
                <TableHead>Produto</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Pontuação</TableHead>
                <TableHead className="min-w-40">Mover</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((card) => (
                <TableRow key={card.id}>
                  <TableCell>
                    <Link href={`/oportunidades/${card.id}`} className="font-medium hover:underline">
                      {card.companyName}
                    </Link>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{card.productName ?? "Sem produto definido"}</TableCell>
                  <TableCell>
                    <StatusBadge statusKey={card.status} statuses={data.statuses} />
                  </TableCell>
                  <TableCell className="text-right">
                    <OpportunityScore score={card.score} stars={card.stars} isComplete={card.isComplete} />
                  </TableCell>
                  <TableCell>
                    <MoveSelect opportunityId={card.id} companyName={card.companyName} current={card.status} statuses={data.statuses} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
