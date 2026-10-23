"use client";

import { Copy, Loader2, Split } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { resolveDuplicate } from "@/app/(app)/empresas/duplicidades/actions";
import { Field } from "@/components/forms/field";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";

type Decision = "same_company" | "different_company";

const COPY: Record<Decision, { label: string; title: string; description: (company: string, candidate: string, fill: number) => string }> = {
  same_company: {
    label: "É a mesma empresa",
    title: "Ligar à empresa cadastrada?",
    description: (company, _candidate, fill) =>
      `O registro da fonte passa a apontar para “${company}”.${fill ? ` ${fill} campo(s) vazio(s) serão completados; nada preenchido é substituído.` : " Nenhum campo será alterado."}`,
  },
  different_company: {
    label: "São empresas diferentes",
    title: "Cadastrar como empresa nova?",
    description: (_company, candidate) => `“${candidate}” entra no cadastro com os dados da fonte. A empresa já cadastrada não muda.`,
  },
};

export function DuplicateDecision({ reviewId, companyName, candidateName, fillCount }: { reviewId: string; companyName: string; candidateName: string; fillCount: number }) {
  const [open, setOpen] = useState<Decision | null>(null);
  const [note, setNote] = useState("");
  const [pending, startTransition] = useTransition();

  function submit(decision: Decision) {
    startTransition(async () => {
      const result = await resolveDuplicate({ reviewId, decision, note });
      if (result.status === "success") {
        toast.success(result.message);
        setOpen(null);
      } else toast.error(result.message);
    });
  }

  return (
    <div className="flex flex-wrap gap-2">
      {(["same_company", "different_company"] as const).map((decision) => (
        <Dialog key={decision} open={open === decision} onOpenChange={(value) => setOpen(value ? decision : null)}>
          <DialogTrigger asChild>
            <Button size="sm" variant={decision === "same_company" ? "primary" : "secondary"} aria-label={`${COPY[decision].label}: ${candidateName}`}>
              {decision === "same_company" ? <Copy aria-hidden="true" /> : <Split aria-hidden="true" />}
              {COPY[decision].label}
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogTitle>{COPY[decision].title}</DialogTitle>
            <DialogDescription>{COPY[decision].description(companyName, candidateName, fillCount)}</DialogDescription>
            <div className="mt-4 space-y-4">
              <Field label="Observação (opcional)" htmlFor={`duplicate-note-${reviewId}-${decision}`}>
                <Textarea id={`duplicate-note-${reviewId}-${decision}`} rows={2} maxLength={2000} value={note} onChange={(event) => setNote(event.target.value)} />
              </Field>
              <div className="flex justify-end gap-2">
                <DialogClose asChild>
                  <Button type="button" variant="ghost">
                    Cancelar
                  </Button>
                </DialogClose>
                <Button type="button" disabled={pending} onClick={() => submit(decision)}>
                  {pending ? <Loader2 aria-hidden="true" className="animate-spin" /> : null}
                  Confirmar
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      ))}
    </div>
  );
}
