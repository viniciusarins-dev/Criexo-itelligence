"use client";

import { useEffect, useRef } from "react";
import { toast } from "sonner";

import type { ActionState } from "@/lib/validation/form-data";

/** Mostra uma notificação discreta a cada resposta de uma Server Action. */
export function useActionFeedback(state: ActionState) {
  const last = useRef<number | undefined>(undefined);
  useEffect(() => {
    if (!state.submittedAt || state.submittedAt === last.current) return;
    last.current = state.submittedAt;
    if (state.status === "success" && state.message) toast.success(state.message);
    if (state.status === "error" && state.message) toast.error(state.message);
  }, [state]);
}
