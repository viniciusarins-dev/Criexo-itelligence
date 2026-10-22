import "server-only";

import { redirect } from "next/navigation";
import { cache } from "react";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Enums } from "@/lib/supabase/types";

export type CurrentMember = {
  id: string;
  email: string | null;
  displayName: string;
  role: Enums<"app_role">;
};

export type SessionState =
  | { status: "anonymous" }
  | { status: "inactive"; email: string | null; displayName: string | null }
  | { status: "active"; member: CurrentMember };

/**
 * Lê a sessão validando o token com o servidor de Auth (getUser) e o perfil
 * no banco. Deduplicado por requisição.
 */
export const getSessionState = cache(async (): Promise<SessionState> => {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { status: "anonymous" };

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("id, display_name, role, is_active")
    .eq("id", user.id)
    .maybeSingle();

  if (error) throw new Error("Não foi possível carregar o perfil do usuário.");
  if (!profile || !profile.is_active) {
    return {
      status: "inactive",
      email: user.email ?? null,
      displayName: profile?.display_name ?? null,
    };
  }

  return {
    status: "active",
    member: {
      id: profile.id,
      email: user.email ?? null,
      displayName: profile.display_name,
      role: profile.role,
    },
  };
});

/** Exige um membro ativo; caso contrário, redireciona. */
export async function requireActiveMember(): Promise<CurrentMember> {
  const state = await getSessionState();
  if (state.status === "anonymous") redirect("/login");
  if (state.status === "inactive") redirect("/acesso-pendente");
  return state.member;
}
