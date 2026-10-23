import { z } from "zod";

export { contactedStatus, discardStatus, isClosed, type CommercialStatus } from "./statuses";

export const NOTE_MAX_LENGTH = 5000;

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
