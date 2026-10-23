import { ArrowLeft, Building2, Check, Lightbulb, RefreshCw } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";

import { IdeaDecision } from "@/components/ideas/idea-decision";
import { ApprovalBadge, IdeaDetails, OriginBadge, SimilarIdeasWarning } from "@/components/ideas/idea-summary";
import { ManualIdeaDialog } from "@/components/ideas/manual-idea-form";
import { GenerateIdeasButton, RerunButton, RunSearchButton } from "@/components/research/research-actions";
import { EmptyState } from "@/components/states/empty-state";
import { Notice } from "@/components/states/notice";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { canSearch, RESULT_TARGET } from "@/domain/research/research";
import { formatDateTime } from "@/lib/formatting/date";
import { formatDistanceKm } from "@/lib/formatting/numbers";
import { RESEARCH_STATUS, RESEARCH_TYPE_LABELS, SOURCE_RUN_STATUS } from "@/lib/presentation/labels";
import { cn } from "@/lib/utils";
import { getResearch } from "@/server/repositories/research";

export const metadata: Metadata = { title: "Pesquisa" };

const PRE_SEARCH = ["draft", "awaiting_approval", "ready"];

function Step({ index, label, done, current }: { index: number; label: string; done: boolean; current: boolean }) {
  return (
    <li
      aria-current={current ? "step" : undefined}
      className={cn(
        "flex items-center gap-2 rounded-md border px-3 py-2 text-sm",
        current ? "border-primary/40 bg-primary-subtle text-foreground" : "border-border bg-surface text-muted-foreground",
      )}
    >
      <span
        className={cn(
          "flex size-5 shrink-0 items-center justify-center rounded-full text-xs font-medium",
          done ? "bg-success-subtle text-success-text" : "bg-surface-raised text-foreground",
        )}
      >
        {done ? <Check aria-hidden="true" className="size-3" /> : index}
      </span>
      {label}
      {done ? <span className="sr-only">(concluída)</span> : null}
    </li>
  );
}

function Info({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-subtle-foreground">{label}</dt>
      <dd className="text-sm break-words">{children}</dd>
    </div>
  );
}

