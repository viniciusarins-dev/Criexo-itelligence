import { Lightbulb, Plus, SearchX } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { ApprovalBadge, OriginBadge } from "@/components/ideas/idea-summary";
import { EmptyState } from "@/components/states/empty-state";
import { PageHeader } from "@/components/states/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDateTime } from "@/lib/formatting/date";
import { APPROVAL_STATUS } from "@/lib/presentation/labels";
import { cn } from "@/lib/utils";
import { listIdeas } from "@/server/repositories/research";

export const metadata: Metadata = { title: "Produtos e ideias" };

const FILTERS = [
  { value: undefined, label: "Todas" },
  { value: "pending", label: APPROVAL_STATUS.pending.label },
  { value: "approved", label: "Aprovadas" },
  { value: "rejected", label: "Rejeitadas" },
] as const;

export default async function IdeasPage({ searchParams }: PageProps<"/produtos">) {
  const raw = await searchParams;
  const status = FILTERS.find((filter) => filter.value && filter.value === raw.status)?.value;
  const ideas = await listIdeas({ status });
  const newButton = (
    <Button asChild>
      <Link href="/produtos/nova">
        <Plus aria-hidden="true" />
        Nova ideia
      </Link>
    </Button>
  );

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6">
      <PageHeader
        title="Produtos e ideias"
        description="Ideias de produto, de onde vieram, quem decidiu e em quais oportunidades aparecem."
        actions={newButton}
      />

      <nav aria-label="Filtrar por decisão" className="flex flex-wrap gap-2">
        {FILTERS.map((filter) => {
          const active = filter.value === status;
          return (
            <Link
              key={filter.label}
              href={filter.value ? `/produtos?status=${filter.value}` : "/produtos"}
              aria-current={active ? "page" : undefined}
              className={cn(
                "rounded-full border px-3 py-1 text-sm",
                active ? "border-primary/40 bg-primary-subtle text-foreground" : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              {filter.label}
            </Link>
          );
        })}
      </nav>

      {ideas.length === 0 ? (
        <Card>
          {status ? (
            <EmptyState
              icon={SearchX}
              title="Nenhuma ideia com esta decisão"
              description="Mude o filtro para ver as demais."
              action={
                <Button asChild variant="secondary">
                  <Link href="/produtos">Ver todas</Link>
                </Button>
              }
            />
          ) : (
            <EmptyState
              icon={Lightbulb}
              title="Nenhuma ideia registrada"
              description="Ideias surgem nas pesquisas de prospecção ou podem ser cadastradas aqui."
              action={newButton}
            />
          )}
        </Card>
      ) : (
        <>
          <ul className="space-y-3 md:hidden" aria-label="Ideias">
            {ideas.map((idea) => (
              <li key={idea.id}>
                <Link href={`/produtos/${idea.id}`} className="block rounded-lg border border-border bg-surface p-4 hover:border-border-strong">
                  <p className="font-medium break-words">{idea.name}</p>
                  <p className="text-xs text-subtle-foreground">{idea.targetSegment ?? "Segmento não informado"}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <ApprovalBadge status={idea.approvalStatus} />
                    <OriginBadge origin={idea.origin} />
                  </div>
                </Link>
              </li>
            ))}
          </ul>

          <Card className="hidden md:block">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Ideia</TableHead>
                  <TableHead>Decisão</TableHead>
                  <TableHead>Origem</TableHead>
                  <TableHead className="text-right">Oportunidades</TableHead>
                  <TableHead>Registrada em</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ideas.map((idea) => (
                  <TableRow key={idea.id}>
                    <TableCell>
                      <Link href={`/produtos/${idea.id}`} className="font-medium hover:underline">
                        {idea.name}
                      </Link>
                      <p className="text-xs text-subtle-foreground">{idea.targetSegment ?? "Segmento não informado"}</p>
                      {idea.similar.length ? <p className="text-xs text-warning-text">Há ideia parecida registrada</p> : null}
                    </TableCell>
                    <TableCell>
                      <ApprovalBadge status={idea.approvalStatus} />
                    </TableCell>
                    <TableCell>
                      <OriginBadge origin={idea.origin} />
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{idea.opportunityCount}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{formatDateTime(idea.createdAt)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </>
      )}
    </div>
  );
}
