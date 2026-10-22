import { z } from "zod";

/**
 * Capacidade produtiva informada manualmente (RN-05).
 * Campos `null` significam "a confirmar": o sistema trata como incerteza,
 * nunca como capacidade ilimitada.
 */

export const MATERIALS = ["PLA", "PETG", "ABS", "TPU", "Resina"] as const;

export const MODELING_LEVELS = ["full", "simple_only", "none"] as const;
export const MODELING_LABELS: Record<(typeof MODELING_LEVELS)[number], string> = {
  full: "Faz a modelagem 3D",
  simple_only: "Modela apenas peças simples",
  none: "Imprime apenas arquivos prontos",
};

export const PRINT_TIME_BANDS = ["under_1h", "1_to_5h", "5h_or_more"] as const;
export type PrintTimeBand = (typeof PRINT_TIME_BANDS)[number];
export const PRINT_TIME_LABELS: Record<PrintTimeBand, string> = {
  under_1h: "Menos de 1 hora",
  "1_to_5h": "De 1 a 5 horas",
  "5h_or_more": "5 horas ou mais",
};

export const PRINTER_SCHEDULES = ["work_hours", "continuous"] as const;
export const PRINTER_SCHEDULE_LABELS: Record<(typeof PRINTER_SCHEDULES)[number], string> = {
  work_hours: "Só no horário de trabalho",
  continuous: "Também fora do horário (ex.: à noite)",
};

export const SIZE_UNITS = ["cm_per_side", "cm3"] as const;
export const SIZE_UNIT_LABELS: Record<(typeof SIZE_UNITS)[number], string> = {
  cm_per_side: "cm em cada lado",
  cm3: "cm³ de volume",
};

export const PRINT_TIME_BASES = ["per_part", "per_plate"] as const;
export const PRINT_TIME_BASIS_LABELS: Record<(typeof PRINT_TIME_BASES)[number], string> = {
  per_part: "por peça",
  per_plate: "por mesa de impressão (lote)",
};

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
