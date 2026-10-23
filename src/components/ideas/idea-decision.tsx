"use client";

import { Check, Loader2, X } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { decideIdea } from "@/app/(app)/produtos/actions";
import { Field } from "@/components/forms/field";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";

type Decision = "approved" | "rejected";

/** RN-03: aprovação individual. Cada decisão (inclusive a revisão de uma anterior) entra no histórico. */
export function IdeaDecision({
  ideaId,
  ideaName,
  status,
}: {
  ideaId: string;
  ideaName: string;
  status: "pending" | "approved" | "rejected";
}) {
  const [open, setOpen] = useState<Decision | null>(null);
  const [note, setNote] = useState("");
  const [pending, startTransition] = useTransition();
  const options: Decision[] = status === "pending" ? ["approved", "rejected"] : [status === "approved" ? "rejected" : "approved"];

  function submit(decision: Decision) {
    startTransition(async () => {
      const result = await decideIdea({ ideaId, decision, note });
      if (result.status === "success") {
        toast.success(result.message);
        setOpen(null);
        setNote("");
      } else toast.error(result.message ?? "Não foi possível registrar a decisão.");
    });
  }

  return (
    <div className="flex flex-wrap gap-2">
      {options.map((decision) => {
        const approve = decision === "approved";
        const label = status === "pending" ? (approve ? "Aprovar" : "Rejeitar") : approve ? "Aprovar mesmo assim" : "Rejeitar agora";
        return (
          <Dialog key={decision} open={open === decision} onOpenChange={(value) => setOpen(value ? decision : null)}>
            <DialogTrigger asChild>
              <Button size="sm" variant={approve && status === "pending" ? "primary" : "secondary"} aria-label={`${label}: ${ideaName}`}>
                {approve ? <Check aria-hidden="true" /> : <X aria-hidden="true" />}
                {label}
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogTitle>{approve ? "Aprovar ideia?" : "Rejeitar ideia?"}</DialogTitle>
              <DialogDescription>
                {approve
                  ? `“${ideaName}” poderá ser usada na busca de empresas.`
                  : `“${ideaName}” não será usada na busca. A decisão fica no histórico e pode ser revista.`}
              </DialogDescription>
              <div className="mt-4 space-y-4">
                <Field label="Observação (opcional)" htmlFor={`decision-note-${ideaId}`}>
                  <Textarea id={`decision-note-${ideaId}`} rows={2} value={note} onChange={(event) => setNote(event.target.value)} maxLength={2000} />
                </Field>
                <div className="flex justify-end gap-2">
                  <DialogClose asChild>
                    <Button type="button" variant="ghost">
                      Cancelar
                    </Button>
                  </DialogClose>
                  <Button type="button" variant={approve ? "primary" : "danger"} disabled={pending} onClick={() => submit(decision)}>
                    {pending ? <Loader2 aria-hidden="true" className="animate-spin" /> : null}
                    {approve ? "Aprovar" : "Rejeitar"}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        );
      })}
    </div>
  );
}
