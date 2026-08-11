"use client";

import { LogOut, Menu, MonitorUp, ShieldCheck } from "lucide-react";
import Image from "next/image";
import { signOut } from "next-auth/react";
import { useCallback, useState } from "react";

import { MobileDashboardMenu } from "@/components/dashboard/mobile-dashboard-menu";
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
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const firstName = user.name?.split(" ")[0] ?? "there";

  const handleSignOut = useCallback(() => {
    setIsSigningOut(true);
    void signOut({ callbackUrl: "/" });
  }, []);

  return (
    <main className="min-h-screen bg-slate-50 text-slate-950">
      <div className="flex min-h-screen">
        <DashboardSidebar activeItem={activeItem} user={user} />

        <section className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-2 border-b border-slate-200 bg-white/95 px-3 backdrop-blur sm:px-4 lg:h-20 lg:px-6">
            <div className="flex min-w-0 items-center gap-2.5 lg:hidden">
              <Button
                aria-label="Open navigation menu"
                className="size-10 shrink-0 rounded-xl"
                onClick={() => setIsMobileMenuOpen(true)}
                size="icon"
                type="button"
                variant="outline"
              >
                <Menu className="size-5" />
              </Button>
              <Image
                alt="Kasa Cue"
                className="size-9 shrink-0 rounded-xl shadow-sm"
                height={36}
                priority
                src="/kasa-icon.png"
                width={36}
              />
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">Kasa Cue</p>
                <p className="truncate text-xs text-slate-500">
                  Hi {firstName}
                </p>
              </div>
            </div>
            <div className="hidden lg:block">
              <p className="text-sm text-slate-500">Dashboard</p>
              <h1 className="text-xl font-semibold">Hi {firstName}.</h1>
            </div>
            <div className="hidden items-center gap-2 lg:flex">
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
                onClick={handleSignOut}
              >
                <LogOut className="size-4" />
                Sign out
              </Button>
            </div>
            <button
              aria-label={`Open ${firstName}'s account menu`}
              className="grid size-10 shrink-0 place-items-center rounded-full bg-slate-950 text-sm font-bold text-white lg:hidden"
              onClick={() => setIsMobileMenuOpen(true)}
              type="button"
            >
              {firstName.slice(0, 1).toUpperCase()}
            </button>
          </header>

          {children}
        </section>
      </div>
      {isSigningOut ? (
        <LoadingOverlay label="Signing you out" />
      ) : null}
      <MobileDashboardMenu
        activeItem={activeItem}
        isSigningOut={isSigningOut}
        open={isMobileMenuOpen}
        user={user}
        onClose={() => setIsMobileMenuOpen(false)}
        onSignOut={handleSignOut}
        onStartSetup={onStartSetup}
      />
    </main>
  );
}
