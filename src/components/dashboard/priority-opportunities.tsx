import { Target } from "lucide-react";
import Link from "next/link";

import { EmptyState } from "@/components/states/empty-state";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { PriorityOpportunity } from "@/server/repositories/dashboard";

export function PriorityOpportunities({
  items,
  statusLabels,
}: {
  items: PriorityOpportunity[];
  statusLabels: Record<string, string>;
}) {
  if (items.length === 0) {
    return (
      <EmptyState
        icon={Target}
        title="Nenhuma oportunidade pontuada"
        description="Quando houver empresas avaliadas, as oportunidades em aberto com maior pontuação aparecerão aqui."
      />
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          <TableHead>Empresa</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="text-right">Pontuação</TableHead>
          <TableHead className="text-right">Confiança</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.map((item) => (
          <TableRow key={item.id}>
            <TableCell>
              <Link href={`/oportunidades/${item.id}`} className="font-medium text-foreground hover:underline">
                {item.companyName}
              </Link>
              {item.segment ? <p className="text-xs text-subtle-foreground">{item.segment}</p> : null}
            </TableCell>
            <TableCell>
              <Badge>{statusLabels[item.status] ?? item.status}</Badge>
            </TableCell>
            <TableCell className="text-right tabular-nums">
              <span className="font-semibold">{item.score.toFixed(0)}</span>
              <span className="text-subtle-foreground">/100</span>
              {!item.isComplete ? (
                <span className="block text-[11px] text-warning-text">dados incompletos</span>
              ) : null}
            </TableCell>
            <TableCell className="text-right text-muted-foreground tabular-nums">
              {item.confidence === null ? "—" : `${item.confidence.toFixed(0)}%`}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
