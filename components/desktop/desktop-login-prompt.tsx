"use client";

import { ExternalLink, LockKeyhole } from "lucide-react";

import { Button } from "@/components/ui/button";

import { DesktopWindowShell } from "./setup/desktop-window-shell";

export function DesktopLoginPrompt() {
  async function openBrowserLogin() {
    const opened = await window.kasaDesktop?.openLogin?.();

    if (opened === false || !window.kasaDesktop) {
      window.location.href = "/api/desktop/auth/start";
    }
  }

  return (
    <DesktopWindowShell>
      <div className="flex h-full min-h-[440px] flex-col justify-center space-y-5 p-6 text-slate-950">
        <div className="grid size-12 place-items-center rounded-xl bg-slate-950 text-white">
          <LockKeyhole className="size-5" />
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-normal">Sign in required</h1>
          <p className="text-sm leading-6 text-slate-600">
            Continue in your browser, then Kasa Cue will return to this desktop
            window automatically.
          </p>
        </div>
        <Button
          className="h-11 gap-2 rounded-xl bg-slate-950 text-white hover:bg-slate-800 hover:text-white"
          onClick={() => void openBrowserLogin()}
          type="button"
        >
          <ExternalLink className="size-4" />
          Sign in in browser
        </Button>
      </div>
    </DesktopWindowShell>
  );
}
