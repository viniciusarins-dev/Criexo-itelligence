import { ArrowLeft, CheckCircle2, ExternalLink } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { DuplicateDecision } from "@/components/companies/duplicate-decision";
import { EmptyState } from "@/components/states/empty-state";
import { PageHeader } from "@/components/states/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDateTime } from "@/lib/formatting/date";
import { cn } from "@/lib/utils";
import { listDuplicateReviews, type DuplicateReviewView } from "@/server/repositories/duplicates";

export const metadata: Metadata = { title: "Possíveis duplicidades" };

function Comparison({ review }: { review: DuplicateReviewView }) {
  const missing = <span className="text-subtle-foreground">—</span>;
  return (
    <div>
      <table className="w-full table-fixed text-sm">
        <colgroup>
          <col className="w-24 sm:w-36" />
          <col />
          <col />
        </colgroup>
        <thead>
          <tr className="border-b border-border text-left text-xs text-muted-foreground">
            <th className="py-2 pr-3 font-medium">Campo</th>
            <th className="py-2 pr-3 font-medium">Já cadastrada</th>
            <th className="py-2 font-medium">Na fonte ({review.source})</th>
          </tr>
        </thead>
        <tbody>
          {review.comparison
            .filter((row) => row.existing || row.candidate)
            .map((row) => (
              <tr key={row.field} className="border-b border-border last:border-0">
                <td className="py-2 pr-3 align-top text-muted-foreground">{row.label}</td>
                <td className="py-2 pr-3 align-top break-words">{row.existing ?? missing}</td>
                <td className={cn("py-2 align-top break-words", row.same ? "text-success-text" : row.wouldFill ? "text-info-text" : "")}>
                  {row.candidate ?? missing}
                  {row.same ? <span className="sr-only"> (igual)</span> : null}
                  {row.wouldFill ? <span className="ml-1 text-xs">(completaria o cadastro)</span> : null}
                </td>
              </tr>
            ))}
        </tbody>
      </table>
    </div>
  );
}

export default async function DuplicatesPage() {
  const [pending, decided] = await Promise.all([listDuplicateReviews("pending"), listDuplicateReviews("decided")]);

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <Link href="/empresas" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft aria-hidden="true" className="size-4" />
        Empresas
      </Link>
      <PageHeader
        title="Possíveis duplicidades"
        description="Registros das fontes que parecem ser empresas já cadastradas. Nada é unido até alguém decidir; a decisão fica registrada."
      />

      {pending.length === 0 ? (
        <Card>
          <EmptyState icon={CheckCircle2} title="Nada para revisar" description="Quando uma pesquisa encontrar uma empresa parecida com uma já cadastrada, ela aparece aqui." />
        </Card>
      ) : (
        <ul className="space-y-4" aria-label="Revisões pendentes">
          {pending.map((review) => (
            <li key={review.id}>
              <Card>
                <CardHeader className="flex-col items-start gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0 space-y-1">
                    <CardTitle className="break-words">
                      {review.candidateName} × <Link href={`/empresas/${review.company.id}`} className="hover:underline">{review.company.name}</Link>
                    </CardTitle>
                    <p className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <Badge tone="warning">Coincide: {review.reasons.join(", ") || "dados parecidos"}</Badge>
                      Encontrada em {formatDateTime(review.createdAt)}
                      {review.sourceUrl ? (
                        <a href={review.sourceUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-primary-text hover:underline">
                          Ver na fonte
                          <ExternalLink aria-hidden="true" className="size-3" />
                        </a>
                      ) : null}
                    </p>
                  </div>
                  <DuplicateDecision
                    reviewId={review.id}
                    companyName={review.company.name}
                    candidateName={review.candidateName}
                    fillCount={review.comparison.filter((row) => row.wouldFill).length}
                  />
                </CardHeader>
                <CardContent>
                  <Comparison review={review} />
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}

      {decided.length ? (
        <Card>
          <CardHeader>
            <CardTitle>Decisões anteriores</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="divide-y divide-border text-sm" aria-label="Decisões anteriores">
              {decided.map((review) => (
                <li key={review.id} className="flex flex-col gap-1 py-2.5 sm:flex-row sm:items-center sm:justify-between">
                  <span className="min-w-0 break-words">
                    {review.candidateName} →{" "}
                    {review.resolvedCompanyId ? (
                      <Link href={`/empresas/${review.resolvedCompanyId}`} className="hover:underline">
                        {review.status === "same_company" ? `mesma que “${review.company.name}”` : "cadastrada como nova"}
                      </Link>
                    ) : null}
                    {review.note ? <span className="text-muted-foreground"> — “{review.note}”</span> : null}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {review.decidedBy ?? "Usuário removido"} · {review.decidedAt ? formatDateTime(review.decidedAt) : ""}
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
