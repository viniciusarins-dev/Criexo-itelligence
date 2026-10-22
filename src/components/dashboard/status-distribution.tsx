import { KanbanSquare } from "lucide-react";

import { EmptyState } from "@/components/states/empty-state";
import type { StatusCount } from "@/server/repositories/dashboard";

/**
 * Distribuição de oportunidades por status comercial.
 * Barras horizontais em um único tom (a cor não codifica categoria) com o
 * valor sempre escrito ao lado — a lista funciona também como tabela.
 */
export function StatusDistribution({ counts }: { counts: StatusCount[] }) {
  const max = Math.max(0, ...counts.map((count) => count.total));
  const total = counts.reduce((sum, count) => sum + count.total, 0);

  if (total === 0) {
    return (
      <EmptyState
        icon={KanbanSquare}
        title="Nenhuma oportunidade registrada"
        description={`O pipeline tem ${counts.length} status configurados. A distribuição aparece quando houver oportunidades.`}
      />
    );
  }

  return (
    <div>
      <ul className="space-y-2.5" aria-label="Oportunidades por status comercial">
        {counts.map((count) => {
          const width = max === 0 ? 0 : (count.total / max) * 100;
          return (
            <li
              key={count.key}
              className="grid grid-cols-[minmax(0,9rem)_1fr_2.5rem] items-center gap-3 text-sm"
              title={`${count.label}: ${count.total}`}
            >
              <span className="truncate text-muted-foreground">{count.label}</span>
              <span className="relative h-2.5 rounded-r-[4px] bg-border/40" aria-hidden="true">
                {count.total > 0 ? (
                  <span
                    className="absolute inset-y-0 left-0 rounded-r-[4px] bg-primary/80"
                    style={{ width: `max(${width}%, 4px)` }}
                  />
                ) : null}
              </span>
              <span className="text-right font-medium text-foreground tabular-nums">{count.total}</span>
            </li>
          );
        })}
      </ul>
      <p className="mt-4 text-xs text-subtle-foreground">
        {`${total.toLocaleString("pt-BR")} oportunidade(s) no total.`}
      </p>
    </div>
  );
}
