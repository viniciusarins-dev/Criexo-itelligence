"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { TeamMember } from "@/server/repositories/settings";

import { setMemberAccess } from "./actions";

function MemberRow({ member, isSelf }: { member: TeamMember; isSelf: boolean }) {
  const [pending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(false);

  function apply(role: TeamMember["role"], isActive: boolean) {
    startTransition(async () => {
      const result = await setMemberAccess({ userId: member.id, role, isActive });
      if (result.status === "success") toast.success(result.message ?? "Acesso atualizado.");
      else toast.error(result.message ?? "Não foi possível alterar o acesso.");
      setConfirming(false);
    });
  }

  return (
    <TableRow>
      <TableCell>
        <p className="font-medium text-foreground">
          {member.displayName}
          {isSelf ? <span className="ml-2 text-xs font-normal text-subtle-foreground">(você)</span> : null}
        </p>
        <p className="text-xs text-subtle-foreground">{member.email ?? "—"}</p>
      </TableCell>
      <TableCell>
        <label className="sr-only" htmlFor={`role-${member.id}`}>
          Papel de {member.displayName}
        </label>
        <NativeSelect
          id={`role-${member.id}`}
          value={member.role}
          disabled={isSelf || pending}
          onChange={(event) => apply(event.target.value as TeamMember["role"], member.isActive)}
          className="h-9 min-w-36"
        >
          <option value="admin">Administrador</option>
          <option value="member">Membro</option>
        </NativeSelect>
      </TableCell>
      <TableCell>
        {member.isActive ? <Badge tone="success">Ativo</Badge> : <Badge tone="warning">Aguardando liberação</Badge>}
      </TableCell>
      <TableCell className="text-right">
        {isSelf ? null : member.isActive ? (
          confirming ? (
            <span className="inline-flex flex-wrap justify-end gap-2">
              <Button size="sm" variant="danger" disabled={pending} onClick={() => apply(member.role, false)}>
                Confirmar bloqueio
              </Button>
              <Button size="sm" variant="ghost" disabled={pending} onClick={() => setConfirming(false)}>
                Cancelar
              </Button>
            </span>
          ) : (
            <Button size="sm" variant="secondary" disabled={pending} onClick={() => setConfirming(true)}>
              Bloquear acesso
            </Button>
          )
        ) : (
          <Button size="sm" variant="secondary" disabled={pending} onClick={() => apply(member.role, true)}>
            Liberar acesso
          </Button>
        )}
      </TableCell>
    </TableRow>
  );
}

export function TeamTable({ team, currentUserId }: { team: TeamMember[]; currentUserId: string }) {
  return (
    <Table>
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          <TableHead>Pessoa</TableHead>
          <TableHead>Papel</TableHead>
          <TableHead>Acesso</TableHead>
          <TableHead className="text-right">Ações</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {team.map((member) => (
          <MemberRow key={member.id} member={member} isSelf={member.id === currentUserId} />
        ))}
      </TableBody>
    </Table>
  );
}
