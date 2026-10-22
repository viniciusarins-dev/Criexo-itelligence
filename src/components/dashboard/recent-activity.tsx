import { Activity } from "lucide-react";

import { EmptyState } from "@/components/states/empty-state";
import { formatRelative } from "@/lib/formatting/date";
import { ACTIVITY_LABELS } from "@/lib/presentation/labels";
import type { RecentActivity as RecentActivityItem } from "@/server/repositories/dashboard";

export function RecentActivity({
  items,
  statusLabels,
  now,
}: {
  items: RecentActivityItem[];
  statusLabels: Record<string, string>;
  now: Date;
}) {
  if (items.length === 0) {
    return (
      <EmptyState
        icon={Activity}
        title="Sem atividades registradas"
        description="Mudanças de status, contatos e observações sobre oportunidades aparecerão aqui."
      />
    );
  }

  return (
    <ol className="space-y-4">
      {items.map((item) => (
        <li key={item.id} className="relative pl-5">
          <span aria-hidden="true" className="absolute top-1.5 left-0 size-2 rounded-full bg-border-strong" />
          <p className="text-sm text-foreground">
            <span className="font-medium">{ACTIVITY_LABELS[item.type]}</span>
            {item.companyName ? <span className="text-muted-foreground"> · {item.companyName}</span> : null}
          </p>
          {item.type === "status_change" && item.newStatus ? (
            <p className="text-xs text-muted-foreground">
              {item.previousStatus ? `${statusLabels[item.previousStatus] ?? item.previousStatus} → ` : null}
              {statusLabels[item.newStatus] ?? item.newStatus}
            </p>
          ) : null}
          {item.note ? <p className="line-clamp-2 text-xs text-muted-foreground">{item.note}</p> : null}
          <p className="mt-0.5 text-xs text-subtle-foreground">{formatRelative(item.createdAt, now)}</p>
        </li>
      ))}
    </ol>
  );
}
