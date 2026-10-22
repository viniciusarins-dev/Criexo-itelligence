import type { ReactNode } from "react";

import { AppShell } from "@/components/layout/app-shell";
import { requireActiveMember } from "@/lib/auth/session";

export default async function AuthenticatedLayout({ children }: { children: ReactNode }) {
  const member = await requireActiveMember();

  return (
    <AppShell user={{ displayName: member.displayName, email: member.email, role: member.role }}>
      {children}
    </AppShell>
  );
}
