"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { geoReferenceSchema, parseCoordinatePair, radiusKmSchema } from "@/domain/settings/geo";
import {
  MODELING_LEVELS,
  PRINT_TIME_BANDS,
  PRINT_TIME_BASES,
  PRINTER_SCHEDULES,
  productionSettingsSchema,
  SIZE_UNITS,
} from "@/domain/settings/production";
import { requireActiveMember } from "@/lib/auth/session";
import type { Json } from "@/lib/supabase/database.types";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  readChecked,
  readEnumOrNull,
  readNumberOrNull,
  readText,
  formValues,
  type ActionState,
} from "@/lib/validation/form-data";

const PATH = "/configuracoes";

function fail(message: string, fieldErrors?: Record<string, string>, formData?: FormData): ActionState {
  return { status: "error", message, fieldErrors, submittedAt: Date.now(), values: formData ? formValues(formData) : undefined };
}

function done(message: string): ActionState {
  revalidatePath(PATH);
  revalidatePath("/dashboard");
  return { status: "success", message, submittedAt: Date.now() };
}

function fieldErrorsFrom(error: z.ZodError, prefix = ""): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = prefix + issue.path.join(".");
    if (!errors[key]) errors[key] = issue.message;
  }
  return errors;
}

/** Grava uma chave de configuração apenas se o valor mudou (o histórico fica limpo). */
async function writeSetting(key: string, value: NonNullable<Json>): Promise<"unchanged" | "saved"> {
  const supabase = await createSupabaseServerClient();
  const current = await supabase.from("system_settings").select("value").eq("key", key).maybeSingle();
  if (current.error) throw current.error;
  if (current.data && JSON.stringify(current.data.value) === JSON.stringify(value)) return "unchanged";

  const result = current.data
    ? await supabase.from("system_settings").update({ value }).eq("key", key)
    : await supabase.from("system_settings").insert({ key, value });
  if (result.error) throw result.error;
  return "saved";
}

export async function saveRegion(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const member = await requireActiveMember();
  if (member.role !== "admin") return fail("Apenas administradores alteram a região de atuação.");

  const coordinates = parseCoordinatePair(readText(formData, "coordinates"));
  const radius = readNumberOrNull(formData, "radiusKm");
  const geo = geoReferenceSchema.safeParse({
    address: readText(formData, "address"),
    latitude: coordinates?.latitude ?? Number.NaN,
    longitude: coordinates?.longitude ?? Number.NaN,
  });
  const radiusParsed = radiusKmSchema.safeParse(radius ?? undefined);

  const fieldErrors: Record<string, string> = {};
  if (!geo.success && geo.error.issues.some((issue) => issue.path[0] === "address")) {
    fieldErrors.address = geo.error.issues.find((issue) => issue.path[0] === "address")!.message;
  }
  if (!coordinates) fieldErrors.coordinates = "Cole as coordenadas no formato \"-26.27, -48.85\".";
  if (!radiusParsed.success) fieldErrors.radiusKm = radiusParsed.error.issues[0].message;
  if (!geo.success || !radiusParsed.success) return fail("Revise os campos destacados.", fieldErrors, formData);

  try {
    const results = await Promise.all([
      writeSetting("geo.reference", geo.data),
      writeSetting("geo.radius_km", radiusParsed.data),
    ]);
    if (results.every((result) => result === "unchanged")) return { status: "success", message: "Nenhuma alteração.", submittedAt: Date.now() };
  } catch {
    return fail("Não foi possível salvar a região. Verifique sua permissão e tente novamente.", undefined, formData);
  }
  return done("Região de atuação salva.");
}

