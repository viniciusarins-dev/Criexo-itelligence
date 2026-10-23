import { describe, expect, it } from "vitest";

import { funnel, outcomes, periodStart, sourceHealth, starDistribution, toCsv, topGroups } from "@/domain/reports/reports";

const statuses = [
  { key: "nova", label: "Nova", category: "open" as const },
  { key: "convertida", label: "Convertida", category: "won" as const },
  { key: "descartada", label: "Descartada", category: "lost" as const },
];
const row = (status: string, stars: number | null, segment: string | null = null, isComplete: boolean | null = true) => ({
  status,
  stars,
  isComplete,
  segment,
  productName: null,
});

describe("relatórios", () => {
  it("conta o funil na ordem configurada e só calcula taxa com encerradas", () => {
    const rows = [row("nova", 4), row("nova", null), row("convertida", 5), row("descartada", 2)];
    expect(funnel(rows, statuses).map((bar) => bar.value)).toEqual([2, 1, 1]);
    expect(outcomes(rows, statuses)).toEqual({ total: 4, open: 2, won: 1, lost: 1, winRate: 0.5 });
    expect(outcomes([row("nova", 3)], statuses).winRate).toBeNull();
  });

  it("distribui por estrelas, separa sem nota e conta notas incompletas", () => {
    const result = starDistribution([row("nova", 4, null, false), row("nova", 4), row("nova", null)]);
    expect(result.bars.find((bar) => bar.key === "4")?.value).toBe(2);
    expect(result.bars.find((bar) => bar.key === "none")?.value).toBe(1);
    expect(result.incomplete).toBe(1);
  });

  it("agrupa os maiores e junta o resto em Outros", () => {
    const values = ["A", "A", "B", null, "", "C", "D"];
    expect(topGroups(values, 2)).toEqual([
      { key: "A", label: "A", value: 2 },
      { key: "Não informado", label: "Não informado", value: 2 },
      { key: "__outros", label: "Outros", value: 3 },
    ]);
  });

  it("resume a saúde das fontes e o início do período", () => {
    expect(sourceHealth([{ source: "OSM", status: "failed" }, { source: "OSM", status: "succeeded" }, { source: "Base", status: "succeeded" }])).toEqual([
      { source: "OSM", total: 2, succeeded: 1, failed: 1, limited: 0, skipped: 0 },
      { source: "Base", total: 1, succeeded: 1, failed: 0, limited: 0, skipped: 0 },
    ]);
    expect(periodStart("todos", new Date())).toBeNull();
    expect(periodStart("30", new Date("2026-10-31T00:00:00Z"))).toBe("2026-10-01T00:00:00.000Z");
  });
});

describe("CSV", () => {
  it("usa BOM, ponto e vírgula e vírgula decimal; protege contra fórmulas", () => {
    const csv = toCsv(
      [
        { name: "Loja; Centro", score: 72.5, saved: true, note: '=HYPERLINK("x")' },
        { name: "Outra", score: null, saved: false, note: "+5511" },
      ],
      [
        { header: "Nome", value: (item) => item.name },
        { header: "Nota", value: (item) => item.score },
        { header: "Salva", value: (item) => item.saved },
        { header: "Obs", value: (item) => item.note },
      ],
    );
    expect(csv.startsWith("﻿")).toBe(true);
    const lines = csv.slice(1).split("\r\n");
    expect(lines[0]).toBe("Nome;Nota;Salva;Obs");
    expect(lines[1]).toBe(`"Loja; Centro";72,5;sim;"'=HYPERLINK(""x"")"`);
    expect(lines[2]).toBe("Outra;;não;'+5511");
  });
});
