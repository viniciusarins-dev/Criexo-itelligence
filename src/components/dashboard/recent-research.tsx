import { History } from "lucide-react";
import Link from "next/link";

import { EmptyState } from "@/components/states/empty-state";
import { Badge } from "@/components/ui/badge";
import { formatRelative } from "@/lib/formatting/date";
import { RESEARCH_STATUS, RESEARCH_TYPE_LABELS } from "@/lib/presentation/labels";
import type { RecentResearch as RecentResearchItem } from "@/server/repositories/dashboard";

export function RecentResearch({ items, now }: { items: RecentResearchItem[]; now: Date }) {
  if (items.length === 0) {
    return (
      <EmptyState
        icon={History}
        title="Nenhuma pesquisa executada"
        description="As pesquisas de prospecção aparecerão aqui com data, parâmetros e situação."
      />
    );
  }

  return (
    <ul className="divide-y divide-border">
      {items.map((item) => {
        const status = RESEARCH_STATUS[item.status];
        return (
          <li key={item.id} className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
            <div className="min-w-0">
              <Link href={`/pesquisas/${item.id}`} className="block truncate text-sm font-medium text-foreground hover:underline">
                {item.query}
              </Link>
              <p className="text-xs text-subtle-foreground">
                {RESEARCH_TYPE_LABELS[item.researchType]} · {formatRelative(item.createdAt, now)}
              </p>
            </div>
            <Badge tone={status.tone}>{status.label}</Badge>
          </li>
        );
      })}
    </ul>
  );
}
