import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export function StatTile({
  label,
  value,
  hint,
  icon: Icon,
  accent = false,
}: {
  label: string;
  /** `null` = valor indisponível (ex.: configuração pendente), nunca um número inventado. */
  value: number | null;
  hint: ReactNode;
  icon: LucideIcon;
  accent?: boolean;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        <Icon aria-hidden="true" className={cn("size-4", accent ? "text-primary" : "text-subtle-foreground")} />
      </div>
      <p className="text-3xl font-semibold tracking-tight text-foreground">
        {value === null ? <span className="text-subtle-foreground">—</span> : value.toLocaleString("pt-BR")}
      </p>
      <p className="text-xs text-subtle-foreground">{hint}</p>
    </div>
  );
}
