import { Badge } from "@/components/ui/badge";
import { SCORING_CRITERIA, SCORING_CRITERION_LABELS, type ScoringConfig } from "@/domain/scoring";

export function ScoringSummary({
  version,
  approvalState,
  notes,
  config,
}: {
  version: number;
  approvalState: "proposal" | "approved";
  notes: string | null;
  config: ScoringConfig;
}) {
  const bands = config.starBands;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium">Versão {version}</span>
        {approvalState === "approved" ? <Badge tone="success">Aprovada</Badge> : <Badge tone="warning">Proposta</Badge>}
      </div>
      {notes ? <p className="max-w-2xl text-sm text-muted-foreground">{notes}</p> : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="min-w-0">
          <h3 className="mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">Peso de cada critério</h3>
          <dl className="divide-y divide-border rounded-md border border-border">
            {SCORING_CRITERIA.map((criterion) => (
              <div key={criterion} className="flex items-center justify-between gap-4 px-3 py-2.5 text-sm">
                <dt className="text-muted-foreground">{SCORING_CRITERION_LABELS[criterion]}</dt>
                <dd className="font-semibold tabular-nums">{Math.round(config.weights[criterion] * 100)}%</dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="min-w-0">
          <h3 className="mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">Estrelas</h3>
          <dl className="divide-y divide-border rounded-md border border-border">
            {bands.map((band, index) => {
              const max = index < bands.length - 1 ? bands[index + 1].minScore - 1 : 100;
              return (
                <div key={band.stars} className="flex items-center justify-between gap-4 px-3 py-2.5 text-sm">
                  <dt className="text-muted-foreground tabular-nums">
                    {band.minScore} a {max}
                  </dt>
                  <dd className="font-semibold">
                    {band.stars} {band.stars === 1 ? "estrela" : "estrelas"}
                  </dd>
                </div>
              );
            })}
          </dl>
        </div>
      </div>

      <div>
        <h3 className="mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">Regras</h3>
        <ul className="space-y-2 text-sm text-muted-foreground">
          <li>
            <span className="text-foreground">Qualificada:</span>{" "}
            {config.qualificationMinScore === null ? "nota mínima não definida." : `nota a partir de ${config.qualificationMinScore}.`}
          </li>
          <li>
            <span className="text-foreground">Distância não compensa falta de compatibilidade:</span> com compatibilidade
            abaixo de {config.proximityRequiresFit.minProductFitScore}, a proximidade não conta.
          </li>
          <li>
            <span className="text-foreground">Peça inviável:</span> nota máxima de {config.infeasibleScoreCap}.
          </li>
          <li>
            <span className="text-foreground">Endereço não confirmado:</span> nota de proximidade limitada a{" "}
            {config.proximity.unverifiedMaxScore}.
          </li>
          <li>
            <span className="text-foreground">Dados ausentes:</span> a nota usa só o que é conhecido e mostra a faixa possível.
          </li>
        </ul>
      </div>
      <p className="text-xs text-subtle-foreground">
        Uma alteração de pesos ou regras cria uma nova versão; as notas já calculadas mantêm a versão usada.
      </p>
    </div>
  );
}
