import { AlertTriangle, Bot, PencilLine } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { InformationBadge } from "@/components/companies/information-badge";
import { Badge } from "@/components/ui/badge";
import { formatDateTime } from "@/lib/formatting/date";
import { APPROVAL_STATUS, IDEA_ORIGIN_LABELS } from "@/lib/presentation/labels";
import type { IdeaView } from "@/server/repositories/research";

export function ApprovalBadge({ status }: { status: IdeaView["approvalStatus"] }) {
  const { label, tone } = APPROVAL_STATUS[status];
  return <Badge tone={tone}>{label}</Badge>;
}

export function OriginBadge({ origin }: { origin: IdeaView["origin"] }) {
  const Icon = origin === "ai" ? Bot : PencilLine;
  return (
    <Badge tone={origin === "ai" ? "warning" : "neutral"}>
      <Icon aria-hidden="true" />
      {IDEA_ORIGIN_LABELS[origin]}
    </Badge>
  );
}

const SIMILAR_SHOWN = 5;

/** Aviso de duplicidade (seção 4.7): mostra, não une nem bloqueia. */
export function SimilarIdeasWarning({ similar }: { similar: IdeaView["similar"] }) {
  if (similar.length === 0) return null;
  return (
    <div role="status" className="flex gap-2 rounded-md border border-warning/30 bg-warning-subtle px-3 py-2 text-sm text-warning-text">
      <AlertTriangle aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
      <div className="min-w-0">
        <p className="font-medium">Ideia parecida já registrada</p>
        <ul className="mt-1 space-y-0.5 text-muted-foreground">
          {similar.slice(0, SIMILAR_SHOWN).map((item) => (
            <li key={item.id}>
              <Link href={`/produtos/${item.id}`} className="hover:underline">
                {item.name}
              </Link>{" "}
              · {APPROVAL_STATUS[item.approvalStatus].label.toLowerCase()}
            </li>
          ))}
        </ul>
        {similar.length > SIMILAR_SHOWN ? (
          <p className="mt-1 text-xs text-muted-foreground">e mais {similar.length - SIMILAR_SHOWN} ideia(s) parecida(s) em Produtos e ideias.</p>
        ) : null}
      </div>
    </div>
  );
}

function Detail({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-subtle-foreground">{label}</dt>
      <dd className="text-sm break-words whitespace-pre-line">{children}</dd>
    </div>
  );
}

/** Campos descritivos de uma ideia; vazios aparecem como "não informado", nunca preenchidos. */
export function IdeaDetails({ idea }: { idea: IdeaView }) {
  const missing = <span className="text-subtle-foreground">Não informado</span>;
  return (
    <div className="space-y-4">
      <dl className="grid gap-3 sm:grid-cols-2">
        <Detail label="Problema que resolve">{idea.problemStatement ?? missing}</Detail>
        <Detail label="Segmento-alvo">{idea.targetSegment ?? missing}</Detail>
        <Detail label="Aplicação proposta">{idea.proposedApplication ?? missing}</Detail>
        <Detail label="Benefício esperado">{idea.expectedBenefit ?? missing}</Detail>
        {idea.description ? <Detail label="Descrição">{idea.description}</Detail> : null}
        {idea.technicalConstraints ? <Detail label="Dificuldades técnicas">{idea.technicalConstraints}</Detail> : null}
        {idea.missingInformation ? <Detail label="Informações que faltam">{idea.missingInformation}</Detail> : null}
      </dl>
      {idea.evidence.length ? (
        <div className="space-y-2">
          <p className="text-xs text-subtle-foreground">Premissas e evidências</p>
          <ul className="space-y-2">
            {idea.evidence.map((item, index) => (
              <li key={index} className="flex flex-col gap-1 rounded-md border border-border bg-surface-sunken px-3 py-2 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
                <span className="min-w-0 text-sm break-words">{item.statement}</span>
                <span className="flex shrink-0 flex-wrap items-center gap-2">
                  <InformationBadge status={item.status} />
                  {item.source ? <span className="text-xs text-subtle-foreground">{item.source}</span> : null}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {idea.decidedAt ? (
        <p className="text-xs text-muted-foreground">
          {APPROVAL_STATUS[idea.approvalStatus].label} por {idea.decidedBy ?? "usuário removido"} em {formatDateTime(idea.decidedAt)}
          {idea.decisionNote ? ` — “${idea.decisionNote}”` : ""}
        </p>
      ) : null}
    </div>
  );
}
