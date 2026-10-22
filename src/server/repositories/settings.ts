import "server-only";

import { parseScoringConfig, type ScoringConfig } from "@/domain/scoring";
import { geoReferenceSchema, radiusKmSchema, type GeoReference } from "@/domain/settings/geo";
import { productionSettingsSchema, type ProductionSettings } from "@/domain/settings/production";
import { requireActiveMember, type CurrentMember } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Enums } from "@/lib/supabase/types";

export type Versioned<T> = { value: T; updatedAt: string; updatedBy: string | null };

export type TeamMember = {
  id: string;
  email: string | null;
  displayName: string;
  role: Enums<"app_role">;
  isActive: boolean;
};

export type SettingsData = {
  member: CurrentMember;
  geoReference: Versioned<GeoReference> | null;
  radiusKm: Versioned<number> | null;
  production: Versioned<ProductionSettings> | null;
  scoring: {
    version: number;
    approvalState: "proposal" | "approved";
    notes: string | null;
    config: ScoringConfig;
  } | null;
  /** Apenas para administradores; `null` para os demais. */
  team: TeamMember[] | null;
};

export class SettingsLoadError extends Error {
  constructor(section: string, cause: unknown) {
    super(`Falha ao carregar ${section}`, { cause });
    this.name = "SettingsLoadError";
  }
}

export async function loadSettings(): Promise<SettingsData> {
  const member = await requireActiveMember();
  const supabase = await createSupabaseServerClient();

  const [settings, production, scoring, profiles] = await Promise.all([
    supabase.from("system_settings").select("key, value, updated_at, updated_by").in("key", ["geo.reference", "geo.radius_km"]),
    supabase
      .from("production_settings")
      .select("settings, created_at, created_by")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase.from("scoring_configs").select("version, config, approval_state, notes").eq("is_active", true).maybeSingle(),
    supabase.from("profiles").select("id, display_name"),
  ]);

  if (settings.error) throw new SettingsLoadError("configurações", settings.error);
  if (production.error) throw new SettingsLoadError("capacidade produtiva", production.error);
  if (scoring.error) throw new SettingsLoadError("pontuação", scoring.error);
  if (profiles.error) throw new SettingsLoadError("equipe", profiles.error);

  const names = new Map(profiles.data.map((profile) => [profile.id, profile.display_name]));
  const nameOf = (id: string | null) => (id ? (names.get(id) ?? null) : null);

  const byKey = new Map(settings.data.map((row) => [row.key, row]));
  const geoRow = byKey.get("geo.reference");
  const radiusRow = byKey.get("geo.radius_km");
  const geoParsed = geoRow ? geoReferenceSchema.safeParse(geoRow.value) : null;
  const radiusParsed = radiusRow ? radiusKmSchema.safeParse(radiusRow.value) : null;
  const productionParsed = production.data ? productionSettingsSchema.safeParse(production.data.settings) : null;

  let team: TeamMember[] | null = null;
  if (member.role === "admin") {
    const result = await supabase.rpc("admin_list_members");
    if (result.error) throw new SettingsLoadError("equipe", result.error);
    team = result.data.map((row) => ({
      id: row.id,
      email: row.email,
      displayName: row.display_name,
      role: row.role,
      isActive: row.is_active,
    }));
  }

  return {
    member,
    geoReference:
      geoRow && geoParsed?.success
        ? { value: geoParsed.data, updatedAt: geoRow.updated_at, updatedBy: nameOf(geoRow.updated_by) }
        : null,
    radiusKm:
      radiusRow && radiusParsed?.success
        ? { value: radiusParsed.data, updatedAt: radiusRow.updated_at, updatedBy: nameOf(radiusRow.updated_by) }
        : null,
    production:
      production.data && productionParsed?.success
        ? { value: productionParsed.data, updatedAt: production.data.created_at, updatedBy: nameOf(production.data.created_by) }
        : null,
    scoring: scoring.data
      ? {
          version: scoring.data.version,
          approvalState: scoring.data.approval_state === "approved" ? "approved" : "proposal",
          notes: scoring.data.notes,
          config: parseScoringConfig(scoring.data.config),
        }
      : null,
    team,
  };
}
