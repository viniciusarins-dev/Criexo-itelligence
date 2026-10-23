import { z } from "zod";

export const NOTE_MAX_LENGTH = 5000;

export type CommercialStatus = {
  key: string;
  label: string;
  position: number;
  category: "open" | "won" | "lost";
};

/** Observação opcional (mudança de status) ou obrigatória (observação, contato). */
export const optionalNoteSchema = z
  .string()
  .trim()
  .max(NOTE_MAX_LENGTH, { error: `Use no máximo ${NOTE_MAX_LENGTH} caracteres.` })
  .transform((value) => (value ? value : null));

export const requiredNoteSchema = z
  .string()
  .trim()
  .min(1, { error: "Escreva a observação." })
  .max(NOTE_MAX_LENGTH, { error: `Use no máximo ${NOTE_MAX_LENGTH} caracteres.` });

export const ACTIVITY_KINDS = ["note", "contact"] as const;
export type ActivityKind = (typeof ACTIVITY_KINDS)[number];

/** Status de descarte: o primeiro status ativo da categoria "perdida". */
export function discardStatus(statuses: CommercialStatus[]): CommercialStatus | null {
  return [...statuses].sort((a, b) => a.position - b.position).find((status) => status.category === "lost") ?? null;
}

/**
 * Status para onde um contato registrado pode mover a oportunidade, se o
 * usuário pedir. Nenhum status muda sozinho: registrar um contato não equivale
 * a marcar a empresa como contatada sem a escolha explícita do usuário.
 */
export function contactedStatus(statuses: CommercialStatus[]): CommercialStatus | null {
  return statuses.find((status) => status.key === "contatada") ?? null;
}

export function isClosed(status: CommercialStatus | undefined): boolean {
  return status?.category === "won" || status?.category === "lost";
}
