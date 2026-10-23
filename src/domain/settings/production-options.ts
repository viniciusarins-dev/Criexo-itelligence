/** Opções e rótulos da capacidade produtiva (sem dependências: usado também no navegador). */

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
