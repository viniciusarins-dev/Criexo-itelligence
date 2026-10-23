import type { Metadata } from "next";

import { BrandLogo } from "@/components/layout/brand";
import { safeRedirectPath } from "@/lib/validation/auth";

import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Entrar" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { next } = await searchParams;
  const nextPath = typeof next === "string" ? safeRedirectPath(next) : undefined;

  return (
    <main className="grid min-h-dvh lg:grid-cols-[1.1fr_1fr]">
      <section className="relative hidden overflow-hidden border-r border-border bg-surface lg:flex lg:flex-col lg:justify-between lg:p-12">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-40 -left-40 size-[520px] rounded-full bg-primary/10 blur-3xl"
        />
        <BrandLogo className="relative" />
        <div className="relative max-w-md space-y-4">
          <p className="text-3xl font-semibold leading-tight tracking-tight">
            Encontre, avalie e acompanhe quem pode comprar suas soluções em impressão 3D.
          </p>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Sistema interno de prospecção comercial da CRIEXO Soluções Criativas. Cada pontuação mostra os
            critérios, as evidências e o que ainda precisa ser confirmado.
          </p>
        </div>
        <p className="relative text-xs text-subtle-foreground">Acesso restrito a usuários autorizados.</p>
      </section>

      <section className="flex items-center justify-center px-4 py-12 sm:px-8">
        <div className="w-full max-w-sm space-y-8">
          <BrandLogo className="lg:hidden" />
          <div className="space-y-1.5">
            <h1 className="text-xl font-semibold tracking-tight">Entrar</h1>
            <p className="text-sm text-muted-foreground">Use as credenciais fornecidas pelo administrador.</p>
          </div>
          <LoginForm next={nextPath} />
          <p className="text-xs leading-relaxed text-subtle-foreground">
            Não há cadastro público. Novos usuários são criados e liberados por um administrador.
          </p>
        </div>
      </section>
    </main>
  );
}
