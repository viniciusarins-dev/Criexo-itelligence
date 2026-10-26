"use client";

import { KeyRound, Loader2 } from "lucide-react";
import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { createFirstAccess, type FirstAccessState } from "./actions";

const FIELDS = [
  { name: "email", label: "E-mail liberado", type: "email", autoComplete: "email", hint: null },
  { name: "password", label: "Nova senha", type: "password", autoComplete: "new-password", hint: "Pelo menos 10 caracteres, com letras e números." },
  { name: "confirmPassword", label: "Repita a senha", type: "password", autoComplete: "new-password", hint: null },
] as const;

export function FirstAccessForm() {
  const [state, formAction, pending] = useActionState<FirstAccessState, FormData>(createFirstAccess, {});

  return (
    <form action={formAction} className="space-y-5" noValidate>
      {FIELDS.map((field) => {
        const error = state.fieldErrors?.[field.name];
        const describedBy = error ? `${field.name}-error` : field.hint ? `${field.name}-hint` : undefined;
        return (
          <div key={field.name} className="space-y-2">
            <Label htmlFor={field.name}>{field.label}</Label>
            <Input
              id={field.name}
              name={field.name}
              type={field.type}
              autoComplete={field.autoComplete}
              required
              defaultValue={field.name === "email" ? state.email : undefined}
              aria-invalid={error ? true : undefined}
              aria-describedby={describedBy}
            />
            {error ? (
              <p id={`${field.name}-error`} className="text-xs text-danger-text">
                {error}
              </p>
            ) : field.hint ? (
              <p id={`${field.name}-hint`} className="text-xs text-muted-foreground">
                {field.hint}
              </p>
            ) : null}
          </div>
        );
      })}

      {state.error ? (
        <p role="alert" className="rounded-md border border-danger/35 bg-danger-subtle px-3 py-2 text-sm text-danger-text">
          {state.error}
        </p>
      ) : null}
      {state.notice ? (
        <p role="status" className="rounded-md border border-info/30 bg-info-subtle px-3 py-2 text-sm text-info-text">
          {state.notice}
        </p>
      ) : null}

      <Button type="submit" size="lg" className="w-full" disabled={pending}>
        {pending ? <Loader2 aria-hidden="true" className="animate-spin" /> : <KeyRound aria-hidden="true" />}
        {pending ? "Criando…" : "Criar senha e entrar"}
      </Button>
    </form>
  );
}
