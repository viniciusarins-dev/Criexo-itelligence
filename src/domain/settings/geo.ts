import { z } from "zod";

/** Limites espelhados na validação do banco (`private.is_valid_system_setting`). */
export const RADIUS_KM_MAX = 100;

export const geoReferenceSchema = z.object({
  address: z
    .string()
    .trim()
    .min(3, { error: "Informe o endereço do ponto de referência." })
    .max(200, { error: "Use no máximo 200 caracteres." }),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
});

export type GeoReference = z.infer<typeof geoReferenceSchema>;

export const radiusKmSchema = z
  .number({ error: "Informe o raio em km." })
  .gt(0, { error: "O raio deve ser maior que zero." })
  .max(RADIUS_KM_MAX, { error: `O raio pode ter no máximo ${RADIUS_KM_MAX} km.` });

/**
 * Lê um par "latitude, longitude" como o Google Maps copia
 * (ex.: "-26.27, -48.85"). Também aceita vírgula decimal separada por
 * ponto e vírgula ("-26,27; -48,85"). Retorna `null` se não for um par válido.
 */
export function parseCoordinatePair(input: string): { latitude: number; longitude: number } | null {
  const text = input.trim();
  if (!text) return null;

  let parts: string[];
  if (text.includes(";")) {
    parts = text.split(";").map((part) => part.trim().replace(",", "."));
  } else {
    parts = text.split(/[,\s]+/).filter(Boolean);
  }
  if (parts.length !== 2) return null;
  if (!parts.every((part) => /^-?\d{1,3}(\.\d+)?$/.test(part))) return null;

  const [latitude, longitude] = parts.map(Number);
  const result = geoReferenceSchema.shape.latitude.safeParse(latitude).success &&
    geoReferenceSchema.shape.longitude.safeParse(longitude).success;
  return result ? { latitude, longitude } : null;
}
