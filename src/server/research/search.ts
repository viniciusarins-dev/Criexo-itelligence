import "server-only";

import { findDuplicateCandidates, DUPLICATE_REASON_LABELS, type ExistingCompanyKeys, type ProvenanceMap } from "@/domain/companies/company";
import { buildAssessmentPrompt } from "@/domain/research/prompt";
import { canSearch, mergeCandidates, rankInternalMatches, searchOutcome, searchTerms } from "@/domain/research/research";
import {
  assessmentResponseSchema,
  evaluateProximity,
  haversineDistanceKm,
  MAX_ASSESSMENT_PAIRS,
  opportunityCriteria,
  type AssessmentAvailability,
  type GeoPoint,
  type OpportunityAssessment,
} from "@/domain/scoring";
import { matchOsmCandidates, OSM_ATTRIBUTION, OSM_SOURCE_NAME, osmDailyLimit, type OsmMatch } from "@/domain/sources/osm";
import type { InformationStatus } from "@/domain/types/information";
import type { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Json } from "@/lib/supabase/types";
import { readAiConfig } from "@/server/ai/config";
import { generateJsonWithGemini } from "@/server/ai/gemini";
import { fetchOsmCandidates } from "@/server/integrations/overpass";
import { ideaSessionIds, parseSnapshot, startOfDayInSaoPaulo } from "@/server/repositories/research";
import { activeScoringConfig, scoreOpportunity } from "@/server/scoring";

type Client = Awaited<ReturnType<typeof createSupabaseServerClient>>;

/** Fonte sempre disponível: as empresas já cadastradas no sistema. */
export const INTERNAL_SOURCE = "Base interna";

export type SearchSummary = { found: number; imported: number; scored: number; failedSources: string[]; aiNote: string | null };

export class SearchError extends Error {}

type Candidate = {
  key: string;
  source: string;
  strength: number;
  distanceKm: number | null;
  name: string;
  reason: string;
  companyId: string | null;
  osm: OsmMatch | null;
  possibleDuplicateUrl: string | null;
};

type Run = { id: string; source: string };

async function startRun(supabase: Client, sessionId: string, source: string): Promise<Run> {
  const run = await supabase
    .from("research_source_runs")
    .insert({ research_session_id: sessionId, source_name: source, status: "running", started_at: new Date().toISOString() })
    .select("id")
    .single();
  if (run.error) throw run.error;
  return { id: run.data.id, source };
}

async function finishRun(
  supabase: Client,
  run: Run,
  status: "succeeded" | "failed" | "skipped" | "rate_limited",
  details: { results?: number; error?: string; metadata?: Record<string, unknown> } = {},
) {
  await supabase
    .from("research_source_runs")
    .update({
      status,
      finished_at: new Date().toISOString(),
      results_count: details.results ?? null,
      error_message: details.error ?? null,
      request_metadata: (details.metadata ?? {}) as unknown as NonNullable<Json>,
    })
    .eq("id", run.id);
}

function provenanceFromOsm(match: OsmMatch, observedAt: string): ProvenanceMap {
  const provenance: ProvenanceMap = {};
  const declared = { status: "source_declared" as InformationStatus, source: OSM_SOURCE_NAME, observedAt };
  for (const field of ["name", "segment", "website", "phone", "address", "neighborhood", "city", "state", "postalCode"] as const) {
    if (match[field]) provenance[field] = declared;
  }
  provenance.location = declared;
  return provenance;
}

/**
 * Executa a busca de uma pesquisa pronta: consulta as fontes, junta os
 * resultados (5 a 10 empresas, sem completar com irrelevantes), cria ou
 * reaproveita oportunidades e calcula a pontuação de cada uma.
 * Falha de uma fonte não apaga nada e é registrada na própria execução.
 */
