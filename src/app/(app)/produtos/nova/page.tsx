import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { ManualIdeaForm } from "@/components/ideas/manual-idea-form";
import { PageHeader } from "@/components/states/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { requireActiveMember } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Nova ideia" };

export default async function NewIdeaPage() {
  await requireActiveMember();
  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
      <Link href="/produtos" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft aria-hidden="true" className="size-4" />
        Produtos e ideias
      </Link>
      <PageHeader title="Nova ideia de produto" description="A ideia começa aguardando decisão. Campos não preenchidos ficam como “não informado”." />
      <Card>
        <CardContent className="pt-5">
          <ManualIdeaForm />
        </CardContent>
      </Card>
    </div>
  );
}
