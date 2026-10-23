import { z } from "zod";

import {
  MODELING_LEVELS,
  MODELING_LABELS,
  PRINT_TIME_BANDS,
  PRINT_TIME_LABELS,
  PRINTER_SCHEDULES,
  SIZE_UNITS,
  SIZE_UNIT_LABELS,
  PRINT_TIME_BASES,
  type PrintTimeBand,
} from "./production-options";

/**
 * Capacidade produtiva informada manualmente (RN-05).
 * Campos `null` significam "a confirmar": o sistema trata como incerteza,
 * nunca como capacidade ilimitada.
 */

export {
  MATERIALS,
  MODELING_LEVELS,
  MODELING_LABELS,
  PRINT_TIME_BANDS,
  PRINT_TIME_LABELS,
  PRINTER_SCHEDULES,
  PRINTER_SCHEDULE_LABELS,
  SIZE_UNITS,
  SIZE_UNIT_LABELS,
  PRINT_TIME_BASES,
  PRINT_TIME_BASIS_LABELS,
  type PrintTimeBand,
} from "./production-options";

const dimension = z.number().positive().max(200);

export const productionSettingsSchema = z.object({
  schemaVersion: z.literal(1),
  printer: z.object({
    model: z.string().trim().min(1, { error: "Informe o modelo da impressora." }).max(120),
    /** Área de impressão em centímetros. */
    buildVolumeCm: z.object({ x: dimension, y: dimension, z: dimension }).nullable(),
  }),
  materials: z.array(z.string().trim().min(1).max(40)).max(20),
  /** Peças maiores que a área de impressão podem ser feitas em módulos com encaixe. */
  modularAssembly: z.boolean(),
  modeling: z.enum(MODELING_LEVELS).nullable(),
  /** Tempo de trabalho da pessoa (preparo, acabamento, atendimento, entrega) — não é tempo de impressora. */
  weeklyWorkHours: z.number().positive().max(168).nullable(),
  /** Quando a impressora fica ligada. `null` = a confirmar. */
  printerSchedule: z.enum(PRINTER_SCHEDULES).nullable().default(null),
  /** Horas por dia em que a impressora costuma ficar ligada. `null` = a confirmar. */
  printerHoursPerDay: z.number().positive().max(24).nullable().default(null),
  standardLeadTimeDays: z.number().int().positive().max(365).nullable(),
  /** Projetos criados do zero têm prazo avaliado caso a caso. */
  customProjectsRequireEvaluation: z.boolean(),
  throughput: z.object({
    /** Limite que separa peças "pequenas"; unidade `null` = a confirmar. */
    smallPartLimit: z.object({
      value: z.number().positive().max(1000).nullable(),
      unit: z.enum(SIZE_UNITS).nullable(),
    }),
    printTimeBasis: z.enum(PRINT_TIME_BASES).nullable(),
    /** Peças pequenas por dia, conforme o tempo de impressão. */
    smallPartsPerDay: z.object(
      Object.fromEntries(PRINT_TIME_BANDS.map((band) => [band, z.number().int().positive().max(10000).nullable()])) as Record<
        PrintTimeBand,
        z.ZodNullable<z.ZodNumber>
      >,
    ),
    /** Acima do limite, apenas uma peça por impressão. */
    largePartsOnePerPrint: z.boolean(),
    /**
     * Peças pequenas são impressas várias na mesma mesa; as quantidades por
     * dia já consideram isso e valem diretamente como capacidade diária.
     */
    multiplePartsPerPlate: z.boolean().default(false),
  }),
  notes: z.string().trim().max(2000),
});

export type ProductionSettings = z.infer<typeof productionSettingsSchema>;

/** Itens que ainda precisam de confirmação, em linguagem simples. */
export function pendingProductionItems(settings: ProductionSettings): string[] {
  const pending: string[] = [];
  if (!settings.printer.buildVolumeCm) pending.push("Área de impressão");
  if (settings.materials.length === 0) pending.push("Materiais");
  if (settings.modeling === null) pending.push("Modelagem 3D");
  if (settings.weeklyWorkHours === null) pending.push("Horas de trabalho por semana");
  if (settings.printerSchedule === null) pending.push("Quando a impressora fica ligada");
  if (settings.printerHoursPerDay === null) pending.push("Horas por dia com a impressora ligada");
  if (settings.standardLeadTimeDays === null) pending.push("Prazo padrão de entrega");
  const { smallPartLimit, printTimeBasis, smallPartsPerDay } = settings.throughput;
  if (smallPartLimit.value === null || smallPartLimit.unit === null) pending.push("Unidade do limite de peça pequena");
  if (printTimeBasis === null) pending.push("Tempo de impressão: por peça ou por mesa");
  if (PRINT_TIME_BANDS.some((band) => smallPartsPerDay[band] === null)) pending.push("Peças por dia em cada faixa de tempo");
  return pending;
}

/** Resumo em linguagem simples (usado nas instruções para a IA). Só inclui o que foi informado. */
export function capacitySummary(settings: ProductionSettings): string {
  const parts: string[] = [`impressora ${settings.printer.model}`];
  const volume = settings.printer.buildVolumeCm;
  if (volume) parts.push(`área de impressão ${volume.x} × ${volume.y} × ${volume.z} cm`);
  if (settings.modularAssembly) parts.push("peças maiores podem ser feitas em módulos com encaixe");
  if (settings.materials.length) parts.push(`materiais: ${settings.materials.join(", ")}`);
  if (settings.modeling) parts.push(MODELING_LABELS[settings.modeling].toLowerCase());
  if (settings.standardLeadTimeDays !== null) parts.push(`prazo padrão de ${settings.standardLeadTimeDays} dia(s)`);
  const { smallPartLimit, smallPartsPerDay } = settings.throughput;
  if (smallPartLimit.value !== null && smallPartLimit.unit) {
    const perDay = PRINT_TIME_BANDS.filter((band) => smallPartsPerDay[band] !== null)
      .map((band) => `${smallPartsPerDay[band]} por dia (${PRINT_TIME_LABELS[band].toLowerCase()})`)
      .join(", ");
    parts.push(
      `peças pequenas até ${smallPartLimit.value} ${SIZE_UNIT_LABELS[smallPartLimit.unit]}${perDay ? `: ${perDay}` : ""}`,
    );
  }
  if (settings.throughput.largePartsOnePerPrint) parts.push("peças acima desse limite saem uma por vez");
  return parts.join("; ");
}
