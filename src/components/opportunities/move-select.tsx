"use client";

import { useTransition } from "react";
import { toast } from "sonner";

import { moveOpportunity } from "@/app/(app)/oportunidades/actions";
import type { CommercialStatus } from "@/domain/opportunities/opportunity";

/** Troca rápida de status nos cartões do pipeline (acessível por teclado, sem arrastar). */
export function MoveSelect({
  opportunityId,
  companyName,
  current,
  statuses,
}: {
  opportunityId: string;
  companyName: string;
  current: string;
  statuses: CommercialStatus[];
}) {
  const [pending, startTransition] = useTransition();
  const id = `mover-${opportunityId}`;
  return (
    <div>
      <label htmlFor={id} className="sr-only">
        Mover {companyName} para outro status
      </label>
      <select
        id={id}
        value=""
        disabled={pending}
        onChange={(event) => {
          const status = event.target.value;
          if (!status) return;
          startTransition(async () => {
            const result = await moveOpportunity({ opportunityId, status });
            if (result.status === "success") toast.success(result.message);
            else toast.error(result.message ?? "Não foi possível mudar o status.");
          });
        }}
        className="h-8 w-full rounded-md border border-input bg-surface-sunken px-2 text-xs text-muted-foreground outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/25 disabled:opacity-50"
      >
        <option value="">{pending ? "Movendo…" : "Mover para…"}</option>
        {statuses
          .filter((status) => status.key !== current)
          .map((status) => (
            <option key={status.key} value={status.key}>
              {status.label}
            </option>
          ))}
      </select>
    </div>
  );
}
