"use server";

import { redirect } from "next/navigation";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { firstAccessErrorMessage, firstAccessSchema } from "@/lib/validation/auth";

export type FirstAccessState = {
  error?: string;
  notice?: string;
  fieldErrors?: Partial<Record<"email" | "password" | "confirmPassword", string>>;
  email?: string;
};

/**
 * Cria a conta de um e-mail liberado com a senha escolhida. A lista de
 * liberados e o "uso único" são garantidos pelo banco (authorized_emails).
 */
export async function createFirstAccess(_previous: FirstAccessState, formData: FormData): Promise<FirstAccessState> {
  const email = typeof formData.get("email") === "string" ? String(formData.get("email")) : "";
  const parsed = firstAccessSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
  });
  if (!parsed.success) {
    const fieldErrors: FirstAccessState["fieldErrors"] = {};
    for (const issue of parsed.error.issues) {
      const field = issue.path[0];
      if ((field === "email" || field === "password" || field === "confirmPassword") && !fieldErrors[field]) fieldErrors[field] = issue.message;
    }
    return { fieldErrors, email };
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signUp({ email: parsed.data.email, password: parsed.data.password });
  if (error) {
    // Só o código vai para o log do servidor; nunca e-mail ou senha.
    console.error("Falha no primeiro acesso", { code: error.code ?? null, status: error.status ?? null });
    return { email, error: firstAccessErrorMessage(error) };
  }
  if (!data.session) {
    // Confirmação de e-mail ligada no Supabase: a conta existe, mas só entra depois do link.
    return {
      email,
      notice: "Senha criada. Abra o link enviado para o seu e-mail para confirmar e depois entre pela tela de login.",
    };
  }
  redirect("/dashboard");
}
