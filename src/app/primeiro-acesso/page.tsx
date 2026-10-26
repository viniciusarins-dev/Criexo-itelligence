import type { Metadata } from "next";
import Link from "next/link";

import { BrandLogo } from "@/components/layout/brand";

import { FirstAccessForm } from "./first-access-form";

export const metadata: Metadata = { title: "Primeiro acesso" };

export default function FirstAccessPage() {
  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-12 sm:px-8">
      <div className="w-full max-w-sm space-y-8">
        <BrandLogo />
        <div className="space-y-1.5">
          <h1 className="text-xl font-semibold tracking-tight">Primeiro acesso</h1>
          <p className="text-sm text-muted-foreground">
            Digite o e-mail liberado pelo administrador e crie sua senha. Cada e-mail só pode fazer isso uma vez.
          </p>
        </div>
        <FirstAccessForm />
        <p className="text-sm text-muted-foreground">
          Já tem senha?{" "}
          <Link href="/login" className="font-medium text-primary-text underline-offset-4 hover:underline">
            Entrar
          </Link>
        </p>
      </div>
    </main>
  );
}
