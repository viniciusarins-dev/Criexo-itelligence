import { Activity, ArrowLeft, BookmarkCheck, Gauge } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { InformationBadge } from "@/components/companies/information-badge";
import {
  ActivityForm,
  DiscardButton,
  RecalculateScoreButton,
  SaveToggle,
  StatusForm,
} from "@/components/opportunities/opportunity-actions";
import { StatusBadge } from "@/components/opportunities/status-badge";
import { EmptyState } from "@/components/states/empty-state";
import { Notice } from "@/components/states/notice";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Stars } from "@/components/ui/stars";
import { isClosed } from "@/domain/opportunities/opportunity";
import { SCORING_CRITERION_LABELS, type ScoringCriterion } from "@/domain/scoring";
import { formatDateTime } from "@/lib/formatting/date";
import { ACTIVITY_LABELS } from "@/lib/presentation/labels";
import { getOpportunity } from "@/server/repositories/opportunities";

export const metadata: Metadata = { title: "Oportunidade" };

export default async function OpportunityPage({ params, searchParams }: PageProps<"/oportunidades/[id]">) {
  const { id } = await params;
  const query = await searchParams;
  const opportunity = await getOpportunity(id);
  if (!opportunity) notFound();

  const { statuses, company } = opportunity;
  const current = statuses.find((status) => status.key === opportunity.status);
  const labelOf = (key: string | null) => (key ? (statuses.find((status) => status.key === key)?.label ?? key) : "");

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      <div className="space-y-4">
        <Link href="/oportunidades" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft aria-hidden="true" className="size-4" />
          Oportunidades
        </Link>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 space-y-2">
            <h1 className="text-2xl font-semibold tracking-tight break-words">
              <Link href={`/empresas/${company.id}`} className="hover:underline">
                {company.name}
              </Link>
            </h1>
            <p className="text-sm text-muted-foreground">
              {opportunity.product?.name ? `Produto: ${opportunity.product.name}` : "Sem produto definido"}
              {company.segment ? ` · ${company.segment}` : ""}
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge statusKey={opportunity.status} statuses={statuses} />
              {opportunity.isSaved ? (
                <Badge tone="brand">
                  <BookmarkCheck aria-hidden="true" />
                  Salva
                </Badge>
              ) : null}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <SaveToggle opportunityId={opportunity.id} isSaved={opportunity.isSaved} />
            {current?.category !== "lost" ? (
              <DiscardButton opportunityId={opportunity.id} statuses={statuses} companyName={company.name} />
            ) : null}
          </div>
        </div>
      </div>

      {query.criada ? <Notice tone="info" title="Oportunidade criada">Ela começa no status “{labelOf("nova")}”.</Notice> : null}
      {query.existente ? (
        <Notice tone="info" title="Esta oportunidade já existia">
          Cada empresa tem uma oportunidade por produto. Você foi levado para a que já estava registrada.
        </Notice>
      ) : null}
      {isClosed(current) ? (
        <Notice tone="pending" title={`Oportunidade encerrada: ${current?.label}`}>
          Para reabrir, escolha outro status abaixo.
        </Notice>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="flex min-w-0 flex-col gap-6">
          <Card>
            <CardHeader>
              <div className="space-y-1">
                <CardTitle>Registrar</CardTitle>
                <CardDescription>Observações e contatos ficam no histórico com data e responsável.</CardDescription>
              </div>
            </CardHeader>
            <CardContent>
              <ActivityForm opportunityId={opportunity.id} currentStatus={opportunity.status} statuses={statuses} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="space-y-1">
                <CardTitle>Histórico</CardTitle>
                <CardDescription>Nada é apagado: cada mudança fica registrada.</CardDescription>
              </div>
            </CardHeader>
            <CardContent>
              {opportunity.activities.length === 0 ? (
                <EmptyState icon={Activity} title="Sem atividades" description="Registre a primeira observação ou contato acima." className="py-6" />
              ) : (
                <ol className="space-y-4" aria-label="Histórico da oportunidade">
                  {opportunity.activities.map((activity) => (
                    <li key={activity.id} className="relative border-l border-border pl-4">
                      <span aria-hidden="true" className="absolute top-1.5 -left-[4.5px] size-2 rounded-full bg-border-strong" />
                      <p className="text-sm font-medium">{ACTIVITY_LABELS[activity.type]}</p>
                      {activity.newStatus ? (
                        <p className="text-sm text-muted-foreground">
                          {activity.previousStatus ? `${labelOf(activity.previousStatus)} → ` : ""}
                          {labelOf(activity.newStatus)}
                        </p>
                      ) : null}
                      {activity.note ? <p className="text-sm whitespace-pre-line text-muted-foreground">{activity.note}</p> : null}
                      <p className="mt-0.5 text-xs text-subtle-foreground">
                        {formatDateTime(activity.createdAt)}
                        {activity.userName ? ` · ${activity.userName}` : ""}
                      </p>
                    </li>
                  ))}
                </ol>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="flex min-w-0 flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Status comercial</CardTitle>
            </CardHeader>
            <CardContent>
              <StatusForm opportunityId={opportunity.id} current={opportunity.status} statuses={statuses} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="space-y-1">
                <CardTitle>Pontuação</CardTitle>
                {opportunity.scoreVersion ? <CardDescription>Versão {opportunity.scoreVersion} dos critérios</CardDescription> : null}
              </div>
              <RecalculateScoreButton opportunityId={opportunity.id} />
            </CardHeader>
            <CardContent>
              {opportunity.score === null ? (
                <EmptyState
                  icon={Gauge}
                  title="Sem avaliação"
                  description="Esta oportunidade ainda não foi avaliada. A pontuação é calculada quando uma pesquisa encontra a empresa; sem localização nem avaliação da IA, não há o que pontuar."
                  className="py-4"
                />
              ) : (
                <div className="space-y-4">
                  <div className="flex items-end justify-between gap-3">
                    <p>
                      <span className="text-3xl font-semibold">{opportunity.score.toFixed(0)}</span>
                      <span className="text-subtle-foreground">/100</span>
                    </p>
                    {opportunity.stars !== null ? <Stars value={opportunity.stars} /> : null}
                  </div>
                  {opportunity.scoreDetails && !opportunity.isComplete ? (
                    <p className="text-xs text-warning-text">
                      Dados incompletos: a nota pode ficar entre {opportunity.scoreDetails.scoreMin.toFixed(0)} e{" "}
                      {opportunity.scoreDetails.scoreMax.toFixed(0)}.
                    </p>
                  ) : null}
                  <p className="text-sm text-muted-foreground">
                    Confiança: {opportunity.confidence === null ? "—" : `${opportunity.confidence.toFixed(0)}%`}
                  </p>
                  {opportunity.scoreDetails ? (
                    <ul className="divide-y divide-border text-sm">
                      {opportunity.scoreDetails.breakdowns.map((item) => (
                        <li key={item.criterion} className="space-y-1 py-2.5">
                          <div className="flex items-center justify-between gap-2">
                            <span>{SCORING_CRITERION_LABELS[item.criterion as ScoringCriterion] ?? item.criterion}</span>
                            <span className="tabular-nums">
                              {item.rawScore === null ? "desconhecido" : `${item.rawScore.toFixed(0)}/100`}
                            </span>
                          </div>
                          <div className="flex items-center justify-between gap-2 text-xs text-subtle-foreground">
                            <span>Peso {Math.round(item.weight * 100)}%</span>
                            <InformationBadge status={item.informationStatus} />
                          </div>
                          {item.evidence.map((entry, index) => (
                            <p key={index} className="text-xs text-muted-foreground">
                              {entry.statement}
                              {entry.source ? <span className="text-subtle-foreground"> — {entry.source}</span> : null}
                            </p>
                          ))}
                          {item.notes.map((note) => (
                            <p key={note} className="text-xs text-warning-text">
                              {note}
                            </p>
                          ))}
                          {item.missingData.length ? (
                            <p className="text-xs text-muted-foreground">Falta: {item.missingData.join(" · ")}</p>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              )}
            </CardContent>
          </Card>

          <p className="text-xs text-subtle-foreground">
            Criada em {formatDateTime(opportunity.createdAt)}
            {opportunity.createdByName ? ` por ${opportunity.createdByName}` : ""}
            {opportunity.savedAt ? ` · salva em ${formatDateTime(opportunity.savedAt)}` : ""}
          </p>
        </div>
      </div>
    </div>
  );
}
