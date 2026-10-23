/**
 * Agregações dos relatórios. Funções puras: recebem linhas já lidas sob RLS e
 * só contam — nenhuma taxa é estimada ou projetada.
 */
export type ReportPeriod = "30" | "90" | "todos";
export const REPORT_PERIODS: Record<ReportPeriod, string> = { "30": "Últimos 30 dias", "90": "Últimos 90 dias", todos: "Todo o período" };

export function periodStart(period: ReportPeriod, now: Date): string | null {
  if (period === "todos") return null;
  return new Date(now.getTime() - Number(period) * 24 * 60 * 60 * 1000).toISOString();
}

export type Bar = { key: string; label: string; value: number };

export type OpportunityRow = {
  status: string;
  stars: number | null;
  isComplete: boolean | null;
  segment: string | null;
  productName: string | null;
};

export type StatusInfo = { key: string; label: string; category: "open" | "won" | "lost" };

/** Funil: oportunidades por status, na ordem configurada. */
export function funnel(rows: OpportunityRow[], statuses: StatusInfo[]): Bar[] {
  return statuses.map((status) => ({ key: status.key, label: status.label, value: rows.filter((row) => row.status === status.key).length }));
}

/** Ganhas e perdidas entre as encerradas. A taxa só existe se houver encerradas. */
export function outcomes(rows: OpportunityRow[], statuses: StatusInfo[]) {
  const category = new Map(statuses.map((status) => [status.key, status.category]));
  const won = rows.filter((row) => category.get(row.status) === "won").length;
  const lost = rows.filter((row) => category.get(row.status) === "lost").length;
  return { total: rows.length, open: rows.length - won - lost, won, lost, winRate: won + lost > 0 ? won / (won + lost) : null };
}

export function starDistribution(rows: OpportunityRow[]): { bars: Bar[]; incomplete: number } {
  const bars: Bar[] = [5, 4, 3, 2, 1].map((stars) => ({ key: String(stars), label: `${stars} estrela${stars > 1 ? "s" : ""}`, value: rows.filter((row) => row.stars === stars).length }));
  bars.push({ key: "none", label: "Sem nota", value: rows.filter((row) => row.stars === null).length });
  return { bars, incomplete: rows.filter((row) => row.stars !== null && row.isComplete === false).length };
}

/** Maiores grupos e "Outros" para o resto; vazio aparece como "Não informado". */
export function topGroups(values: (string | null)[], limit = 8): Bar[] {
  const counts = new Map<string, number>();
  for (const value of values) {
    const key = value?.trim() || "Não informado";
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const sorted = [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "pt-BR"));
  const bars = sorted.slice(0, limit).map(([label, value]) => ({ key: label, label, value }));
  const rest = sorted.slice(limit).reduce((sum, [, value]) => sum + value, 0);
  if (rest > 0) bars.push({ key: "__outros", label: "Outros", value: rest });
  return bars;
}

export type SourceRunRow = { source: string; status: string };

export function sourceHealth(runs: SourceRunRow[]) {
  const bySource = new Map<string, { source: string; total: number; succeeded: number; failed: number; limited: number; skipped: number }>();
  for (const run of runs) {
    const entry = bySource.get(run.source) ?? { source: run.source, total: 0, succeeded: 0, failed: 0, limited: 0, skipped: 0 };
    entry.total++;
    if (run.status === "succeeded") entry.succeeded++;
    else if (run.status === "failed") entry.failed++;
    else if (run.status === "rate_limited") entry.limited++;
    else if (run.status === "skipped") entry.skipped++;
    bySource.set(run.source, entry);
  }
  return [...bySource.values()].sort((a, b) => b.total - a.total);
}

// -----------------------------------------------------------------------------
// CSV (abre direto no Excel em português: ";" e BOM UTF-8)
// -----------------------------------------------------------------------------

export type CsvColumn<T> = { header: string; value: (row: T) => string | number | boolean | null };

/** Evita que planilhas executem fórmulas vindas dos dados (CSV injection). */
function safeCell(value: string): string {
  return /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
}

function cell(value: string | number | boolean | null): string {
  if (value === null) return "";
  if (typeof value === "boolean") return value ? "sim" : "não";
  if (typeof value === "number") return Number.isFinite(value) ? String(value).replace(".", ",") : "";
  const text = safeCell(value.replace(/\r?\n/g, " "));
  return /[;"\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function toCsv<T>(rows: T[], columns: CsvColumn<T>[]): string {
  const lines = [columns.map((column) => cell(column.header)).join(";")];
  for (const row of rows) lines.push(columns.map((column) => cell(column.value(row))).join(";"));
  return `﻿${lines.join("\r\n")}\r\n`;
}
