"use client";

import { Loader2, Radar } from "lucide-react";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { createResearch } from "@/app/(app)/prospeccao/actions";
import { Field, fieldA11y } from "@/components/forms/field";
import { useActionFeedback } from "@/components/forms/use-action-feedback";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { RESEARCH_TYPES } from "@/domain/research/types";
import { IDLE, pick, type ActionState } from "@/lib/validation/form-data";
import { cn } from "@/lib/utils";

const TYPE_HELP: Record<(typeof RESEARCH_TYPES)[number], { label: string; hint: string; placeholder: string }> = {
  segment: {
    label: "Por segmento",
    hint: "Parta de um tipo de empresa e descubra produtos para ela.",
    placeholder: "Ex.: clínicas odontológicas, oficinas mecânicas",
  },
  product: {
    label: "Por produto",
    hint: "Parta de um produto e descubra quem poderia comprá-lo.",
    placeholder: "Ex.: suporte de celular para balcão",
  },
};

function Submit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? <Loader2 aria-hidden="true" className="animate-spin" /> : <Radar aria-hidden="true" />}
      {pending ? "Criando…" : "Criar pesquisa"}
    </Button>
  );
}

export function ResearchForm() {
  const [state, action] = useActionState<ActionState, FormData>(createResearch, IDLE);
  useActionFeedback(state);
  const e = state.fieldErrors ?? {};
  const type = pick(state.values, "researchType", "segment");

  return (
    <form action={action} className="space-y-6" noValidate>
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">Tipo de pesquisa</legend>
        <div className="grid gap-3 sm:grid-cols-2">
          {RESEARCH_TYPES.map((value) => (
            <label
              key={value}
              className={cn(
                "flex cursor-pointer gap-3 rounded-lg border border-border bg-surface-sunken p-4 hover:border-border-strong",
                "has-checked:border-primary has-checked:bg-primary-subtle has-focus-visible:ring-2 has-focus-visible:ring-ring",
              )}
            >
              <input type="radio" name="researchType" value={value} defaultChecked={type === value} className="mt-1 accent-primary" />
              <span className="space-y-1">
                <span className="block text-sm font-medium">{TYPE_HELP[value].label}</span>
                <span className="block text-xs text-muted-foreground">{TYPE_HELP[value].hint}</span>
              </span>
            </label>
          ))}
        </div>
        {e.researchType ? <p className="text-xs text-danger-text">{e.researchType}</p> : null}
      </fieldset>

      <Field label="Segmento ou produto" htmlFor="query" error={e.query} hint="Também é usado como termo de busca nas empresas.">
        <Input
          {...fieldA11y("query", e.query, true)}
          name="query"
          required
          maxLength={200}
          placeholder={`${TYPE_HELP.segment.placeholder} · ${TYPE_HELP.product.placeholder}`}
          defaultValue={pick(state.values, "query", "")}
        />
      </Field>

      <Field label="Objetivo (opcional)" htmlFor="objective" error={e.objective} hint="O que você espera desta pesquisa. Ajuda a IA a sugerir ideias.">
        <Textarea {...fieldA11y("objective", e.objective, true)} name="objective" rows={3} maxLength={2000} defaultValue={pick(state.values, "objective", "")} />
      </Field>

      <Submit />
    </form>
  );
}
