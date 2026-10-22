import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import { readPublicEnv } from "@/lib/env";

import type { Database } from "./database.types";

export class SupabaseNotConfiguredError extends Error {
  constructor(public readonly missing: string[]) {
    super(`Supabase não configurado: ${missing.join(", ")}`);
    this.name = "SupabaseNotConfiguredError";
  }
}

/** Cliente com a sessão do usuário: todas as consultas respeitam RLS. */
export async function createSupabaseServerClient() {
  const result = readPublicEnv();
  if (!result.ok) throw new SupabaseNotConfiguredError(result.missing);

  const cookieStore = await cookies();
  return createServerClient<Database>(
    result.env.NEXT_PUBLIC_SUPABASE_URL,
    result.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Chamado a partir de um Server Component, onde cookies são
            // somente leitura. O proxy já renova a sessão a cada requisição.
          }
        },
      },
    },
  );
}
