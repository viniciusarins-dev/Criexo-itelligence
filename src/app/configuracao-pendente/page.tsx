import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { BrandLogo } from "@/components/layout/brand";
import { Notice } from "@/components/states/notice";
import { readPublicEnv } from "@/lib/env";

export const metadata: Metadata = { title: "Configuração pendente" };

export default function PendingConfigurationPage() {
  const result = readPublicEnv();
  if (result.ok) redirect("/dashboard");

  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-12">
      <div className="w-full max-w-lg space-y-6">
        <BrandLogo />
        <Notice tone="pending" title="Conexão com o Supabase não configurada">
          <p>Defina as variáveis de ambiente abaixo (veja <code>.env.example</code> e o README) e reinicie o servidor:</p>
          <ul className="mt-2 list-disc space-y-1 pl-5 font-mono text-xs text-foreground">
            {result.missing.map((name) => (
              <li key={name}>{name}</li>
            ))}
          </ul>
        </Notice>
      </div>
    </main>
  );
}
