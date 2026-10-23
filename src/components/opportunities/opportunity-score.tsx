import { Stars } from "@/components/ui/stars";

export function OpportunityScore({ score, stars, isComplete }: { score: number | null; stars: number | null; isComplete: boolean | null }) {
  if (score === null) return <span className="text-xs text-subtle-foreground">sem avaliação</span>;
  return (
    <span className="inline-flex flex-col items-end gap-1">
      <span className="tabular-nums">
        <span className="font-semibold">{score.toFixed(0)}</span>
        <span className="text-subtle-foreground">/100</span>
      </span>
      {stars !== null ? <Stars value={stars} /> : null}
      {isComplete === false ? <span className="text-[11px] text-warning-text">dados incompletos</span> : null}
    </span>
  );
}
