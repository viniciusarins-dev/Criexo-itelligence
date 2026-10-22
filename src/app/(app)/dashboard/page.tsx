import type { Metadata } from "next";
import Link from "next/link";
import { Building2, CheckCircle2, Handshake, ListChecks, Radar, Search, Trophy } from "lucide-react";

import { PriorityOpportunities } from "@/components/dashboard/priority-opportunities";
import { RecentActivity } from "@/components/dashboard/recent-activity";
import { RecentResearch } from "@/components/dashboard/recent-research";
import { StatTile } from "@/components/dashboard/stat-tile";
import { StatusDistribution } from "@/components/dashboard/status-distribution";
import { Notice } from "@/components/states/notice";
import { PageHeader } from "@/components/states/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { loadDashboard } from "@/server/repositories/dashboard";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const now = new Date();
  const data = await loadDashboard(now);

  const byStatus = Object.fromEntries(data.statusCounts.map((count) => [count.key, count.total]));
  const statusLabels = Object.fromEntries(data.statusCounts.map((count) => [count.key, count.label]));

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6">
      <PageHeader
        eyebrow="CRIEXO Intelligence"
        title="Prospecção comercial"
        description="Visão geral das empresas, oportunidades e pesquisas registradas. Todos os números são calculados a partir do banco de dados."
        actions={
          <Button variant="secondary" disabled>
            <Radar aria-hidden="true" />
            Nova prospecção (em desenvolvimento)
          </Button>
        }
      />

      {data.scoringConfigIsProposal ? (
        <Notice tone="pending" title={`Pontuação em validação (versão ${data.scoringConfigVersion ?? "—"})`}>
          Os pesos e intervalos de estrelas vigentes são uma proposta e ainda não foram aprovados.
        </Notice>
      ) : null}

      {data.missingSettings.length > 0 ? (
        <Notice tone="warning" title={`Configuração pendente: ${data.missingSettings.join(" e ")}`}>
          Sem esses dados, proximidade e viabilidade ficam como desconhecidas nas avaliações.{" "}
          <Link href="/configuracoes" className="font-medium text-foreground underline underline-offset-4">
            Abrir configurações
          </Link>
        </Notice>
      ) : null}

      <section aria-label="Indicadores" className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <StatTile label="Empresas cadastradas" value={data.companiesTotal} hint="Base total" icon={Building2} accent />
        <StatTile label="Para analisar" value={byStatus.para_analisar ?? 0} hint="Oportunidades nesse status" icon={ListChecks} />
        <StatTile label="Em negociação" value={byStatus.em_negociacao ?? 0} hint="Oportunidades nesse status" icon={Handshake} />
        <StatTile label="Convertidas" value={byStatus.convertida ?? 0} hint="Conversões registradas" icon={Trophy} />
        <StatTile
          label="Qualificadas"
          value={data.qualifiedTotal}
          hint={
            data.qualificationMinScore === null
              ? "Nota mínima não configurada"
              : `Nota ≥ ${data.qualificationMinScore}`
          }
          icon={CheckCircle2}
        />
        <StatTile label="Pesquisas" value={data.researchLast30Days} hint="Últimos 30 dias" icon={Search} />
      </section>

      <div className="grid gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader>
            <div>
              <CardTitle>Oportunidades prioritárias</CardTitle>
              <CardDescription>Em aberto, ordenadas pela pontuação vigente</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <PriorityOpportunities items={data.priorityOpportunities} statusLabels={statusLabels} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div>
              <CardTitle>Distribuição por status</CardTitle>
              <CardDescription>Pipeline comercial atual</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <StatusDistribution counts={data.statusCounts} />
          </CardContent>
        </Card>

        <Card className="xl:col-span-2">
          <CardHeader>
            <div>
              <CardTitle>Pesquisas recentes</CardTitle>
              <CardDescription>Últimas pesquisas de prospecção</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <RecentResearch items={data.recentResearch} now={now} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div>
              <CardTitle>Atividade recente</CardTitle>
              <CardDescription>Histórico comercial</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <RecentActivity items={data.recentActivity} statusLabels={statusLabels} now={now} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
