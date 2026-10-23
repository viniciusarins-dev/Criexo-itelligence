import type { Bar } from "@/domain/reports/reports";

/**
 * Barras horizontais de um só tom (a cor não codifica categoria). O valor
 * fica escrito ao lado de cada barra, então a lista também serve de tabela.
 */
export function BarList({ bars, label, emptyText }: { bars: Bar[]; label: string; emptyText: string }) {
  const max = Math.max(0, ...bars.map((bar) => bar.value));
  if (max === 0) return <p className="text-sm text-muted-foreground">{emptyText}</p>;
  return (
    <ul className="space-y-2.5" aria-label={label}>
      {bars.map((bar) => (
        <li key={bar.key} className="grid grid-cols-[minmax(0,11rem)_1fr_2.75rem] items-center gap-3 text-sm" title={`${bar.label}: ${bar.value}`}>
          <span className="truncate text-muted-foreground">{bar.label}</span>
          <span className="relative h-2.5 rounded-r-[4px] bg-border/40" aria-hidden="true">
            {bar.value > 0 ? (
              <span className="absolute inset-y-0 left-0 rounded-r-[4px] bg-primary/80" style={{ width: `max(${(bar.value / max) * 100}%, 4px)` }} />
            ) : null}
          </span>
          <span className="text-right font-medium tabular-nums">{bar.value.toLocaleString("pt-BR")}</span>
        </li>
      ))}
    </ul>
  );
}
