/** Constantes do cadastro de empresas (sem dependências: usado também no navegador). */
export const BRAZIL_STATES = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG", "PA",
  "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO",
] as const;

export type DuplicateReason = "cnpj" | "website" | "phone" | "name";

export const DUPLICATE_REASON_LABELS: Record<DuplicateReason, string> = {
  cnpj: "mesmo CNPJ",
  website: "mesmo site",
  phone: "mesmo telefone",
  name: "mesmo nome",
};
