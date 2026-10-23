import type { Metadata } from "next";

import { CompanyForm } from "@/components/companies/company-form";
import { PageHeader } from "@/components/states/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { requireActiveMember } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Cadastrar empresa" };

export default async function NewCompanyPage() {
  await requireActiveMember();
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <PageHeader
        title="Cadastrar empresa"
        description="Preencha o que você sabe. Campos em branco ficam como desconhecidos — o sistema não completa nada por suposição."
      />
      <Card>
        <CardContent className="pt-5">
          <CompanyForm
            cancelHref="/empresas"
            defaults={{
              name: "",
              cnpj: "",
              segment: "",
              website: "",
              phone: "",
              address: "",
              neighborhood: "",
              city: "Joinville",
              state: "SC",
              postalCode: "",
              coordinates: "",
              locationConfirmed: false,
            }}
          />
        </CardContent>
      </Card>
    </div>
  );
}
