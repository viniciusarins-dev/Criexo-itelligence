import { Download } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";

import { BarList } from "@/components/reports/bar-list";
import { Notice } from "@/components/states/notice";
import { PageHeader } from "@/components/states/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { REPORT_PERIODS, type ReportPeriod } from "@/domain/reports/reports";
import { RESEARCH_STATUS } from "@/lib/presentation/labels";
import { cn } from "@/lib/utils";
import type { Enums } from "@/lib/supabase/types";
import { loadReport } from "@/server/repositories/reports";

export const metadata: Metadata = { title: "Relatórios" };

function Tile({ label, value, hint }: { label: string; value: ReactNode; hint?: string }) {
  return (
    <div className="rounded-lg border border-border bg-surface p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
      {hint ? <p className="mt-1 text-xs text-subtle-foreground">{hint}</p> : null}
    </div>
  );
}

function Section({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return (
    <Card>
      <CardHeader>
        <div className="space-y-1">
          <CardTitle>{title}</CardTitle>
          {description ? <CardDescription>{description}</CardDescription> : null}
        </div>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

export default async function ReportsPage({ searchParams }: PageProps<"/relatorios">) {
  const raw = await searchParams;
  const period: ReportPeriod = typeof raw.periodo === "string" && raw.periodo in REPORT_PERIODS ? (raw.periodo as ReportPeriod) : "90";
  const data = await loadReport(period);
  const { outcomes } = data;

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6">
      <PageHeader
        title="Relatórios"
        description="Contagens calculadas a partir do banco, pelo período escolhido (data de criação). Nenhum número é estimado."
        actions={
          <>
            <Button asChild variant="secondary">
              <a href={`/relatorios/exportar/oportunidades?periodo=${period}`} download>
                <Download aria-hidden="true" />
                Oportunidades (CSV)
              </a>
            </Button>
            <Button asChild variant="secondary">
              <a href={`/relatorios/exportar/empresas?periodo=${period}`} download>
                <Download aria-hidden="true" />
                Empresas (CSV)
              </a>
            </Button>
          </>
        }
      />

      <nav aria-label="Período" className="flex flex-wrap gap-2">
        {(Object.entries(REPORT_PERIODS) as [ReportPeriod, string][]).map(([value, label]) => (
          <Link
            key={value}
            href={`/relatorios?periodo=${value}`}
            aria-current={value === period ? "page" : undefined}
            className={cn(
              "rounded-full border px-3 py-1 text-sm",
              value === period ? "border-primary/40 bg-primary-subtle text-foreground" : "border-border text-muted-foreground hover:text-foreground",
            )}
          >
            {label}
          </Link>
        ))}
      </nav>

      {data.truncated ? (
        <Notice tone="warning" title="Relatório limitado">
          Foram consideradas as 5.000 oportunidades mais recentes do período.
        </Notice>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Tile label="Oportunidades criadas" value={outcomes.total.toLocaleString("pt-BR")} />
        <Tile label="Em andamento" value={outcomes.open.toLocaleString("pt-BR")} />
        <Tile label="Ganhas" value={outcomes.won.toLocaleString("pt-BR")} />
        <Tile label="Perdidas ou descartadas" value={outcomes.lost.toLocaleString("pt-BR")} />
        <Tile
          label="Ganhas entre as encerradas"
          value={outcomes.winRate === null ? "—" : `${Math.round(outcomes.winRate * 100)}%`}
          hint={outcomes.winRate === null ? "Nenhuma oportunidade encerrada no período" : `${outcomes.won} de ${outcomes.won + outcomes.lost}`}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Section title="Funil comercial" description="Oportunidades por status atual.">
          <BarList bars={data.funnel} label="Oportunidades por status" emptyText="Nenhuma oportunidade no período." />
        </Section>
        <Section
          title="Pontuação"
          description={data.stars.incomplete ? `${data.stars.incomplete} nota(s) calculada(s) com dados incompletos.` : "Oportunidades por estrelas."}
        >
          <BarList bars={data.stars.bars} label="Oportunidades por estrelas" emptyText="Nenhuma oportunidade no período." />
        </Section>
        <Section title="Segmentos" description="Segmento das empresas com oportunidades.">
          <BarList bars={data.segments} label="Oportunidades por segmento" emptyText="Nenhuma oportunidade no período." />
        </Section>
        <Section title="Produtos" description="Produto de cada oportunidade.">
          <BarList bars={data.products} label="Oportunidades por produto" emptyText="Nenhuma oportunidade no período." />
        </Section>
        <Section title="Pesquisas" description={`${data.research.total} pesquisa(s) · ${data.companiesAdded} empresa(s) cadastrada(s) no período.`}>
          <BarList
            bars={data.research.byStatus.map((bar) => ({ ...bar, label: RESEARCH_STATUS[bar.key as Enums<"research_status">]?.label ?? bar.label }))}
            label="Pesquisas por situação"
            emptyText="Nenhuma pesquisa no período."
          />
        </Section>
        <Section title="Fontes consultadas" description="Execuções de cada fonte nas buscas do período.">
          {data.sources.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma busca no período.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Fonte</TableHead>
                  <TableHead className="text-right">Execuções</TableHead>
                  <TableHead className="text-right">Concluídas</TableHead>
                  <TableHead className="text-right">Falhas</TableHead>
                  <TableHead className="text-right">Limite/sem região</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.sources.map((source) => (
                  <TableRow key={source.source}>
                    <TableCell>{source.source}</TableCell>
                    <TableCell className="text-right tabular-nums">{source.total}</TableCell>
                    <TableCell className="text-right tabular-nums">{source.succeeded}</TableCell>
                    <TableCell className="text-right tabular-nums">{source.failed}</TableCell>
                    <TableCell className="text-right tabular-nums">{source.limited + source.skipped}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Section>
      </div>
    </div>
  );
}
