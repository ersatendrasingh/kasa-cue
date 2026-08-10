"use client";

import { ChevronUp, Infinity, X } from "lucide-react";
import { useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DesktopUpdateBanner } from "@/components/desktop/desktop-update-banner";

type DesktopWindowShellProps = {
  children: React.ReactNode;
};

export function DesktopWindowShell({ children }: DesktopWindowShellProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);

  useEffect(() => {
    const previousBodyBackground = document.body.style.background;
    const previousHtmlBackground = document.documentElement.style.background;

    document.body.style.background = "transparent";
    document.documentElement.style.background = "transparent";

    return () => {
      document.body.style.background = previousBodyBackground;
      document.documentElement.style.background = previousHtmlBackground;
    };
  }, []);

  async function collapseSetup() {
    const didCollapse = await window.kasaDesktop?.collapseSetup?.();

    if (didCollapse !== false) {
      setIsCollapsed(true);
    }
  }

  async function expandSetup() {
    const didExpand = await window.kasaDesktop?.expandSetup?.();

    if (didExpand !== false) {
      setIsCollapsed(false);
    }
  }

  if (isCollapsed) {
    return (
      <main className="desktop-drag flex h-screen w-screen justify-center bg-transparent p-2">
        <button
          className="desktop-no-drag grid size-10 place-items-center rounded-2xl bg-blue-600 text-base font-black text-white shadow-2xl ring-1 ring-white/20 transition hover:bg-blue-500"
          onClick={() => void expandSetup()}
          type="button"
        >
          K
        </button>
      </main>
    );
  }

  return (
    <main className="h-screen bg-transparent p-3 text-slate-950">
      <section className="mx-auto flex h-full w-full max-w-[520px] flex-col overflow-hidden rounded-[18px] border border-slate-200 bg-white shadow-2xl">
        <header className="desktop-drag flex h-14 shrink-0 items-center justify-between border-b border-slate-100 px-4">
          <div className="flex min-w-0 items-center gap-3">
            <span className="grid size-8 place-items-center rounded-xl bg-blue-600 text-lg font-black text-white">
              K
            </span>
            <h1 className="truncate text-base font-semibold">Kasa Cue</h1>
          </div>
          <div className="desktop-no-drag flex items-center gap-2">
            <Badge className="h-8 gap-1.5 rounded-xl bg-amber-50 px-2.5 text-amber-700 hover:bg-amber-100 hover:text-amber-800">
              <Infinity className="size-4" />
              Unlimited
            </Badge>
            <IconButton
              label="Minimize"
              onClick={() => void collapseSetup()}
            >
              <ChevronUp className="size-4" />
            </IconButton>
            <Button
              className="size-9 rounded-xl bg-red-500 p-0 text-white hover:bg-red-600 hover:text-white"
              onClick={() => window.kasaDesktop?.closeWindow?.()}
              type="button"
            >
              <X className="size-5" />
            </Button>
          </div>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
        <DesktopUpdateBanner />
      </section>
    </main>
  );
}

function IconButton({
  children,
  label,
  onClick,
}: {
  children: React.ReactNode;
  label: string;
  onClick?: () => void;
}) {
  return (
    <Button
      aria-label={label}
      className="size-9 rounded-xl border-slate-200 bg-white p-0 text-slate-700 hover:bg-slate-100 hover:text-slate-950"
      onClick={onClick}
      type="button"
      variant="outline"
    >
      {children}
    </Button>
  );
}
