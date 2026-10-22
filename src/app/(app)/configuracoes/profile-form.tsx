"use client";

import { useActionState } from "react";

import { Field, fieldA11y } from "@/components/forms/field";
import { useActionFeedback } from "@/components/forms/use-action-feedback";
import { Input } from "@/components/ui/input";
import { IDLE, pick, type ActionState } from "@/lib/validation/form-data";

import { updateDisplayName } from "./actions";
import { SaveButton } from "./save-button";

export function ProfileForm({ displayName, email }: { displayName: string; email: string | null }) {
  const [state, action] = useActionState<ActionState, FormData>(updateDisplayName, IDLE);
  useActionFeedback(state);
  const error = state.fieldErrors?.displayName;

  return (
    <form action={action} className="grid gap-5 md:grid-cols-2" noValidate>
      <Field label="Nome de exibição" htmlFor="displayName" error={error}>
        <Input {...fieldA11y("displayName", error)} name="displayName" defaultValue={pick(state.values, "displayName", displayName)} autoComplete="name" />
      </Field>
      <Field label="E-mail" htmlFor="email" hint="Alterado apenas pelo painel do Supabase.">
        <Input {...fieldA11y("email", undefined, true)} value={email ?? ""} readOnly disabled />
      </Field>
      <div className="md:col-span-2">
        <SaveButton label="Salvar nome" />
      </div>
    </form>
  );
}
