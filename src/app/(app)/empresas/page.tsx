import { Building2, ChevronLeft, ChevronRight, Plus, Search, SearchX } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { EmptyState } from "@/components/states/empty-state";
import { Notice } from "@/components/states/notice";
import { PageHeader } from "@/components/states/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/select";
import { Stars } from "@/components/ui/stars";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDateTime } from "@/lib/formatting/date";
import { formatDistanceKm } from "@/lib/formatting/numbers";
import {
  COMPANY_PAGE_SIZE,
  COMPANY_SORTS,
  companyListParamsSchema,
  listCompanies,
  NO_OPPORTUNITY,
  type CompanyListParams,
  type CompanyListRow,
} from "@/server/repositories/companies";

export const metadata: Metadata = { title: "Empresas" };

function pageHref(params: CompanyListParams, page: number) {
  const search = new URLSearchParams();
  if (params.q) search.set("q", params.q);
  if (params.segmento) search.set("segmento", params.segmento);
  if (params.status) search.set("status", params.status);
  if (params.ordem !== "atualizacao") search.set("ordem", params.ordem);
  if (page > 1) search.set("pagina", String(page));
  const query = search.toString();
  return query ? `/empresas?${query}` : "/empresas";
}

function Location({ row }: { row: CompanyListRow }) {
  const place = [row.neighborhood, row.city].filter(Boolean).join(", ");
  return <span className="text-muted-foreground">{place || "—"}</span>;
}

function Distance({ row, referenceConfigured }: { row: CompanyListRow; referenceConfigured: boolean }) {
  if (row.distanceKm !== null) {
    return (
      <span className="tabular-nums">
        {formatDistanceKm(row.distanceKm)}
        {row.locationStatus !== "confirmed" ? (
          <span className="block text-[11px] text-subtle-foreground">local não conferido</span>
        ) : null}
      </span>
    );
  }
  return (
    <span className="text-xs text-subtle-foreground">{referenceConfigured ? "sem localização" : "região pendente"}</span>
  );
}

function Score({ row }: { row: CompanyListRow }) {
  if (row.score === null) return <span className="text-xs text-subtle-foreground">sem avaliação</span>;
  return (
    <span className="inline-flex flex-col items-end gap-1">
      <span className="tabular-nums">
        <span className="font-semibold">{row.score.toFixed(0)}</span>
        <span className="text-subtle-foreground">/100</span>
      </span>
      {row.stars !== null ? <Stars value={row.stars} /> : null}
    </span>
  );
}