export async function executeSearch(supabase: Client, memberId: string, sessionId: string): Promise<SearchSummary> {
  const session = await supabase
    .from("research_sessions")
    .select("id, query, status, rerun_of, configuration_snapshot, reference_latitude, reference_longitude, radius_km")
    .eq("id", sessionId)
    .maybeSingle();
  if (session.error || !session.data) throw new SearchError("Pesquisa não encontrada.");
  if (session.data.status !== "ready") throw new SearchError("A busca só pode começar com todas as ideias decididas e ao menos uma aprovada.");

  const ideas = await supabase
    .from("product_ideas")
    .select("id, name, approval_status, target_segment, problem_statement, proposed_application, technical_constraints")
    .in("research_session_id", ideaSessionIds(session.data));
  if (ideas.error) throw new SearchError("Não foi possível ler as ideias da pesquisa.");
  if (!canSearch(ideas.data.map((idea) => idea.approval_status))) throw new SearchError("Decida todas as ideias e aprove ao menos uma antes de buscar.");
  const approved = ideas.data.filter((idea) => idea.approval_status === "approved");

  const snapshot = parseSnapshot(session.data.configuration_snapshot);
  const reference: GeoPoint | null =
    session.data.reference_latitude !== null && session.data.reference_longitude !== null
      ? { latitude: Number(session.data.reference_latitude), longitude: Number(session.data.reference_longitude) }
      : null;
  const radiusKm = session.data.radius_km === null ? null : Number(session.data.radius_km);
  const distanceTo = (point: GeoPoint | null) => (reference && point ? Math.round(haversineDistanceKm(reference, point) * 100) / 100 : null);
  const terms = searchTerms(session.data.query, approved.map((idea) => idea.target_segment));
  const observedAt = new Date().toISOString();

  await supabase.from("research_sessions").update({ status: "running", started_at: observedAt, error_message: null }).eq("id", sessionId);

  const candidates: Candidate[] = [];
  const failedSources: string[] = [];
  const runs = new Map<string, Run>();

  // --- Fonte 1: base interna -------------------------------------------------
  const internalRun = await startRun(supabase, sessionId, INTERNAL_SOURCE);
  runs.set(INTERNAL_SOURCE, internalRun);
  const existing = await supabase
    .from("companies")
    .select("id, name, normalized_name, cnpj, segment, website_domain, phone_normalized, neighborhood, city, latitude, longitude")
    .limit(5000);
  if (existing.error) {
    await finishRun(supabase, internalRun, "failed", { error: "Falha ao consultar a base interna." });
    failedSources.push(INTERNAL_SOURCE);
  } else {
    const internal = rankInternalMatches(
      existing.data.map((row) => ({
        id: row.id,
        name: row.name,
        segment: row.segment,
        distanceKm: distanceTo(row.latitude === null ? null : { latitude: row.latitude, longitude: row.longitude! }),
      })),
      terms,
    );
    for (const match of internal) {
      candidates.push({ key: match.id, source: INTERNAL_SOURCE, strength: match.strength, distanceKm: match.distanceKm, name: match.name, reason: match.reason, companyId: match.id, osm: null, possibleDuplicateUrl: null });
    }
    await finishRun(supabase, internalRun, "succeeded", { results: internal.length, metadata: { terms } });
  }

  // --- Fonte 2: OpenStreetMap --------------------------------------------------
  const osmRun = await startRun(supabase, sessionId, OSM_SOURCE_NAME);
  runs.set(OSM_SOURCE_NAME, osmRun);
  if (!reference || radiusKm === null) {
    await finishRun(supabase, osmRun, "skipped", { error: "Ponto de referência ou raio não configurado." });
    failedSources.push(OSM_SOURCE_NAME);
  } else {
    const used = await supabase
      .from("research_source_runs")
      .select("id", { count: "exact", head: true })
      .eq("source_name", OSM_SOURCE_NAME)
      .in("status", ["succeeded", "failed"])
      .gte("started_at", startOfDayInSaoPaulo(new Date()));
    const dailyLimit = osmDailyLimit(process.env.OSM_DAILY_QUERY_LIMIT);
    if ((used.count ?? 0) >= dailyLimit) {
      await finishRun(supabase, osmRun, "rate_limited", { error: `Limite diário de ${dailyLimit} consultas ao OpenStreetMap atingido.` });
      failedSources.push(OSM_SOURCE_NAME);
    } else {
      const osm = await fetchOsmCandidates(reference, radiusKm);
      if (!osm.ok) {
        await finishRun(supabase, osmRun, osm.code === "rate_limited" ? "rate_limited" : "failed", { error: osm.message });
        failedSources.push(OSM_SOURCE_NAME);
      } else {
        const matches = matchOsmCandidates(osm.candidates, terms);
        const known = matches.length
          ? await supabase
              .from("company_sources")
              .select("company_id, source_record_id")
              .eq("source_name", OSM_SOURCE_NAME)
              .in("source_record_id", matches.map((match) => match.sourceRecordId))
          : { data: [], error: null };
        if (known.error) throw known.error;
        const byRecord = new Map(known.data.map((row) => [row.source_record_id, row.company_id]));
        const keys: ExistingCompanyKeys[] = (existing.data ?? []).map((row) => ({
          id: row.id,
          name: row.name,
          cnpj: row.cnpj,
          websiteDomain: row.website_domain,
          phoneNormalized: row.phone_normalized,
          normalizedName: row.normalized_name,
          neighborhood: row.neighborhood,
          city: row.city,
        }));
        for (const match of matches) {
          const distanceKm = distanceTo(match);
          const linked = byRecord.get(match.sourceRecordId);
          if (linked) {
            candidates.push({ key: linked, source: OSM_SOURCE_NAME, strength: match.strength, distanceKm, name: match.name, reason: match.reason, companyId: linked, osm: null, possibleDuplicateUrl: null });
            continue;
          }
          // Coincidência com empresa já cadastrada: usa a existente e sinaliza; nada é copiado nem unido.
          const duplicate = findDuplicateCandidates(match, keys)[0];
          if (duplicate) {
            const reasons = duplicate.reasons.map((reason) => DUPLICATE_REASON_LABELS[reason]).join(", ");
            candidates.push({
              key: duplicate.id,
              source: OSM_SOURCE_NAME,
              strength: match.strength,
              distanceKm,
              name: duplicate.name,
              reason: `${match.reason}. Parece ser “${duplicate.name}”, já cadastrada (${reasons}): confira; os dados não foram unidos`,
              companyId: duplicate.id,
              osm: null,
              possibleDuplicateUrl: match.sourceUrl,
            });
            continue;
          }
          candidates.push({ key: `osm:${match.sourceRecordId}`, source: OSM_SOURCE_NAME, strength: match.strength, distanceKm, name: match.name, reason: match.reason, companyId: null, osm: match, possibleDuplicateUrl: null });
        }
        await finishRun(supabase, osmRun, "succeeded", {
          results: matches.length,
          metadata: { terms, elements: osm.candidates.length, ignored: osm.ignored, truncated: osm.truncated, attribution: OSM_ATTRIBUTION },
        });
      }
    }
  }

  // --- Junta, cadastra as empresas novas selecionadas e cria oportunidades ------
  const selected = mergeCandidates(candidates);
  let imported = 0;
  const resultRows: { companyId: string; candidate: (typeof selected)[number]; isNew: boolean }[] = [];
  for (const candidate of selected) {
    let companyId = candidate.companyId;
    let isNew = false;
    if (!companyId && candidate.osm) {
      const osm = candidate.osm;
      const created = await supabase
        .from("companies")
        .insert({
          name: osm.name,
          normalized_name: osm.normalizedName,
          segment: osm.segment,
          website: osm.website,
          website_domain: osm.websiteDomain,
          phone: osm.phone,
          phone_normalized: osm.phoneNormalized,
          address: osm.address,
          neighborhood: osm.neighborhood,
          city: osm.city,
          state: osm.state,
          postal_code: osm.postalCode,
          latitude: osm.latitude,
          longitude: osm.longitude,
          location_status: "source_declared",
          field_provenance: provenanceFromOsm(osm, observedAt) as unknown as NonNullable<Json>,
          created_by: memberId,
        })
        .select("id")
        .single();
      if (created.error) throw created.error;
      const source = await supabase.from("company_sources").insert({
        company_id: created.data.id,
        research_session_id: sessionId,
        source_name: OSM_SOURCE_NAME,
        source_record_id: osm.sourceRecordId,
        source_url: osm.sourceUrl,
        last_verified_at: observedAt,
        evidence_metadata: { attribution: OSM_ATTRIBUTION, category: osm.segment } as unknown as NonNullable<Json>,
      });
      if (source.error) throw source.error;
      companyId = created.data.id;
      isNew = true;
      imported++;
    }
    if (companyId) resultRows.push({ companyId, candidate, isNew });
  }

  const opportunities: { id: string; companyId: string; ideaId: string }[] = [];
  const results: {
    research_session_id: string;
    opportunity_id: string;
    company_id: string;
    product_idea_id: string;
    source_name: string;
    match_reason: string;
    rank: number;
    is_new_company: boolean;
    possible_duplicate_url: string | null;
  }[] = [];
  for (const [index, row] of resultRows.entries()) {
    for (const idea of approved) {
      // Reaproveita a oportunidade existente (empresa × produto); nunca duplica.
      const found = await supabase.from("opportunities").select("id").eq("company_id", row.companyId).eq("product_idea_id", idea.id).maybeSingle();
      if (found.error) throw found.error;
      let opportunityId = found.data?.id;
      if (!opportunityId) {
        const created = await supabase
          .from("opportunities")
          .insert({ company_id: row.companyId, product_idea_id: idea.id, research_session_id: sessionId, created_by: memberId })
          .select("id")
          .single();
        if (created.error) throw created.error;
        opportunityId = created.data.id;
      }
      opportunities.push({ id: opportunityId, companyId: row.companyId, ideaId: idea.id });
      results.push({
        research_session_id: sessionId,
        opportunity_id: opportunityId,
        company_id: row.companyId,
        product_idea_id: idea.id,
        source_name: row.candidate.sources.join(" + "),
        match_reason: row.candidate.reason.slice(0, 300),
        rank: index + 1,
        is_new_company: row.isNew,
        possible_duplicate_url: row.candidate.possibleDuplicateUrl,
      });
    }
  }
  if (results.length) {
    const inserted = await supabase.from("research_session_results").insert(results);
    if (inserted.error) throw inserted.error;
  }

  // --- Pontuação -----------------------------------------------------------------
  const { scored, aiNote } = await scoreSearchOpportunities(supabase, {
    memberId,
    sessionId,
    opportunities,
    ideas: approved,
    reference,
    radiusKm,
    capacitySummary: snapshot?.capacitySummary ?? null,
  });

  const finishedAt = new Date().toISOString();
  await supabase
    .from("research_sessions")
    .update({ status: searchOutcome(resultRows.length, failedSources.length, runs.size), completed_at: finishedAt })
    .eq("id", sessionId);

  return { found: resultRows.length, imported, scored, failedSources, aiNote };
}

