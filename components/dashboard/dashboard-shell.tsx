"use client";

import { AudioLines, LogOut, MonitorUp, ShieldCheck } from "lucide-react";
import { signOut } from "next-auth/react";
import { useState } from "react";

import { DashboardSidebar } from "@/components/dashboard/dashboard-sidebar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { LoadingOverlay } from "@/components/ui/loading-overlay";
import type { WorkspaceUser } from "@/components/workspace/types";

type DashboardShellProps = {
  activeItem?: "home" | "sessions" | "documents" | "instructions" | "how-to";
  children: React.ReactNode;
  onStartSetup?: () => void;
  user: WorkspaceUser;
};

export function DashboardShell({
  activeItem = "home",
  children,
  onStartSetup,
  user,
}: DashboardShellProps) {
  const [isSigningOut, setIsSigningOut] = useState(false);
  const firstName = user.name?.split(" ")[0] ?? "there";

  return (
    <main className="min-h-screen bg-slate-50 text-slate-950">
      <div className="flex min-h-screen">
        <DashboardSidebar activeItem={activeItem} user={user} />

        <section className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-30 flex flex-col gap-3 border-b border-slate-200 bg-white/95 px-4 py-4 backdrop-blur sm:px-6 lg:h-20 lg:flex-row lg:items-center lg:justify-between lg:py-0">
            <div className="flex items-center gap-3 lg:hidden">
              <div className="flex size-9 items-center justify-center rounded-md bg-slate-950 text-white">
                <AudioLines className="size-4" />
              </div>
              <div>
                <p className="font-semibold">Kasa Cue</p>
                <p className="text-xs text-slate-500">Communication copilot</p>
              </div>
            </div>
            <div className="hidden lg:block">
              <p className="text-sm text-slate-500">Dashboard</p>
              <h1 className="text-xl font-semibold">Hi {firstName}.</h1>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge className="gap-1.5 bg-indigo-600 text-white hover:bg-indigo-600">
                <ShieldCheck className="size-3.5" />
                {user.role}
              </Badge>
              {onStartSetup ? (
                <Button variant="outline" onClick={onStartSetup}>
                  <MonitorUp className="size-4" />
                  Start setup
                </Button>
              ) : null}
              <Button
                variant="outline"
                disabled={isSigningOut}
                onClick={() => {
                  setIsSigningOut(true);
                  void signOut({ callbackUrl: "/" });
                }}
              >
                <LogOut className="size-4" />
                Sign out
              </Button>
            </div>
          </header>

          {children}
        </section>
      </div>
      {isSigningOut ? (
        <LoadingOverlay label="Signing you out" />
      ) : null}
    </main>
  );
}
