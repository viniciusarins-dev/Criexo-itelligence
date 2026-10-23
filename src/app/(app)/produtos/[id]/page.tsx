import { ArrowLeft, History, Target } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { IdeaDecision } from "@/components/ideas/idea-decision";
import { ApprovalBadge, IdeaDetails, OriginBadge, SimilarIdeasWarning } from "@/components/ideas/idea-summary";
import { EmptyState } from "@/components/states/empty-state";
import { Notice } from "@/components/states/notice";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDateTime } from "@/lib/formatting/date";
import { APPROVAL_STATUS } from "@/lib/presentation/labels";
import { getIdea } from "@/server/repositories/research";

export const metadata: Metadata = { title: "Ideia de produto" };

export default async function IdeaPage({ params }: PageProps<"/produtos/[id]">) {
  const { id } = await params;
  const data = await getIdea(id);
  if (!data) notFound();
  const { idea, decisions, opportunities, researchSessionId } = data;

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      <div className="space-y-4">
        <Link href="/produtos" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft aria-hidden="true" className="size-4" />
          Produtos e ideias
        </Link>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 space-y-2">
            <h1 className="text-2xl font-semibold tracking-tight break-words">{idea.name}</h1>
            <p className="text-sm text-muted-foreground">
              Registrada em {formatDateTime(idea.createdAt)}
              {idea.aiProvider ? ` · sugerida por ${idea.aiProvider}` : ""}
              {researchSessionId ? (
                <>
                  {" · "}
                  <Link href={`/pesquisas/${researchSessionId}`} className="underline">
                    ver pesquisa
                  </Link>
                </>
              ) : null}
            </p>
            <div className="flex flex-wrap gap-2">
              <ApprovalBadge status={idea.approvalStatus} />
              <OriginBadge origin={idea.origin} />
            </div>
          </div>
          <IdeaDecision ideaId={idea.id} ideaName={idea.name} status={idea.approvalStatus} />
        </div>
      </div>

      {idea.origin === "ai" ? (
        <Notice tone="warning" title="Sugestão da IA">
          O conteúdo desta ideia é uma inferência e não foi verificado. Revise antes de oferecer o produto.
        </Notice>
      ) : null}
      <SimilarIdeasWarning similar={idea.similar} />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <Card>
          <CardHeader>
            <CardTitle>Detalhes</CardTitle>
          </CardHeader>
          <CardContent>
            <IdeaDetails idea={idea} />
          </CardContent>
        </Card>

        <div className="flex min-w-0 flex-col gap-6">
          <Card>
            <CardHeader>
              <div className="space-y-1">
                <CardTitle>Oportunidades</CardTitle>
                <CardDescription>Empresas para as quais esta ideia foi associada.</CardDescription>
              </div>
            </CardHeader>
            <CardContent>
              {opportunities.length === 0 ? (
                <EmptyState icon={Target} title="Nenhuma oportunidade" description="Aprovada, a ideia gera oportunidades quando a busca de uma pesquisa encontra empresas." />
              ) : (
                <ul className="space-y-2">
                  {opportunities.map((opportunity) => (
                    <li key={opportunity.id}>
                      <Link href={`/oportunidades/${opportunity.id}`} className="text-sm hover:underline">
                        {opportunity.companyName}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="space-y-1">
                <CardTitle>Histórico de decisões</CardTitle>
                <CardDescription>Nada é apagado.</CardDescription>
              </div>
            </CardHeader>
            <CardContent>
              {decisions.length === 0 ? (
                <EmptyState icon={History} title="Sem decisões" description="A ideia ainda aguarda aprovação ou rejeição." />
              ) : (
                <ol className="space-y-3">
                  {decisions.map((decision) => (
                    <li key={decision.id} className="text-sm">
                      <p>
                        {APPROVAL_STATUS[decision.previousStatus].label} → <span className="font-medium">{APPROVAL_STATUS[decision.newStatus].label}</span>
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {decision.decidedBy ?? "Usuário removido"} · {formatDateTime(decision.createdAt)}
                      </p>
                      {decision.note ? <p className="mt-1 text-xs text-muted-foreground">“{decision.note}”</p> : null}
                    </li>
                  ))}
                </ol>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
