"use client";

import { Loader2, Save } from "lucide-react";
import { useFormStatus } from "react-dom";

import { Button } from "@/components/ui/button";

export function SaveButton({ label = "Salvar", disabled }: { label?: string; disabled?: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending || disabled}>
      {pending ? <Loader2 aria-hidden="true" className="animate-spin" /> : <Save aria-hidden="true" />}
      {pending ? "Salvando…" : label}
    </Button>
  );
}
