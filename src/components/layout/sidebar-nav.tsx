"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

import { NAV_ITEMS } from "./nav-items";

export function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();

  const available = NAV_ITEMS.filter((item) => item.available);
  const planned = NAV_ITEMS.filter((item) => !item.available);
  const base =
    "flex h-9 items-center gap-3 rounded-md px-3 text-sm transition-colors [&_svg]:size-[18px] [&_svg]:shrink-0";

  return (
    <nav aria-label="Navegação principal" className="space-y-6">
      <ul className="flex flex-col gap-0.5">
        {available.map((item) => {
          const Icon = item.icon;
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                onClick={onNavigate}
                aria-current={active ? "page" : undefined}
                className={cn(
                  base,
                  active
                    ? "bg-primary-subtle font-medium text-foreground [&_svg]:text-primary"
                    : "text-muted-foreground hover:bg-surface-hover hover:text-foreground",
                )}
              >
                <Icon aria-hidden="true" />
                <span className="truncate">{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>

      {planned.length > 0 ? (
        <div>
          <p id="nav-planned" className="mb-1.5 px-3 text-[11px] font-medium tracking-wide text-subtle-foreground uppercase">
            Em desenvolvimento
          </p>
          {/* Áreas ainda não implementadas: listadas, mas não navegáveis. */}
          <ul aria-labelledby="nav-planned" className="flex flex-col gap-0.5">
            {planned.map((item) => {
              const Icon = item.icon;
              return (
                <li key={item.href}>
                  <span aria-disabled="true" className={cn(base, "cursor-not-allowed text-subtle-foreground")}>
                    <Icon aria-hidden="true" />
                    <span className="truncate">{item.label}</span>
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
    </nav>
  );
}
