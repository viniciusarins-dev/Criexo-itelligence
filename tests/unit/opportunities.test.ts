import { describe, expect, it } from "vitest";

import {
  contactedStatus,
  discardStatus,
  isClosed,
  optionalNoteSchema,
  requiredNoteSchema,
  type CommercialStatus,
} from "@/domain/opportunities/opportunity";

const statuses: CommercialStatus[] = [
  { key: "descartada", label: "Descartada", position: 70, category: "lost" },
  { key: "nova", label: "Nova", position: 10, category: "open" },
  { key: "contatada", label: "Contatada", position: 40, category: "open" },
  { key: "convertida", label: "Convertida", position: 60, category: "won" },
];

describe("observações", () => {
  it("observação opcional vazia vira nula", () => {
    expect(optionalNoteSchema.parse("   ")).toBeNull();
    expect(optionalNoteSchema.parse(" ligou ")).toBe("ligou");
  });

  it("observação obrigatória recusa texto vazio ou longo demais", () => {
    expect(requiredNoteSchema.safeParse("  ").success).toBe(false);
    expect(requiredNoteSchema.safeParse("x".repeat(5001)).success).toBe(false);
    expect(requiredNoteSchema.parse(" Pediu orçamento ")).toBe("Pediu orçamento");
  });
});

describe("status", () => {
  it("encontra o status de descarte pela categoria", () => {
    expect(discardStatus(statuses)?.key).toBe("descartada");
    expect(discardStatus(statuses.filter((status) => status.category !== "lost"))).toBeNull();
  });

  it("encontra o status de contatada", () => {
    expect(contactedStatus(statuses)?.key).toBe("contatada");
  });

  it("convertida e descartada são encerradas", () => {
    expect(isClosed(statuses[0])).toBe(true);
    expect(isClosed(statuses[3])).toBe(true);
    expect(isClosed(statuses[1])).toBe(false);
    expect(isClosed(undefined)).toBe(false);
  });
});
