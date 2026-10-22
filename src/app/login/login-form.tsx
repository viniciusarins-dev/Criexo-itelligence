"use client";

import { Loader2, LogIn } from "lucide-react";
import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { signIn, type SignInState } from "./actions";

export function LoginForm({ next }: { next?: string }) {
  const [state, formAction, pending] = useActionState<SignInState, FormData>(signIn, {});

  return (
    <form action={formAction} className="space-y-5" noValidate>
      {next ? <input type="hidden" name="next" value={next} /> : null}

      <div className="space-y-2">
        <Label htmlFor="email">E-mail</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          defaultValue={state.email}
          aria-invalid={state.fieldErrors?.email ? true : undefined}
          aria-describedby={state.fieldErrors?.email ? "email-error" : undefined}
        />
        {state.fieldErrors?.email ? (
          <p id="email-error" className="text-xs text-danger-text">
            {state.fieldErrors.email}
          </p>
        ) : null}
      </div>

      <div className="space-y-2">
        <Label htmlFor="password">Senha</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          aria-invalid={state.fieldErrors?.password ? true : undefined}
          aria-describedby={state.fieldErrors?.password ? "password-error" : undefined}
        />
        {state.fieldErrors?.password ? (
          <p id="password-error" className="text-xs text-danger-text">
            {state.fieldErrors.password}
          </p>
        ) : null}
      </div>

      {state.error ? (
        <p role="alert" className="rounded-md border border-danger/35 bg-danger-subtle px-3 py-2 text-sm text-danger-text">
          {state.error}
        </p>
      ) : null}

      <Button type="submit" size="lg" className="w-full" disabled={pending}>
        {pending ? <Loader2 aria-hidden="true" className="animate-spin" /> : <LogIn aria-hidden="true" />}
        {pending ? "Entrando…" : "Entrar"}
      </Button>
    </form>
  );
}
