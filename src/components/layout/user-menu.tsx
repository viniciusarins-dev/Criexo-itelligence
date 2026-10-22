"use client";

import { LogOut } from "lucide-react";
import { useTransition } from "react";
import { toast } from "sonner";

import { signOut } from "@/app/(app)/actions";
import { Avatar } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const ROLE_LABELS = { admin: "Administrador", member: "Membro" } as const;

export type UserMenuProps = {
  displayName: string;
  email: string | null;
  role: keyof typeof ROLE_LABELS;
};

export function UserMenu({ displayName, email, role }: UserMenuProps) {
  const [pending, startTransition] = useTransition();

  function handleSignOut() {
    startTransition(async () => {
      const result = await signOut();
      // Em caso de sucesso a action redireciona; só retorna quando falha.
      if (result?.error) toast.error(result.error);
    });
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="flex items-center gap-2.5 rounded-md p-1 pr-2 text-left outline-none hover:bg-surface-hover focus-visible:ring-2 focus-visible:ring-ring"
        aria-label={`Menu do usuário ${displayName}`}
      >
        <Avatar name={displayName} />
        <span className="hidden flex-col leading-tight sm:flex">
          <span className="max-w-40 truncate text-sm font-medium">{displayName}</span>
          <span className="text-xs text-muted-foreground">{ROLE_LABELS[role]}</span>
        </span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>
          <span className="block truncate font-medium text-foreground">{displayName}</span>
          {email ? <span className="block truncate">{email}</span> : null}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          disabled={pending}
          onSelect={(event) => {
            event.preventDefault();
            handleSignOut();
          }}
        >
          <LogOut aria-hidden="true" />
          {pending ? "Saindo…" : "Sair"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
