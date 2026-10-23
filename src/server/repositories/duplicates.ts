import "server-only";

import { z } from "zod";

import { compareDuplicate, type ComparableCompany } from "@/domain/companies/duplicates";
import { DUPLICATE_REASON_LABELS, type DuplicateReason } from "@/domain/companies/company";
import { requireActiveMember } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Enums } from "@/lib/supabase/types";

export class DuplicateLoadError extends Error {
  constructor(cause: unknown) {
    super("Falha ao carregar as revisões de duplicidade", { cause });
    this.name = "DuplicateLoadError";
  }
}

const candidateSchema = z
  .object({
    name: z.string().nullable().optional(),
    segment: z.string().nullable().optional(),
    website: z.string().nullable().optional(),
    phone_normalized: z.string().nullable().optional(),
    address: z.string().nullable().optional(),
    neighborhood: z.string().nullable().optional(),
    city: z.string().nullable().optional(),
    state: z.string().nullable().optional(),
    postal_code: z.string().nullable().optional(),
    latitude: z.number().nullable().optional(),
    longitude: z.number().nullable().optional(),
  })
  .passthrough();

const COMPANY_FIELDS = "id, name, segment, website, phone_normalized, address, neighborhood, city, state, postal_code, latitude, longitude";

export async function countPendingDuplicates(): Promise<number> {
  await requireActiveMember();
  const supabase = await createSupabaseServerClient();
  const { count, error } = await supabase.from("duplicate_reviews").select("id", { count: "exact", head: true }).eq("status", "pending");
  if (error) throw new DuplicateLoadError(error);
  return count ?? 0;
}

export async function listDuplicateReviews(status: Enums<"duplicate_review_status"> | "decided") {
  await requireActiveMember();
  const supabase = await createSupabaseServerClient();
  let query = supabase
    .from("duplicate_reviews")
    .select(`id, source_name, source_url, candidate, reasons, status, decided_by, decided_at, decision_note, created_at, resolved_company_id, research_session_id, company:companies!duplicate_reviews_company_id_fkey(${COMPANY_FIELDS})`)
    .order(status === "pending" ? "created_at" : "decided_at", { ascending: status === "pending" })
    .limit(100);
  query = status === "decided" ? query.neq("status", "pending") : query.eq("status", status);
  const [reviews, profiles] = await Promise.all([query, supabase.from("profiles").select("id, display_name")]);
  if (reviews.error) throw new DuplicateLoadError(reviews.error);
  if (profiles.error) throw new DuplicateLoadError(profiles.error);
  const names = new Map(profiles.data.map((row) => [row.id, row.display_name]));

  return reviews.data.map((row) => {
    const candidate = candidateSchema.safeParse(row.candidate);
    const data: Partial<ComparableCompany> = candidate.success ? candidate.data : {};
    return {
      id: row.id,
      source: row.source_name,
      sourceUrl: row.source_url,
      candidateName: data.name ?? "Sem nome",
      reasons: row.reasons.map((reason) => DUPLICATE_REASON_LABELS[reason as DuplicateReason] ?? reason),
      status: row.status,
      decidedBy: row.decided_by ? (names.get(row.decided_by) ?? null) : null,
      decidedAt: row.decided_at,
      note: row.decision_note,
      createdAt: row.created_at,
      resolvedCompanyId: row.resolved_company_id,
      researchSessionId: row.research_session_id,
      company: { id: row.company.id, name: row.company.name },
      comparison: compareDuplicate(row.company, data),
    };
  });
}

export type DuplicateReviewView = Awaited<ReturnType<typeof listDuplicateReviews>>[number];
