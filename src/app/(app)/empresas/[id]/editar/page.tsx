import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { CompanyForm } from "@/components/companies/company-form";
import { PageHeader } from "@/components/states/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { formatCnpj } from "@/domain/rules/normalization";
import { getCompany } from "@/server/repositories/companies";

export const metadata: Metadata = { title: "Editar empresa" };

export default async function EditCompanyPage({ params }: PageProps<"/empresas/[id]/editar">) {
  const { id } = await params;
  const details = await getCompany(id);
  if (!details) notFound();
  const { company } = details;

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <PageHeader title={`Editar ${company.name}`} description="Os campos alterados passam a ter origem “Cadastro manual”." />
      <Card>
        <CardContent className="pt-5">
          <CompanyForm
            cancelHref={`/empresas/${company.id}`}
            defaults={{
              id: company.id,
              name: company.name,
              cnpj: company.cnpj ? formatCnpj(company.cnpj) : "",
              segment: company.segment ?? "",
              website: company.website ?? "",
              phone: company.phone ?? "",
              address: company.address ?? "",
              neighborhood: company.neighborhood ?? "",
              city: company.city ?? "",
              state: company.state ?? "",
              postalCode: company.postal_code ?? "",
              coordinates: company.latitude !== null ? `${company.latitude}, ${company.longitude}` : "",
              locationConfirmed: company.location_status === "confirmed",
            }}
          />
        </CardContent>
      </Card>
    </div>
  );
}
