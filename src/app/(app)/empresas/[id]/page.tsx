import { Activity, ArrowLeft, CheckCircle2, ExternalLink, FileSearch, Pencil, Target } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { InformationBadge } from "@/components/companies/information-badge";
import { ConfirmLocationButton, SourceActions } from "@/components/companies/source-actions";
import { CreateOpportunityForm } from "@/components/opportunities/create-opportunity-form";
import { EmptyState } from "@/components/states/empty-state";
import { Notice } from "@/components/states/notice";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Stars } from "@/components/ui/stars";
import type { TrackedField } from "@/domain/companies/company";
import { formatCnpj } from "@/domain/rules/normalization";
import { OSM_ATTRIBUTION, OSM_COPYRIGHT_URL, OSM_SOURCE_NAME } from "@/domain/sources/osm";
import { formatDateTime } from "@/lib/formatting/date";
import { formatDistanceKm, formatPhoneBr, formatPostalCode } from "@/lib/formatting/numbers";
import { ACTIVITY_LABELS } from "@/lib/presentation/labels";
import { getCompany } from "@/server/repositories/companies";
import { approvedIdeas } from "@/server/repositories/opportunities";

export const metadata: Metadata = { title: "Empresa" };

const FIELD_LABELS: Record<TrackedField, string> = {
  name: "Nome",
  cnpj: "CNPJ",
  segment: "Segmento",
  website: "Site",
  phone: "Telefone",
  address: "Endereço",
  neighborhood: "Bairro",
  city: "Cidade",
  state: "Estado",
  postalCode: "CEP",
  location: "Localização no mapa",
};

function Item({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1 py-2.5 sm:grid-cols-[10rem_1fr] sm:gap-4">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="min-w-0 text-sm text-foreground break-words">{children}</dd>
    </div>
  );
}

/** Informações guardadas com a fonte (BrasilAPI e OpenStreetMap), em linguagem simples. */
function sourceFacts(metadata: unknown): string[] {
  if (!metadata || typeof metadata !== "object") return [];
  const data = metadata as Record<string, unknown>;
  const text = (key: string) => (typeof data[key] === "string" && data[key] ? (data[key] as string) : null);
  const facts: string[] = [];
  if (text("situacao")) facts.push(`Situação cadastral: ${text("situacao")}`);
  if (text("cnae")) facts.push(`CNAE: ${text("cnae")}`);
  if (text("porte")) facts.push(`Porte: ${text("porte")}`);
  if (text("inicioAtividade")) facts.push(`Início das atividades: ${text("inicioAtividade")}`);
  if (data.isMei === true) facts.push("Optante pelo MEI");
  if (text("nomeFantasia")) facts.push(`Nome fantasia: ${text("nomeFantasia")}`);
  if (text("razaoSocial")) facts.push(`Razão social: ${text("razaoSocial")}`);
  if (text("category")) facts.push(`Categoria: ${text("category")}`);
  return facts;
}

function Unknown() {
  return <span className="text-subtle-foreground">Não informado</span>;
}