export async function saveProduction(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const member = await requireActiveMember();

  const x = readNumberOrNull(formData, "volumeX");
  const y = readNumberOrNull(formData, "volumeY");
  const z = readNumberOrNull(formData, "volumeZ");
  const anyVolume = x !== null || y !== null || z !== null;
  const extraMaterials = readText(formData, "otherMaterials")
    .split(",")
    .map((material) => material.trim())
    .filter(Boolean);

  const candidate = {
    schemaVersion: 1,
    printer: {
      model: readText(formData, "printerModel"),
      buildVolumeCm: anyVolume ? { x: x ?? Number.NaN, y: y ?? Number.NaN, z: z ?? Number.NaN } : null,
    },
    materials: [...new Set([...formData.getAll("materials").map(String), ...extraMaterials])],
    modularAssembly: readChecked(formData, "modularAssembly"),
    modeling: readEnumOrNull(formData, "modeling", MODELING_LEVELS),
    weeklyWorkHours: readNumberOrNull(formData, "weeklyWorkHours"),
    printerSchedule: readEnumOrNull(formData, "printerSchedule", PRINTER_SCHEDULES),
    printerHoursPerDay: readNumberOrNull(formData, "printerHoursPerDay"),
    standardLeadTimeDays: readNumberOrNull(formData, "standardLeadTimeDays"),
    customProjectsRequireEvaluation: readChecked(formData, "customProjectsRequireEvaluation"),
    throughput: {
      smallPartLimit: {
        value: readNumberOrNull(formData, "smallPartLimit"),
        unit: readEnumOrNull(formData, "smallPartUnit", SIZE_UNITS),
      },
      printTimeBasis: readEnumOrNull(formData, "printTimeBasis", PRINT_TIME_BASES),
      smallPartsPerDay: Object.fromEntries(
        PRINT_TIME_BANDS.map((band) => [band, readNumberOrNull(formData, `perDay_${band}`)]),
      ),
      largePartsOnePerPrint: readChecked(formData, "largePartsOnePerPrint"),
      multiplePartsPerPlate: readChecked(formData, "multiplePartsPerPlate"),
    },
    notes: readText(formData, "notes"),
  };

  const parsed = productionSettingsSchema.safeParse(candidate);
  if (!parsed.success) return fail("Revise os campos destacados.", fieldErrorsFrom(parsed.error), formData);

  const supabase = await createSupabaseServerClient();
  const latest = await supabase
    .from("production_settings")
    .select("settings")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (latest.error) return fail("Não foi possível ler a capacidade atual. Tente novamente.", undefined, formData);
  if (latest.data && JSON.stringify(latest.data.settings) === JSON.stringify(parsed.data)) {
    return { status: "success", message: "Nenhuma alteração.", submittedAt: Date.now() };
  }

  const { error } = await supabase
    .from("production_settings")
    .insert({ settings: parsed.data as unknown as NonNullable<Json>, created_by: member.id });
  if (error) return fail("Não foi possível salvar a capacidade produtiva. Tente novamente.", undefined, formData);
  return done("Capacidade produtiva salva. A versão anterior continua no histórico.");
}

const displayNameSchema = z.string().trim().min(1, { error: "Informe seu nome." }).max(120);

export async function updateDisplayName(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const member = await requireActiveMember();
  const parsed = displayNameSchema.safeParse(readText(formData, "displayName"));
  if (!parsed.success) return fail("Revise o nome.", { displayName: parsed.error.issues[0].message }, formData);

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("profiles").update({ display_name: parsed.data }).eq("id", member.id);
  if (error) return fail("Não foi possível salvar o nome. Tente novamente.", undefined, formData);
  revalidatePath("/", "layout");
  return { status: "success", message: "Nome atualizado.", submittedAt: Date.now() };
}

const memberAccessSchema = z.object({
  userId: z.uuid(),
  role: z.enum(["admin", "member"]),
  isActive: z.boolean(),
});

export async function setMemberAccess(input: { userId: string; role: string; isActive: boolean }): Promise<ActionState> {
  const member = await requireActiveMember();
  if (member.role !== "admin") return fail("Apenas administradores alteram acessos.");
  const parsed = memberAccessSchema.safeParse(input);
  if (!parsed.success) return fail("Dados inválidos.");
  if (parsed.data.userId === member.id) return fail("Você não pode alterar o próprio acesso.");

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("admin_set_member_access", {
    p_user_id: parsed.data.userId,
    p_role: parsed.data.role,
    p_is_active: parsed.data.isActive,
  });
  if (error) return fail("Não foi possível alterar o acesso. Tente novamente.");
  return done("Acesso atualizado.");
}
