"use client";

import { Loader2, Plus } from "lucide-react";
import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";

import { addManualIdea } from "@/app/(app)/produtos/actions";
import { Field, fieldA11y } from "@/components/forms/field";
import { useActionFeedback } from "@/components/forms/use-action-feedback";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { IDLE, pick, type ActionState } from "@/lib/validation/form-data";

function Submit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? <Loader2 aria-hidden="true" className="animate-spin" /> : <Plus aria-hidden="true" />}
      {pending ? "Registrando…" : "Registrar ideia"}
    </Button>
  );
}

function IdeaFields({ state }: { state: ActionState }) {
  const e = state.fieldErrors ?? {};
  const v = state.values;
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Field label="Nome da ideia" htmlFor="idea-name" error={e.name} className="sm:col-span-2">
        <Input {...fieldA11y("idea-name", e.name)} name="name" required maxLength={160} defaultValue={pick(v, "name", "")} />
      </Field>
      <Field label="Problema que resolve" htmlFor="idea-problem" error={e.problemStatement}>
        <Textarea {...fieldA11y("idea-problem", e.problemStatement)} name="problemStatement" rows={2} defaultValue={pick(v, "problemStatement", "")} />
      </Field>
      <Field label="Segmento-alvo" htmlFor="idea-segment" error={e.targetSegment} hint="Usado para encontrar empresas na busca.">
        <Input {...fieldA11y("idea-segment", e.targetSegment, true)} name="targetSegment" maxLength={160} defaultValue={pick(v, "targetSegment", "")} />
      </Field>
      <Field label="Aplicação proposta" htmlFor="idea-application" error={e.proposedApplication}>
        <Textarea {...fieldA11y("idea-application", e.proposedApplication)} name="proposedApplication" rows={2} defaultValue={pick(v, "proposedApplication", "")} />
      </Field>
      <Field label="Benefício esperado" htmlFor="idea-benefit" error={e.expectedBenefit}>
        <Textarea {...fieldA11y("idea-benefit", e.expectedBenefit)} name="expectedBenefit" rows={2} defaultValue={pick(v, "expectedBenefit", "")} />
      </Field>
      <Field label="Dificuldades técnicas" htmlFor="idea-constraints" error={e.technicalConstraints}>
        <Textarea {...fieldA11y("idea-constraints", e.technicalConstraints)} name="technicalConstraints" rows={2} defaultValue={pick(v, "technicalConstraints", "")} />
      </Field>
      <Field label="Informações que faltam" htmlFor="idea-missing" error={e.missingInformation}>
        <Textarea {...fieldA11y("idea-missing", e.missingInformation)} name="missingInformation" rows={2} defaultValue={pick(v, "missingInformation", "")} />
      </Field>
      <Field label="Descrição (opcional)" htmlFor="idea-description" error={e.description} className="sm:col-span-2">
        <Textarea {...fieldA11y("idea-description", e.description)} name="description" rows={2} defaultValue={pick(v, "description", "")} />
      </Field>
      <Field
        label="Premissas (uma por linha)"
        htmlFor="idea-evidence"
        error={e.evidenceLines}
        hint="Ficam registradas como “declaradas por você”, não como fatos confirmados."
        className="sm:col-span-2"
      >
        <Textarea {...fieldA11y("idea-evidence", e.evidenceLines, true)} name="evidenceLines" rows={3} defaultValue={pick(v, "evidenceLines", "")} />
      </Field>
    </div>
  );
}

/** Página "Nova ideia": ao registrar, vai para a ideia criada. */
export function ManualIdeaForm() {
  const [state, action] = useActionState<ActionState, FormData>(addManualIdea, IDLE);
  useActionFeedback(state);
  return (
    <form action={action} className="space-y-6" noValidate>
      <IdeaFields state={state} />
      <Submit />
    </form>
  );
}

/** Ideia manual dentro de uma pesquisa, em uma janela. */
export function ManualIdeaDialog({ researchSessionId }: { researchSessionId: string }) {
  const [open, setOpen] = useState(false);
  const [formKey, setFormKey] = useState(0);
  const [state, action] = useActionState<ActionState, FormData>(async (previous, formData) => {
    const result = await addManualIdea(previous, formData);
    if (result.status === "success") {
      setOpen(false);
      setFormKey((key) => key + 1);
    }
    return result;
  }, IDLE);
  useActionFeedback(state);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="secondary">
          <Plus aria-hidden="true" />
          Adicionar ideia manual
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogTitle>Nova ideia de produto</DialogTitle>
        <DialogDescription>A ideia entra como “aguardando decisão” e precisa ser aprovada antes da busca.</DialogDescription>
        <form key={formKey} action={action} className="mt-4 space-y-6" noValidate>
          <input type="hidden" name="researchSessionId" value={researchSessionId} />
          <IdeaFields state={state.status === "success" ? IDLE : state} />
          <Submit />
        </form>
      </DialogContent>
    </Dialog>
  );
}