export default async function ResearchPage({ params }: PageProps<"/pesquisas/[id]">) {
  const { id } = await params;
  const research = await getResearch(id);
  if (!research) notFound();

  const { session, snapshot, ideas, runs, results, ai, reruns } = research;
  const status = RESEARCH_STATUS[session.status];
  const preSearch = PRE_SEARCH.includes(session.status);
  const decisions = ideas.map((idea) => idea.approvalStatus);
  const ready = canSearch(decisions);
  const pendingCount = decisions.filter((value) => value === "pending").length;
  const approvedCount = decisions.filter((value) => value === "approved").length;
  const searched = !preSearch && session.status !== "running";
  const steps = [
    { label: "Parâmetros", done: true },
    { label: "Ideias de produto", done: ideas.length > 0 },
    { label: "Aprovação", done: ready || !preSearch },
    { label: "Busca de empresas", done: searched },
  ];
  const currentStep = steps.findIndex((step) => !step.done);
  const toConfirm = <span className="text-warning-text">A confirmar</span>;

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      <div className="space-y-4">
        <Link href="/pesquisas" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft aria-hidden="true" className="size-4" />
          Pesquisas anteriores
        </Link>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 space-y-2">
            <h1 className="text-2xl font-semibold tracking-tight break-words">{session.query}</h1>
            <p className="text-sm text-muted-foreground">
              {RESEARCH_TYPE_LABELS[session.research_type]} · criada em {formatDateTime(session.created_at)}
              {research.createdByName ? ` por ${research.createdByName}` : ""}
            </p>
            <Badge tone={status.tone}>{status.label}</Badge>
          </div>
          {searched ? <RerunButton researchSessionId={session.id} /> : null}
        </div>
      </div>

      {session.rerun_of ? (
        <Notice tone="info" title="Nova execução">
          Esta pesquisa repete a <Link href={`/pesquisas/${session.rerun_of}`} className="underline">pesquisa original</Link>{" "}
          e reaproveita as ideias dela. Os resultados anteriores continuam guardados lá.
        </Notice>
      ) : null}

      <ol className="grid gap-2 sm:grid-cols-4" aria-label="Etapas da pesquisa">
        {steps.map((step, index) => (
          <Step key={step.label} index={index + 1} label={step.label} done={step.done} current={index === currentStep} />
        ))}
      </ol>

      <Card>
        <CardHeader>
          <div className="space-y-1">
            <CardTitle>Parâmetros e configurações usadas</CardTitle>
            <CardDescription>Cópia gravada quando a pesquisa foi criada.</CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Info label="Objetivo">{session.objective ?? <span className="text-subtle-foreground">Não informado</span>}</Info>
            <Info label="Região">
              {session.region_label ?? toConfirm}
              {session.radius_km !== null ? ` · raio de ${formatDistanceKm(Number(session.radius_km))}` : null}
            </Info>
            <Info label="Capacidade produtiva">{snapshot?.capacitySummary ?? toConfirm}</Info>
            <Info label="Pontuação">{snapshot?.scoringVersion != null ? `Versão ${snapshot.scoringVersion}` : toConfirm}</Info>
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-col items-start gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            <CardTitle>Ideias de produto</CardTitle>
            <CardDescription>
              Aprove ou rejeite cada ideia. A busca só começa sem ideias pendentes e com ao menos uma aprovada.
            </CardDescription>
          </div>
          {preSearch ? (
            <div className="flex flex-wrap gap-2">
              {ai.configured ? <GenerateIdeasButton researchSessionId={session.id} /> : null}
              <ManualIdeaDialog researchSessionId={session.id} />
            </div>
          ) : null}
        </CardHeader>
        <CardContent className="space-y-4">
          {preSearch && !ai.configured ? (
            <Notice tone="pending" title="IA não configurada">
              As sugestões automáticas ficam indisponíveis até o servidor ter {ai.missing.join(", ")}. Cadastre ideias manualmente.
            </Notice>
          ) : null}
          {preSearch && ai.configured ? (
            <p className="text-xs text-muted-foreground">
              IA: {ai.provider} ({ai.model}) · {ai.usedToday} de {ai.dailyLimit} uso(s) hoje. Sugestões da IA são inferências e
              precisam da sua aprovação.
            </p>
          ) : null}
          {ideas.length === 0 ? (
            <EmptyState
              icon={Lightbulb}
              title="Nenhuma ideia ainda"
              description={ai.configured ? "Peça sugestões à IA ou cadastre uma ideia manualmente." : "Cadastre uma ideia manualmente para continuar."}
            />
          ) : (
            <ul className="space-y-3" aria-label="Ideias da pesquisa">
              {ideas.map((idea) => (
                <li key={idea.id} className="space-y-3 rounded-lg border border-border bg-surface-sunken p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0 space-y-2">
                      <Link href={`/produtos/${idea.id}`} className="font-medium break-words hover:underline">
                        {idea.name}
                      </Link>
                      <div className="flex flex-wrap gap-2">
                        <ApprovalBadge status={idea.approvalStatus} />
                        <OriginBadge origin={idea.origin} />
                      </div>
                    </div>
                    {preSearch ? <IdeaDecision ideaId={idea.id} ideaName={idea.name} status={idea.approvalStatus} /> : null}
                  </div>
                  <SimilarIdeasWarning similar={idea.similar} />
                  <details className="group">
                    <summary className="cursor-pointer text-sm text-muted-foreground hover:text-foreground">Ver detalhes</summary>
                    <div className="mt-3">
                      <IdeaDetails idea={idea} />
                    </div>
                  </details>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-col items-start gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            <CardTitle>Busca de empresas</CardTitle>
            <CardDescription>
              Nesta etapa a busca usa somente as empresas já cadastradas (base interna). Fontes externas entram na próxima etapa.
            </CardDescription>
          </div>
          {preSearch ? <RunSearchButton researchSessionId={session.id} disabled={!ready || session.status !== "ready"} /> : null}
        </CardHeader>
        <CardContent className="space-y-4">
          {preSearch ? (
            <p className="text-sm text-muted-foreground" aria-live="polite">
              {ready
                ? `${approvedCount} ideia(s) aprovada(s). A busca procura empresas pelo segmento ou produto da pesquisa e pelos segmentos-alvo das ideias aprovadas.`
                : pendingCount
                  ? `${pendingCount} ideia(s) aguardando decisão.`
                  : "Aprove ao menos uma ideia para liberar a busca."}
            </p>
          ) : null}
          {session.status === "running" ? (
            <Notice tone="info" title="Busca em execução">
              Atualize a página em alguns instantes.
            </Notice>
          ) : null}
          {session.status === "failed" ? (
            <Notice tone="danger" title="A busca falhou">
              {session.error_message ?? "Nenhum resultado foi registrado."} Use “Executar novamente” para tentar outra vez.
            </Notice>
          ) : null}
          {session.status === "partial" ? (
            <Notice tone="warning" title="Resultado parcial">
              {results.length === 0 ? "Nenhuma empresa encontrada" : `${results.length} empresa(s) encontrada(s)`}; o esperado é de{" "}
              {RESULT_TARGET.min} a {RESULT_TARGET.max}. Nenhuma empresa foi incluída só para completar a lista.
            </Notice>
          ) : null}

          {runs.length ? (
            <ul className="space-y-2" aria-label="Fontes consultadas">
              {runs.map((run) => (
                <li key={run.id} className="flex flex-col gap-1 rounded-md border border-border px-3 py-2 text-sm sm:flex-row sm:items-center sm:justify-between">
                  <span className="font-medium">{run.source_name}</span>
                  <span className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <Badge tone={SOURCE_RUN_STATUS[run.status].tone}>{SOURCE_RUN_STATUS[run.status].label}</Badge>
                    {run.results_count !== null ? `${run.results_count} empresa(s)` : null}
                    {run.finished_at ? ` · ${formatDateTime(run.finished_at)}` : null}
                    {run.error_message ? <span className="text-danger-text">{run.error_message}</span> : null}
                  </span>
                </li>
              ))}
            </ul>
          ) : null}

          {results.length ? (
            <ol className="space-y-3" aria-label="Empresas encontradas">
              {results.map((result) => (
                <li key={result.company.id} className="rounded-lg border border-border bg-surface-sunken p-4">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <Link href={`/empresas/${result.company.id}`} className="font-medium break-words hover:underline">
                        {result.company.name}
                      </Link>
                      <p className="text-xs text-subtle-foreground">
                        {[result.company.segment, result.company.place].filter(Boolean).join(" · ") || "Segmento e local não informados"}
                      </p>
                    </div>
                    <span className="text-sm text-muted-foreground tabular-nums">
                      {result.distanceKm === null ? "Distância desconhecida" : formatDistanceKm(result.distanceKm)}
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {result.reason} · fonte: {result.source}
                  </p>
                  <ul className="mt-3 flex flex-wrap gap-2" aria-label={`Oportunidades com ${result.company.name}`}>
                    {result.opportunities.map((opportunity) => (
                      <li key={opportunity.id}>
                        <Link
                          href={`/oportunidades/${opportunity.id}`}
                          className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface px-2.5 py-1 text-xs hover:border-border-strong"
                        >
                          <Building2 aria-hidden="true" className="size-3" />
                          {opportunity.productName ?? "Sem produto"}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ol>
          ) : searched && session.status !== "failed" ? (
            <p className="text-sm text-muted-foreground">
              Nenhuma empresa cadastrada corresponde à pesquisa. Cadastre empresas em <Link href="/empresas/nova" className="underline">Empresas</Link> e execute novamente.
            </p>
          ) : null}
        </CardContent>
      </Card>

      {reruns.length ? (
        <Card>
          <CardHeader>
            <CardTitle>Outras execuções desta pesquisa</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {reruns.map((rerun) => (
                <li key={rerun.id} className="flex items-center justify-between gap-3 text-sm">
                  <Link href={`/pesquisas/${rerun.id}`} className="inline-flex items-center gap-1.5 hover:underline">
                    <RefreshCw aria-hidden="true" className="size-3.5 text-subtle-foreground" />
                    {formatDateTime(rerun.created_at)}
                  </Link>
                  <Badge tone={RESEARCH_STATUS[rerun.status].tone}>{RESEARCH_STATUS[rerun.status].label}</Badge>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
