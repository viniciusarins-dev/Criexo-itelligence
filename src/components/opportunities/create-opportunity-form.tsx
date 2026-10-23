"use client";

import { useActionState } from "react";

import { createOpportunity } from "@/app/(app)/oportunidades/actions";
import { useActionFeedback } from "@/components/forms/use-action-feedback";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/select";
import { IDLE, type ActionState } from "@/lib/validation/form-data";

import { SubmitButton } from "../companies/submit-button";

export function CreateOpportunityForm({ companyId, ideas }: { companyId: string; ideas: { id: string; name: string }[] }) {
  const [state, action] = useActionState<ActionState, FormData>(createOpportunity, IDLE);
  useActionFeedback(state);

  return (
    <form action={action} className="flex flex-col gap-3 sm:flex-row sm:items-end" noValidate>
      <input type="hidden" name="companyId" value={companyId} />
      <div className="min-w-0 flex-1 space-y-2">
        <Label htmlFor="productIdeaId">Produto aprovado</Label>
        <NativeSelect id="productIdeaId" name="productIdeaId" defaultValue="">
          <option value="">Sem produto definido</option>
          {ideas.map((idea) => (
            <option key={idea.id} value={idea.id}>
              {idea.name}
            </option>
          ))}
        </NativeSelect>
      </div>
      <SubmitButton label="Criar oportunidade" />
    </form>
  );
}