export default async function CompaniesPage({ searchParams }: PageProps<"/empresas">) {
  const raw = await searchParams;
  const params = companyListParamsSchema.parse({
    q: typeof raw.q === "string" ? raw.q : undefined,
    segmento: typeof raw.segmento === "string" && raw.segmento ? raw.segmento : undefined,
    status: typeof raw.status === "string" && raw.status ? raw.status : undefined,
    ordem: raw.ordem,
    pagina: raw.pagina,
  });
  const data = await listCompanies(params);
  const statusLabels = Object.fromEntries(data.statuses.map((status) => [status.key, status.label]));
  const filtered = Boolean(params.q || params.segmento || params.status);
  const first = (data.page - 1) * COMPANY_PAGE_SIZE + 1;
  const last = Math.min(data.total, data.page * COMPANY_PAGE_SIZE);

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6">
      <PageHeader
        title="Empresas"
        description="Empresas que podem comprar soluções em impressão 3D, com localização, origem dos dados e oportunidades."
        actions={
          <Button asChild>
            <Link href="/empresas/nova">
              <Plus aria-hidden="true" />
              Cadastrar empresa
            </Link>
          </Button>
        }
      />

      {!data.referenceConfigured ? (
        <Notice tone="warning" title="Distâncias indisponíveis">
          Configure o ponto de referência em{" "}
          <Link href="/configuracoes#regiao" className="font-medium text-foreground underline underline-offset-4">
            Configurações → Região
          </Link>
          .
        </Notice>
      ) : null}

      <form
        role="search"
        aria-label="Filtrar empresas"
        className="grid gap-3 rounded-lg border border-border bg-surface p-4 md:grid-cols-2 xl:grid-cols-[minmax(14rem,2fr)_repeat(3,minmax(12.5rem,1fr))_auto]"
      >
        <div className="relative">
          <Search aria-hidden="true" className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-subtle-foreground" />
          <label htmlFor="q" className="sr-only">
            Buscar
          </label>
          <Input id="q" name="q" defaultValue={params.q ?? ""} placeholder="Nome, segmento ou bairro" className="pl-9" />
        </div>
        <div>
          <label htmlFor="segmento" className="sr-only">
            Segmento
          </label>
          <NativeSelect id="segmento" name="segmento" defaultValue={params.segmento ?? ""}>
            <option value="">Todos os segmentos</option>
            {data.segments.map((segment) => (
              <option key={segment} value={segment}>
                {segment}
              </option>
            ))}
          </NativeSelect>
        </div>
        <div>
          <label htmlFor="status" className="sr-only">
            Status comercial
          </label>
          <NativeSelect id="status" name="status" defaultValue={params.status ?? ""}>
            <option value="">Todos os status</option>
            <option value={NO_OPPORTUNITY}>Sem oportunidade</option>
            {data.statuses.map((status) => (
              <option key={status.key} value={status.key}>
                {status.label}
              </option>
            ))}
          </NativeSelect>
        </div>
        <div>
          <label htmlFor="ordem" className="sr-only">
            Ordenar por
          </label>
          <NativeSelect id="ordem" name="ordem" defaultValue={params.ordem}>
            {Object.entries(COMPANY_SORTS).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </NativeSelect>
        </div>
        <div className="flex gap-2">
          <Button type="submit" variant="secondary" className="flex-1 md:flex-none">
            Filtrar
          </Button>
          {filtered || params.ordem !== "atualizacao" ? (
            <Button asChild variant="ghost">
              <Link href="/empresas">Limpar</Link>
            </Button>
          ) : null}
        </div>
      </form>

      {data.rows.length === 0 ? (
        <Card>
          {filtered ? (
            <EmptyState
              icon={SearchX}
              title="Nenhuma empresa encontrada"
              description="Nenhuma empresa corresponde aos filtros. Tente outro termo ou limpe os filtros."
              action={
                <Button asChild variant="secondary">
                  <Link href="/empresas">Limpar filtros</Link>
                </Button>
              }
            />
          ) : (
            <EmptyState
              icon={Building2}
              title="Nenhuma empresa cadastrada"
              description="Cadastre manualmente as empresas que você já conhece. As buscas automáticas entram quando as integrações forem ativadas."
              action={
                <Button asChild>
                  <Link href="/empresas/nova">
                    <Plus aria-hidden="true" />
                    Cadastrar empresa
                  </Link>
                </Button>
              }
            />
          )}
        </Card>
      ) : (
        <>
          <p className="text-sm text-muted-foreground" aria-live="polite">
            {data.total === 1 ? "1 empresa" : `${first}–${last} de ${data.total.toLocaleString("pt-BR")} empresas`}
          </p>

          {/* Celular: cartões */}
          <ul className="space-y-3 md:hidden" aria-label="Empresas">
            {data.rows.map((row) => (
              <li key={row.id}>
                <Link
                  href={`/empresas/${row.id}`}
                  className="block rounded-lg border border-border bg-surface p-4 transition-colors hover:border-border-strong"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-medium text-foreground">{row.name}</p>
                      <p className="text-xs text-subtle-foreground">{row.segment ?? "Segmento não informado"}</p>
                    </div>
                    <Score row={row} />
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
                    <Location row={row} />
                    <Distance row={row} referenceConfigured={data.referenceConfigured} />
                    {row.commercialStatus ? <Badge>{statusLabels[row.commercialStatus] ?? row.commercialStatus}</Badge> : null}
                  </div>
                </Link>
              </li>
            ))}
          </ul>

          {/* Desktop: tabela */}
          <Card className="hidden md:block">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Empresa</TableHead>
                  <TableHead>Local</TableHead>
                  <TableHead>Distância</TableHead>
                  <TableHead>Produto relacionado</TableHead>
                  <TableHead className="text-right">Pontuação</TableHead>
                  <TableHead className="text-right">Confiança</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Verificada em</TableHead>
                  <TableHead className="text-right">
                    <span className="sr-only">Ações</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.rows.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell>
                      <Link href={`/empresas/${row.id}`} className="font-medium text-foreground hover:underline">
                        {row.name}
                      </Link>
                      <p className="text-xs text-subtle-foreground">{row.segment ?? "Segmento não informado"}</p>
                    </TableCell>
                    <TableCell>
                      <Location row={row} />
                    </TableCell>
                    <TableCell>
                      <Distance row={row} referenceConfigured={data.referenceConfigured} />
                    </TableCell>
                    <TableCell className="text-muted-foreground">{row.productName ?? "—"}</TableCell>
                    <TableCell className="text-right">
                      <Score row={row} />
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground tabular-nums">
                      {row.confidence === null ? "—" : `${row.confidence.toFixed(0)}%`}
                    </TableCell>
                    <TableCell>
                      {row.commercialStatus ? (
                        <Badge>{statusLabels[row.commercialStatus] ?? row.commercialStatus}</Badge>
                      ) : (
                        <span className="text-xs text-subtle-foreground">sem oportunidade</span>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {row.lastVerifiedAt ? formatDateTime(row.lastVerifiedAt) : "não verificada"}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button asChild variant="ghost" size="sm">
                        <Link href={`/empresas/${row.id}`} aria-label={`Ver detalhes de ${row.name}`}>
                          Ver
                        </Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>

          {data.pageCount > 1 ? (
            <nav aria-label="Paginação" className="flex items-center justify-between gap-3">
              {data.page > 1 ? (
                <Button asChild variant="secondary" size="sm">
                  <Link href={pageHref(params, data.page - 1)} rel="prev">
                    <ChevronLeft aria-hidden="true" />
                    Anterior
                  </Link>
                </Button>
              ) : (
                <span />
              )}
              <span className="text-sm text-muted-foreground">
                Página {data.page} de {data.pageCount}
              </span>
              {data.page < data.pageCount ? (
                <Button asChild variant="secondary" size="sm">
                  <Link href={pageHref(params, data.page + 1)} rel="next">
                    Próxima
                    <ChevronRight aria-hidden="true" />
                  </Link>
                </Button>
              ) : (
                <span />
              )}
            </nav>
          ) : null}
        </>
      )}
    </div>
  );
}
