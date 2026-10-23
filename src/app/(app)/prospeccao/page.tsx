import { Bot, Factory, Gauge, MapPin } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";

import { ResearchForm } from "@/app/(app)/prospeccao/research-form";
import { Notice } from "@/components/states/notice";
import { PageHeader } from "@/components/states/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDistanceKm } from "@/lib/formatting/numbers";
import { loadNewResearchContext } from "@/server/repositories/research";

export const metadata: Metadata = { title: "Nova prospecção" };

function Item({ icon: Icon, label, children }: { icon: typeof MapPin; label: string; children: ReactNode }) {
  return (
    <div className="flex gap-3">
      <Icon aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-subtle-foreground" />
      <div className="min-w-0 space-y-0.5">
        <p className="text-xs text-subtle-foreground">{label}</p>
        <div className="text-sm break-words">{children}</div>
      </div>
    </div>
  );
}

export default async function NewResearchPage() {
  const { snapshot, ai } = await loadNewResearchContext();
  const pending = <span className="text-warning-text">A confirmar</span>;

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      <PageHeader
        title="Nova prospecção"
        description="Defina o que procurar. Depois você aprova as ideias de produto, uma a uma, antes de buscar empresas."
      />

      <ol className="grid gap-2 text-sm text-muted-foreground sm:grid-cols-4" aria-label="Etapas da pesquisa">
        {["Parâmetros", "Ideias de produto", "Aprovação", "Busca de empresas"].map((step, index) => (
          <li key={step} className="flex items-center gap-2 rounded-md border border-border bg-surface px-3 py-2">
            <span className="flex size-5 items-center justify-center rounded-full bg-surface-raised text-xs font-medium text-foreground">{index + 1}</span>
            {step}
          </li>
        ))}
      </ol>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <Card>
          <CardHeader>
            <div className="space-y-1">
              <CardTitle>Parâmetros</CardTitle>
              <CardDescription>Validados aqui e novamente no servidor.</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <ResearchForm />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="space-y-1">
              <CardTitle>Configurações usadas</CardTitle>
              <CardDescription>Uma cópia fica gravada na pesquisa, para que ela continue explicável.</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <Item icon={MapPin} label="Região">
              {snapshot.geoReference ? snapshot.geoReference.address : pending}
              {snapshot.radiusKm !== null ? ` · raio de ${formatDistanceKm(snapshot.radiusKm)}` : null}
            </Item>
            <Item icon={Factory} label="Capacidade produtiva">
              {snapshot.capacitySummary ?? pending}
            </Item>
            <Item icon={Gauge} label="Pontuação">
              {snapshot.scoringVersion !== null ? `Versão ${snapshot.scoringVersion}` : pending}
            </Item>
            <Item icon={Bot} label="Inteligência artificial">
              {ai.configured ? (
                `${ai.provider} (${ai.model}) · ${ai.usedToday} de ${ai.dailyLimit} uso(s) hoje`
              ) : (
                <span className="text-warning-text">Não configurada</span>
              )}
            </Item>
            {!snapshot.geoReference || snapshot.radiusKm === null ? (
              <Notice tone="warning" title="Região incompleta">
                Defina o ponto de referência e o raio em <Link href="/configuracoes" className="underline">Configurações</Link>.
              </Notice>
            ) : null}
            {!ai.configured ? (
              <Notice tone="pending" title="Sugestões da IA indisponíveis">
                Você ainda pode cadastrar ideias manualmente. Para ativar, defina {ai.missing.join(", ")} no ambiente do servidor.
              </Notice>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
