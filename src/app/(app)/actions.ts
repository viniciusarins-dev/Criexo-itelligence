"use server";

import { redirect } from "next/navigation";

import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function signOut(): Promise<{ error: string } | void> {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signOut();
  if (error) return { error: "Não foi possível encerrar a sessão. Tente novamente." };
  redirect("/login");
}
