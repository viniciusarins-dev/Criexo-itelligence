import type { ReactNode } from "react";

import { BrandLogo } from "./brand";
import { MobileNav } from "./mobile-nav";
import { SidebarNav } from "./sidebar-nav";
import { UserMenu, type UserMenuProps } from "./user-menu";

export function AppShell({ user, children }: { user: UserMenuProps; children: ReactNode }) {
  return (
    <div className="flex min-h-dvh">
      <a
        href="#conteudo"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-md focus:bg-primary focus:px-3 focus:py-2 focus:text-primary-foreground"
      >
        Pular para o conteúdo
      </a>

      <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-r border-border bg-surface lg:flex">
        <div className="flex h-16 items-center px-5">
          <BrandLogo />
        </div>
        <div className="flex-1 overflow-y-auto px-3 py-4">
          <SidebarNav />
        </div>
        <p className="border-t border-border px-5 py-4 text-[11px] leading-relaxed text-subtle-foreground">
          CRIEXO Soluções Criativas · uso interno
        </p>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-border bg-background/90 px-4 backdrop-blur sm:px-6">
          <MobileNav />
          <BrandLogo className="lg:hidden" />
          <div className="ml-auto">
            <UserMenu {...user} />
          </div>
        </header>
        <main id="conteudo" className="flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          {children}
        </main>
      </div>
    </div>
  );
}
