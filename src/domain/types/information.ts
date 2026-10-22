/** RN-12: natureza de cada informação usada pelo sistema. */
export const INFORMATION_STATUSES = [
  "confirmed",
  "source_declared",
  "ai_inference",
  "unknown",
  "outdated",
] as const;

export type InformationStatus = (typeof INFORMATION_STATUSES)[number];

export const INFORMATION_STATUS_LABELS: Record<InformationStatus, string> = {
  confirmed: "Confirmada",
  source_declared: "Declarada pela fonte",
  ai_inference: "Inferência da IA",
  unknown: "Desconhecida",
  outdated: "Desatualizada",
};

/** Uma evidência que sustenta (ou não) uma avaliação. */
export type Evidence = {
  statement: string;
  status: InformationStatus;
  source?: string;
  /** Data ISO 8601 em que a informação foi observada na fonte. */
  observedAt?: string;
};
