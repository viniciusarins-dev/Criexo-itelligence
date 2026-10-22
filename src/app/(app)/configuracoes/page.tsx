import type { Metadata } from "next";

import { Notice } from "@/components/states/notice";
import { PageHeader } from "@/components/states/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { pendingProductionItems } from "@/domain/settings/production";
import { formatDateTime } from "@/lib/formatting/date";
import { loadSettings } from "@/server/repositories/settings";

import { ProductionForm } from "./production-form";
import { ProfileForm } from "./profile-form";
import { RegionForm } from "./region-form";
import { ScoringSummary } from "./scoring-summary";
import { TeamTable } from "./team-table";

export const metadata: Metadata = { title: "Configurações" };

const SECTIONS = [
  { id: "regiao", label: "Região" },
  { id: "capacidade", label: "Capacidade" },
  { id: "pontuacao", label: "Pontuação" },
  { id: "equipe", label: "Equipe" },
  { id: "integracoes", label: "Integrações" },
  { id: "perfil", label: "Seu perfil" },
];

function LastUpdate({ at, by }: { at: string; by: string | null }) {
  return (
    <p className="text-xs text-subtle-foreground">
      Atualizado em {formatDateTime(at)}
      {by ? ` por ${by}` : ""}
    </p>
  );
}

export default async function SettingsPage() {
  const data = await loadSettings();
  const isAdmin = data.member.role === "admin";
  const regionConfigured = Boolean(data.geoReference && data.radiusKm);
  const pending = data.production ? pendingProductionItems(data.production.value) : null;

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <PageHeader
        title="Configurações"
        description="Parâmetros usados na avaliação das empresas. Cada alteração fica registrada com data e responsável."
      />

      <nav aria-label="Seções das configurações" className="-mx-1 flex flex-wrap gap-1">
        {SECTIONS.map((section) => (
          <a
            key={section.id}
            href={`#${section.id}`}
            className="rounded-md px-3 py-1.5 text-sm text-muted-foreground hover:bg-surface-hover hover:text-foreground"
          >
            {section.label}
          </a>
        ))}
      </nav>

      <Card id="regiao" className="scroll-mt-24">
        <CardHeader>
          <div className="space-y-1">
            <CardTitle>Região de atuação</CardTitle>
            <CardDescription>Ponto de partida e raio usados no cálculo de proximidade.</CardDescription>
          </div>
          {regionConfigured ? <Badge tone="success">Configurada</Badge> : <Badge tone="warning">Pendente</Badge>}
        </CardHeader>
        <CardContent className="space-y-4">
          {!isAdmin ? (
            <Notice tone="pending" title="Somente leitura">Apenas administradores alteram a região de atuação.</Notice>
          ) : null}
          {!regionConfigured ? (
            <Notice tone="warning" title="Sem região configurada, a proximidade fica desconhecida para todas as empresas" />
          ) : null}
          <RegionForm reference={data.geoReference?.value ?? null} radiusKm={data.radiusKm?.value ?? null} canEdit={isAdmin} />
          {data.geoReference ? <LastUpdate at={data.geoReference.updatedAt} by={data.geoReference.updatedBy} /> : null}
        </CardContent>
      </Card>

      <Card id="capacidade" className="scroll-mt-24">
        <CardHeader>
          <div className="space-y-1">
            <CardTitle>Capacidade produtiva</CardTitle>
            <CardDescription>Limites informados manualmente. Campos vazios são tratados como incerteza.</CardDescription>
          </div>
          {!data.production ? (
            <Badge tone="warning">Pendente</Badge>
          ) : pending && pending.length > 0 ? (
            <Badge tone="warning">{pending.length} a confirmar</Badge>
          ) : (
            <Badge tone="success">Completa</Badge>
          )}
        </CardHeader>
        <CardContent className="space-y-5">
          {!data.production ? (
            <Notice tone="warning" title="Capacidade não informada">
              Enquanto não houver dados, nenhuma oportunidade é marcada como viável.
            </Notice>
          ) : pending && pending.length > 0 ? (
            <Notice tone="pending" title="Itens a confirmar">
              {pending.join(" · ")}
            </Notice>
          ) : null}
          <ProductionForm current={data.production?.value ?? null} />
          {data.production ? <LastUpdate at={data.production.updatedAt} by={data.production.updatedBy} /> : null}
        </CardContent>
      </Card>

      <Card id="pontuacao" className="scroll-mt-24">
        <CardHeader>
          <div className="space-y-1">
            <CardTitle>Pontuação</CardTitle>
            <CardDescription>Critérios, pesos e regras da versão vigente.</CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          {data.scoring ? (
            <ScoringSummary {...data.scoring} />
          ) : (
            <Notice tone="danger" title="Nenhuma versão de pontuação ativa" />
          )}
        </CardContent>
      </Card>

      <Card id="equipe" className="scroll-mt-24">
        <CardHeader>
          <div className="space-y-1">
            <CardTitle>Equipe</CardTitle>
            <CardDescription>Quem pode acessar o sistema.</CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {data.team ? (
            <>
              <TeamTable team={data.team} currentUserId={data.member.id} />
              <p className="text-xs text-subtle-foreground">
                Novos usuários são criados no painel do Supabase (Authentication → Users) e aparecem aqui aguardando liberação.
              </p>
            </>
          ) : (
            <Notice tone="pending" title="Somente administradores gerenciam a equipe" />
          )}
        </CardContent>
      </Card>

      <Card id="integracoes" className="scroll-mt-24">
        <CardHeader>
          <div className="space-y-1">
            <CardTitle>Integrações</CardTitle>
            <CardDescription>Serviços externos de busca de empresas e de inteligência artificial.</CardDescription>
          </div>
          <Badge tone="neutral">Nenhuma ativa</Badge>
        </CardHeader>
        <CardContent>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Nenhuma fonte de dados ou serviço de IA está conectado. As opções e os preços serão apresentados para
            aprovação antes de qualquer integração.
          </p>
        </CardContent>
      </Card>

      <Card id="perfil" className="scroll-mt-24">
        <CardHeader>
          <div className="space-y-1">
            <CardTitle>Seu perfil</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <ProfileForm displayName={data.member.displayName} email={data.member.email} />
        </CardContent>
      </Card>
    </div>
  );
}
