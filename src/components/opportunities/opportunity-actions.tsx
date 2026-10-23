"use client";

import { Bookmark, BookmarkCheck, Loader2, Phone, RefreshCw, StickyNote, Trash2 } from "lucide-react";
import { useActionState, useState, useTransition } from "react";
import { useFormStatus } from "react-dom";
import { toast } from "sonner";

import { addActivity, changeStatus, recalculateScore, setSaved } from "@/app/(app)/oportunidades/actions";
import { Field, fieldA11y } from "@/components/forms/field";
import { useActionFeedback } from "@/components/forms/use-action-feedback";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { NativeSelect } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { contactedStatus, discardStatus, type CommercialStatus } from "@/domain/opportunities/opportunity";
import { IDLE, pick, type ActionState } from "@/lib/validation/form-data";
import { cn } from "@/lib/utils";

function Submit({ label, pendingLabel, variant = "primary" }: { label: string; pendingLabel: string; variant?: "primary" | "secondary" | "danger" }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant={variant} disabled={pending}>
      {pending ? <Loader2 aria-hidden="true" className="animate-spin" /> : null}
      {pending ? pendingLabel : label}
    </Button>
  );
}

export function SaveToggle({ opportunityId, isSaved }: { opportunityId: string; isSaved: boolean }) {
  const [pending, startTransition] = useTransition();
  return (
    <Button
      variant={isSaved ? "secondary" : "primary"}
      disabled={pending}
      aria-pressed={isSaved}
      onClick={() =>
        startTransition(async () => {
          const result = await setSaved({ opportunityId, saved: !isSaved });
          if (result.status === "success") toast.success(result.message);
          else toast.error(result.message ?? "Não foi possível salvar.");
        })
      }
    >
      {pending ? <Loader2 aria-hidden="true" className="animate-spin" /> : isSaved ? <BookmarkCheck aria-hidden="true" /> : <Bookmark aria-hidden="true" />}
      {isSaved ? "Salva" : "Salvar oportunidade"}
    </Button>
  );
}

export function StatusForm({
  opportunityId,
  current,
  statuses,
}: {
  opportunityId: string;
  current: string;
  statuses: CommercialStatus[];
}) {
  const [state, action] = useActionState<ActionState, FormData>(changeStatus, IDLE);
  useActionFeedback(state);
  const options = statuses.filter((status) => status.key !== current && status.category !== "lost");
  const e = state.fieldErrors ?? {};

  return (
    <form action={action} className="space-y-4" noValidate>
      <input type="hidden" name="opportunityId" value={opportunityId} />
      <Field label="Novo status" htmlFor="status" error={e.status}>
        <NativeSelect {...fieldA11y("status", e.status)} name="status" defaultValue={pick(state.values, "status", options[0]?.key)}>
          {options.map((status) => (
            <option key={status.key} value={status.key}>
              {status.label}
            </option>
          ))}
        </NativeSelect>
      </Field>
      <Field label="Observação (opcional)" htmlFor="status-note" error={e.note}>
        <Textarea {...fieldA11y("status-note", e.note)} name="note" rows={2} defaultValue={pick(state.values, "note", "")} />
      </Field>
      <Submit label="Mudar status" pendingLabel="Alterando…" variant="secondary" />
    </form>
  );
}

export function ActivityForm({
  opportunityId,
  currentStatus,
  statuses,
}: {
  opportunityId: string;
  currentStatus: string;
  statuses: CommercialStatus[];
}) {
  const [state, action] = useActionState<ActionState, FormData>(addActivity, IDLE);
  useActionFeedback(state);
  const [kind, setKind] = useState<"note" | "contact">("note");
  const contacted = contactedStatus(statuses);
  const e = state.fieldErrors ?? {};

  return (
    <form action={action} className="space-y-4" noValidate>
      <input type="hidden" name="opportunityId" value={opportunityId} />
      <input type="hidden" name="kind" value={kind} />
      <div role="radiogroup" aria-label="Tipo de registro" className="inline-flex rounded-md border border-border bg-surface-sunken p-0.5">
        {(
          [
            ["note", "Observação", StickyNote],
            ["contact", "Contato realizado", Phone],
          ] as const
        ).map(([value, label, Icon]) => (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={kind === value}
            onClick={() => setKind(value)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded px-3 py-1.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring",
              kind === value ? "bg-surface-raised font-medium text-foreground" : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Icon aria-hidden="true" className="size-4" />
            {label}
          </button>
        ))}
      </div>
      <Field
        label={kind === "contact" ? "Como foi o contato?" : "Observação"}
        htmlFor="activity-note"
        error={e.note}
        hint={kind === "contact" ? "Ex.: ligação, visita, mensagem — e o que foi conversado." : undefined}
      >
        <Textarea {...fieldA11y("activity-note", e.note, kind === "contact")} name="note" rows={3} defaultValue={pick(state.values, "note", "")} />
      </Field>
      {kind === "contact" && contacted && currentStatus !== contacted.key ? (
        <Checkbox id="markContacted" name="markContacted" label={`Mover para “${contacted.label}”`} />
      ) : null}
      <Submit label="Registrar" pendingLabel="Registrando…" />
    </form>
  );
}

export function DiscardButton({ opportunityId, statuses, companyName }: { opportunityId: string; statuses: CommercialStatus[]; companyName: string }) {
  const [open, setOpen] = useState(false);
  const [state, action] = useActionState<ActionState, FormData>(async (previous, formData) => {
    const result = await changeStatus(previous, formData);
    if (result.status === "success") setOpen(false);
    return result;
  }, IDLE);
  useActionFeedback(state);
  const discard = discardStatus(statuses);
  if (!discard) return null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" className="text-danger-text hover:text-danger-text">
          <Trash2 aria-hidden="true" />
          Descartar
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogTitle>Descartar oportunidade?</DialogTitle>
        <DialogDescription>
          A oportunidade com {companyName} vai para “{discard.label}”. Ela continua no histórico e pode ser reaberta
          mudando o status.
        </DialogDescription>
        <form action={action} className="mt-4 space-y-4" noValidate>
          <input type="hidden" name="opportunityId" value={opportunityId} />
          <input type="hidden" name="status" value={discard.key} />
          <Field label="Motivo (opcional)" htmlFor="discard-note">
            <Textarea id="discard-note" name="note" rows={2} />
          </Field>
          <div className="flex justify-end gap-2">
            <DialogClose asChild>
              <Button type="button" variant="ghost">
                Cancelar
              </Button>
            </DialogClose>
            <Submit label="Descartar" pendingLabel="Descartando…" variant="danger" />
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Recalcula com a localização e a região atuais; a avaliação anterior dos demais critérios é mantida. */
export function RecalculateScoreButton({ opportunityId }: { opportunityId: string }) {
  const [pending, startTransition] = useTransition();
  return (
    <Button
      size="sm"
      variant="secondary"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const result = await recalculateScore({ opportunityId });
          if (result.status === "success") toast.success(result.message);
          else toast.error(result.message ?? "Não foi possível recalcular.");
        })
      }
    >
      {pending ? <Loader2 aria-hidden="true" className="animate-spin" /> : <RefreshCw aria-hidden="true" />}
      Recalcular
    </Button>
  );
}