export default async function CompanyPage({ params, searchParams }: PageProps<"/empresas/[id]">) {
  const { id } = await params;
  const { salvo } = await searchParams;
  const details = await getCompany(id);
  if (!details) notFound();
  const ideas = await approvedIdeas();
  const { company, provenance } = details;

  const place = [company.neighborhood, company.city, company.state].filter(Boolean).join(", ");
  const mapUrl =
    company.latitude !== null
      ? `https://www.openstreetmap.org/?mlat=${company.latitude}&mlon=${company.longitude}#map=18/${company.latitude}/${company.longitude}`
      : null;
  const provenanceRows = (Object.keys(FIELD_LABELS) as TrackedField[]).filter((field) => provenance[field]);

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <div className="space-y-4">
        <Link href="/empresas" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft aria-hidden="true" className="size-4" />
          Empresas
        </Link>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 space-y-2">
            <h1 className="text-2xl font-semibold tracking-tight break-words">{company.name}</h1>
            <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              {company.segment ? <Badge tone="brand">{company.segment}</Badge> : <Badge>Segmento não informado</Badge>}
              {place ? <span>{place}</span> : null}
              {details.distanceKm !== null ? <span>· {formatDistanceKm(details.distanceKm)} do ponto de referência</span> : null}
            </div>
          </div>
          <Button asChild variant="secondary">
            <Link href={`/empresas/${company.id}/editar`}>
              <Pencil aria-hidden="true" />
              Editar
            </Link>
          </Button>
        </div>
      </div>

      {salvo ? (
        <Notice tone="info" title="Empresa salva">
          As informações ficaram registradas com origem “Cadastro manual”.
        </Notice>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Identificação e contato</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="divide-y divide-border">
              <Item label="CNPJ">{company.cnpj ? <span className="tabular-nums">{formatCnpj(company.cnpj)}</span> : <Unknown />}</Item>
              <Item label="Segmento">{company.segment ?? <Unknown />}</Item>
              <Item label="Site">
                {company.website ? (
                  <a
                    href={company.website}
                    target="_blank"
                    rel="noopener noreferrer nofollow"
                    className="inline-flex items-center gap-1 text-primary-text underline-offset-4 hover:underline"
                  >
                    {company.website_domain ?? company.website}
                    <ExternalLink aria-hidden="true" className="size-3" />
                  </a>
                ) : (
                  <Unknown />
                )}
              </Item>
              <Item label="Telefone comercial">
                {company.phone_normalized ? <span className="tabular-nums">{formatPhoneBr(company.phone_normalized)}</span> : <Unknown />}
              </Item>
            </dl>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Localização</CardTitle>
            <InformationBadge status={company.location_status} />
          </CardHeader>
          <CardContent className="space-y-3">
            <dl className="divide-y divide-border">
              <Item label="Endereço">{company.address ?? <Unknown />}</Item>
              <Item label="Bairro / cidade">{place || <Unknown />}</Item>
              <Item label="CEP">{company.postal_code ? formatPostalCode(company.postal_code) : <Unknown />}</Item>
              <Item label="Distância">
                {details.distanceKm !== null ? (
                  formatDistanceKm(details.distanceKm)
                ) : (
                  <span className="text-subtle-foreground">
                    {company.latitude === null ? "Sem coordenadas da empresa" : "Ponto de referência não configurado"}
                  </span>
                )}
              </Item>
            </dl>
            {company.latitude !== null && company.location_status !== "confirmed" ? <ConfirmLocationButton companyId={company.id} /> : null}
            {company.location_status === "confirmed" && company.location_verified_at ? (
              <p className="text-xs text-muted-foreground">
                {provenance.location?.source ?? "Confirmada"} em {formatDateTime(company.location_verified_at)}
              </p>
            ) : null}
            {mapUrl ? (
              <a
                href={mapUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-sm text-primary-text underline-offset-4 hover:underline"
              >
                Ver no mapa
                <ExternalLink aria-hidden="true" className="size-3.5" />
              </a>
            ) : null}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="space-y-1">
            <CardTitle>Completar com fontes públicas</CardTitle>
            <CardDescription>Nada informado no cadastro é substituído. Os dados entram como “declarados pela fonte”.</CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <SourceActions
            companyId={company.id}
            cnpj={company.cnpj}
            canGeocode={company.latitude === null && Boolean(company.address && company.city)}
            geocodeHint={
              company.latitude !== null
                ? "A empresa já tem localização. Para trocar, edite o cadastro."
                : company.address && company.city
                  ? "Consulta o Nominatim (OpenStreetMap). A posição fica como não confirmada até alguém conferir."
                  : "Cadastre endereço e cidade para localizar."
            }
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="space-y-1">
            <CardTitle>Origem das informações</CardTitle>
            <CardDescription>De onde veio cada dado e quando foi registrado.</CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          {provenanceRows.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma informação com origem registrada.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs text-muted-foreground">
                    <th className="py-2 pr-3 font-medium">Campo</th>
                    <th className="py-2 pr-3 font-medium">Natureza</th>
                    <th className="py-2 pr-3 font-medium">Fonte</th>
                    <th className="py-2 font-medium">Registrado em</th>
                  </tr>
                </thead>
                <tbody>
                  {provenanceRows.map((field) => {
                    const item = provenance[field]!;
                    return (
                      <tr key={field} className="border-b border-border last:border-0">
                        <td className="py-2.5 pr-3">{FIELD_LABELS[field]}</td>
                        <td className="py-2.5 pr-3">
                          <InformationBadge status={item.status} />
                        </td>
                        <td className="py-2.5 pr-3 text-muted-foreground">{item.source}</td>
                        <td className="py-2.5 text-muted-foreground whitespace-nowrap">{formatDateTime(item.observedAt)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="space-y-1">
            <CardTitle>Fontes consultadas</CardTitle>
            <CardDescription>Registros de fontes externas ligados a esta empresa.</CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          {details.sources.length === 0 ? (
            <EmptyState
              icon={FileSearch}
              title="Nenhuma fonte externa"
              description="Nenhuma fonte externa ligada a esta empresa. Elas aparecem quando uma pesquisa a encontra ou quando você completa os dados pelo CNPJ."
              className="py-6"
            />
          ) : (
            <ul className="divide-y divide-border">
              {details.sources.map((source) => {
                const facts = sourceFacts(source.evidence_metadata);
                return (
                  <li key={source.id} className="space-y-1.5 py-2.5 text-sm">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      {source.source_url ? (
                        <a
                          href={source.source_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 font-medium text-primary-text underline-offset-4 hover:underline"
                        >
                          {source.source_name}
                          <ExternalLink aria-hidden="true" className="size-3" />
                        </a>
                      ) : (
                        <span className="font-medium">{source.source_name}</span>
                      )}
                      <span className="text-xs text-muted-foreground">
                        Coletado em {formatDateTime(source.collected_at)}
                        {source.last_verified_at ? ` · verificado em ${formatDateTime(source.last_verified_at)}` : ""}
                      </span>
                    </div>
                    {facts.length ? (
                      <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                        {facts.map((fact) => (
                          <li key={fact}>{fact}</li>
                        ))}
                      </ul>
                    ) : null}
                    {source.source_name === OSM_SOURCE_NAME ? (
                      <p className="text-xs text-subtle-foreground">
                        Dados{" "}
                        <a href={OSM_COPYRIGHT_URL} target="_blank" rel="noopener noreferrer" className="underline">
                          {OSM_ATTRIBUTION}
                        </a>
                      </p>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <div className="space-y-1">
              <CardTitle>Oportunidades</CardTitle>
              <CardDescription>Produtos que esta empresa poderia comprar.</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <CreateOpportunityForm companyId={company.id} ideas={ideas} />
            {ideas.length === 0 ? (
              <p className="text-xs text-subtle-foreground">
                Ainda não há produtos aprovados. A oportunidade pode ser criada sem produto e associada depois.
              </p>
            ) : null}
            {details.opportunities.length === 0 ? (
              <EmptyState
                icon={Target}
                title="Nenhuma oportunidade"
                description="Crie uma oportunidade para acompanhar contatos e status desta empresa."
                className="py-4"
              />
            ) : (
              <ul className="divide-y divide-border">
                {details.opportunities.map((opportunity) => (
                  <li key={opportunity.id} className="flex items-start justify-between gap-3 py-3">
                    <div className="min-w-0 space-y-1">
                      <Link href={`/oportunidades/${opportunity.id}`} className="text-sm font-medium hover:underline">
                        {opportunity.productName ?? "Sem produto definido"}
                      </Link>
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge>{opportunity.statusLabel}</Badge>
                        {opportunity.isSaved ? (
                          <Badge tone="brand">
                            <CheckCircle2 aria-hidden="true" />
                            Salva
                          </Badge>
                        ) : null}
                      </div>
                    </div>
                    <div className="text-right text-sm">
                      {opportunity.score === null ? (
                        <span className="text-xs text-subtle-foreground">sem avaliação</span>
                      ) : (
                        <>
                          <span className="font-semibold tabular-nums">{opportunity.score.toFixed(0)}</span>
                          <span className="text-subtle-foreground">/100</span>
                          {opportunity.stars !== null ? <Stars value={opportunity.stars} className="mt-1 flex justify-end" /> : null}
                          {opportunity.isComplete === false ? (
                            <span className="block text-[11px] text-warning-text">dados incompletos</span>
                          ) : null}
                        </>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="space-y-1">
              <CardTitle>Histórico</CardTitle>
              <CardDescription>Contatos, observações e mudanças de status.</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            {details.activities.length === 0 ? (
              <EmptyState
                icon={Activity}
                title="Sem atividades"
                description="Nenhum contato ou mudança de status registrado para esta empresa."
                className="py-6"
              />
            ) : (
              <ol className="space-y-3">
                {details.activities.map((activity) => (
                  <li key={activity.id} className="text-sm">
                    <p className="font-medium">{ACTIVITY_LABELS[activity.type]}</p>
                    {activity.newStatus ? (
                      <p className="text-xs text-muted-foreground">
                        {activity.previousStatus ? `${details.statusLabels[activity.previousStatus] ?? activity.previousStatus} → ` : ""}
                        {details.statusLabels[activity.newStatus] ?? activity.newStatus}
                      </p>
                    ) : null}
                    {activity.note ? <p className="text-xs text-muted-foreground">{activity.note}</p> : null}
                    <p className="text-xs text-subtle-foreground">
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

      <p className="text-xs text-subtle-foreground">
        Cadastrada em {formatDateTime(company.created_at)}
        {details.createdByName ? ` por ${details.createdByName}` : ""} · atualizada em {formatDateTime(company.updated_at)}
      </p>
    </div>
  );
}
