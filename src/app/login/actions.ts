"use server";

import { redirect } from "next/navigation";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { safeRedirectPath, signInSchema } from "@/lib/validation/auth";

export type SignInState = {
  error?: string;
  fieldErrors?: Partial<Record<"email" | "password", string>>;
  email?: string;
};

export async function signIn(_previous: SignInState, formData: FormData): Promise<SignInState> {
  const parsed = signInSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  const email = typeof formData.get("email") === "string" ? String(formData.get("email")) : "";

  if (!parsed.success) {
    const fieldErrors: SignInState["fieldErrors"] = {};
    for (const issue of parsed.error.issues) {
      const field = issue.path[0];
      if ((field === "email" || field === "password") && !fieldErrors[field]) fieldErrors[field] = issue.message;
    }
    return { fieldErrors, email };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);

  if (error) {
    // Mensagem genérica: não revela se o e-mail existe.
    const rateLimited = error.status === 429;
    return {
      email,
      error: rateLimited
        ? "Muitas tentativas. Aguarde alguns minutos e tente novamente."
        : "E-mail ou senha incorretos.",
    };
  }

  redirect(safeRedirectPath(formData.get("next")));
}
