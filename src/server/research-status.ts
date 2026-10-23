import "server-only";

import { preSearchStatus, type ResearchStatus } from "@/domain/research/research";
import type { createSupabaseServerClient } from "@/lib/supabase/server";
import { ideaSessionIds } from "@/server/repositories/research";

type Client = Awaited<ReturnType<typeof createSupabaseServerClient>>;

/** Recalcula a situação de uma pesquisa (antes da busca) a partir das decisões sobre as ideias. */
export async function syncResearchStatus(supabase: Client, sessionId: string): Promise<void> {
  const session = await supabase.from("research_sessions").select("id, status, rerun_of").eq("id", sessionId).maybeSingle();
  if (session.error || !session.data) return;
  const ideas = await supabase.from("product_ideas").select("approval_status").in("research_session_id", ideaSessionIds(session.data));
  if (ideas.error) return;
  const next = preSearchStatus(session.data.status as ResearchStatus, ideas.data.map((idea) => idea.approval_status));
  if (next !== session.data.status) {
    await supabase.from("research_sessions").update({ status: next }).eq("id", sessionId);
  }
}
