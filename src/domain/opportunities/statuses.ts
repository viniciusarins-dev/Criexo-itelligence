/** Status comerciais e regras simples sobre eles (sem dependências: usado também no navegador). */
export type CommercialStatus = {
  key: string;
  label: string;
  position: number;
  category: "open" | "won" | "lost";
};

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
