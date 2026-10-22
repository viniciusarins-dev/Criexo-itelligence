import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { signOut } from "@/app/(app)/actions";
import { BrandLogo } from "@/components/layout/brand";
import { Notice } from "@/components/states/notice";
import { Button } from "@/components/ui/button";
import { getSessionState } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Acesso pendente" };

export default async function PendingAccessPage() {
  const state = await getSessionState();
  if (state.status === "anonymous") redirect("/login");
  if (state.status === "active") redirect("/dashboard");

  async function handleSignOut() {
    "use server";
    await signOut();
  }

  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-12">
      <div className="w-full max-w-md space-y-6">
        <BrandLogo />
        <Notice tone="warning" title="Seu acesso ainda não foi liberado">
          A conta {state.email ? <strong className="text-foreground">{state.email}</strong> : "atual"} está autenticada,
          mas ainda não foi autorizada a acessar os dados internos. Peça a um administrador para liberar seu perfil.
        </Notice>
        <form action={handleSignOut}>
          <Button type="submit" variant="secondary">
            Sair
          </Button>
        </form>
      </div>
    </main>
  );
}
