"use client";

import { MotionConfig } from "motion/react";
import type { ReactNode } from "react";

/** Respeita prefers-reduced-motion em todas as animações do Motion. */
export function MotionProvider({ children }: { children: ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}
