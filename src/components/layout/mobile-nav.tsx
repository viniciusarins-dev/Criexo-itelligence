"use client";

import { Menu, X } from "lucide-react";
import { AnimatePresence, m } from "motion/react";
import { Dialog } from "radix-ui";
import { useState } from "react";

import { Button } from "@/components/ui/button";

import { BrandLogo } from "./brand";
import { SidebarNav } from "./sidebar-nav";

export function MobileNav() {
  const [open, setOpen] = useState(false);

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Abrir menu de navegação">
          <Menu aria-hidden="true" />
        </Button>
      </Dialog.Trigger>
      <AnimatePresence>
        {open ? (
          <Dialog.Portal forceMount>
            <Dialog.Overlay asChild forceMount>
              <m.div
                className="fixed inset-0 z-40 bg-overlay"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
              />
            </Dialog.Overlay>
            <Dialog.Content asChild forceMount aria-describedby={undefined}>
              <m.div
                className="fixed inset-y-0 left-0 z-50 flex w-72 max-w-[85vw] flex-col border-r border-border bg-surface p-4 outline-none"
                initial={{ x: "-100%" }}
                animate={{ x: 0 }}
                exit={{ x: "-100%" }}
                transition={{ type: "tween", duration: 0.2, ease: "easeOut" }}
              >
                <div className="mb-6 flex items-center justify-between">
                  <Dialog.Title asChild>
                    <span>
                      <BrandLogo />
                      <span className="sr-only">Menu de navegação</span>
                    </span>
                  </Dialog.Title>
                  <Dialog.Close asChild>
                    <Button variant="ghost" size="icon" aria-label="Fechar menu">
                      <X aria-hidden="true" />
                    </Button>
                  </Dialog.Close>
                </div>
                <SidebarNav onNavigate={() => setOpen(false)} />
              </m.div>
            </Dialog.Content>
          </Dialog.Portal>
        ) : null}
      </AnimatePresence>
    </Dialog.Root>
  );
}