async function scoreSearchOpportunities(
  supabase: Client,
  context: {
    memberId: string;
    sessionId: string;
    opportunities: { id: string; companyId: string; ideaId: string }[];
    ideas: { id: string; name: string; problem_statement: string | null; proposed_application: string | null; technical_constraints: string | null }[];
    reference: GeoPoint | null;
    radiusKm: number | null;
    capacitySummary: string | null;
  },
): Promise<{ scored: number; aiNote: string | null }> {
  if (context.opportunities.length === 0) return { scored: 0, aiNote: null };
  const scoring = await activeScoringConfig(supabase);
  if (!scoring) return { scored: 0, aiNote: "Sem configuração de pontuação ativa." };

  const companyIds = [...new Set(context.opportunities.map((item) => item.companyId))];
  const companies = await supabase
    .from("companies")
    .select("id, name, segment, neighborhood, city, latitude, longitude, location_status, field_provenance")
    .in("id", companyIds);
  if (companies.error) throw companies.error;
  const byId = new Map(companies.data.map((row) => [row.id, row]));

  // A IA recebe identificadores curtos, nunca ids internos.
  const ideaRefs = new Map(context.ideas.map((idea, index) => [idea.id, `i${index + 1}`]));
  const companyRefs = new Map(companyIds.map((id, index) => [id, `c${index + 1}`]));
  const refOf = (pair: { companyId: string; ideaId: string }) => `${companyRefs.get(pair.companyId)}|${ideaRefs.get(pair.ideaId)}`;

  // Avaliação dos critérios de julgamento pela IA (uma chamada por busca).
  const assessments = new Map<string, OpportunityAssessment>();
  let unavailableReason = "IA não configurada.";
  let aiNote: string | null = null;
  const ai = readAiConfig();
  if (ai.ok) {
    const used = await supabase.from("ai_usage_log").select("id", { count: "exact", head: true }).gte("created_at", startOfDayInSaoPaulo(new Date()));
    if ((used.count ?? 0) >= ai.config.dailyLimit) {
      unavailableReason = "limite diário de uso da IA atingido.";
    } else {
      const pairs = context.opportunities.slice(0, MAX_ASSESSMENT_PAIRS);
      const prompt = buildAssessmentPrompt({
        capacitySummary: context.capacitySummary,
        ideas: context.ideas.map((idea) => ({
          ref: ideaRefs.get(idea.id)!,
          name: idea.name,
          problem: idea.problem_statement,
          application: idea.proposed_application,
          technicalConstraints: idea.technical_constraints,
        })),
        companies: companyIds.map((id) => {
          const company = byId.get(id)!;
          return { ref: companyRefs.get(id)!, name: company.name, segment: company.segment, place: [company.neighborhood, company.city].filter(Boolean).join(", ") || null };
        }),
      });
      const result = await generateJsonWithGemini(prompt, assessmentResponseSchema, { apiKey: ai.config.apiKey, model: ai.config.model, temperature: 0.2 });
      await supabase.from("ai_usage_log").insert({
        provider: ai.config.provider,
        model: ai.config.model,
        purpose: "opportunity_assessment",
        research_session_id: context.sessionId,
        status: result.ok ? "succeeded" : result.code === "invalid_output" ? "rejected_output" : "failed",
        error_code: result.ok ? null : result.code,
        created_by: context.memberId,
      });
      if (result.ok) {
        const wanted = new Set(pairs.map(refOf));
        for (const item of result.data.assessments) {
          const key = `${item.company}|${item.idea}`;
          if (wanted.has(key) && !assessments.has(key)) assessments.set(key, item);
        }
        unavailableReason = "a IA não avaliou esta combinação.";
        if (context.opportunities.length > MAX_ASSESSMENT_PAIRS) aiNote = `A IA avaliou as primeiras ${MAX_ASSESSMENT_PAIRS} combinações.`;
      } else {
        unavailableReason = `a IA falhou (${result.message})`;
        aiNote = result.message;
      }
    }
  }

  let scored = 0;
  const evaluatedAt = new Date().toISOString();
  for (const pair of context.opportunities) {
    const company = byId.get(pair.companyId);
    if (!company) continue;
    const provenance = (company.field_provenance ?? {}) as ProvenanceMap;
    const proximity = evaluateProximity(
      {
        reference: context.reference,
        radiusKm: context.radiusKm,
        company: {
          location: company.latitude === null ? null : { latitude: company.latitude, longitude: company.longitude! },
          locationStatus: company.location_status,
          locationSource: provenance.location?.source,
          locationObservedAt: provenance.location?.observedAt,
        },
      },
      scoring.config,
    );
    const assessment = assessments.get(refOf(pair));
    const availability: AssessmentAvailability = assessment
      ? { kind: "assessed", source: `IA (${ai.ok ? ai.config.provider : "desconhecida"})`, observedAt: evaluatedAt, assessment }
      : { kind: "unavailable", reason: unavailableReason };
    const result = await scoreOpportunity(supabase, pair.id, { criteria: opportunityCriteria(proximity, availability), evaluatedAt }, scoring);
    if (result) scored++;
  }
  return { scored, aiNote };
}
