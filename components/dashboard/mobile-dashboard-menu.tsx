"use client";

import {
  CalendarClock,
  FileText,
  Headphones,
  Home,
  LogOut,
  MonitorUp,
  Sparkles,
  X,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useEffect } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { WorkspaceUser } from "@/components/workspace/types";

type DashboardItem =
  | "home"
  | "sessions"
  | "documents"
  | "instructions"
  | "how-to";

type MobileDashboardMenuProps = {
  activeItem: DashboardItem;
  isSigningOut: boolean;
  open: boolean;
  user: WorkspaceUser;
  onClose: () => void;
  onSignOut: () => void;
  onStartSetup?: () => void;
};

const navigationItems = [
  { href: "/dashboard", icon: Home, id: "home", label: "Home" },
  {
    href: "/dashboard/sessions",
    icon: CalendarClock,
    id: "sessions",
    label: "Sessions",
  },
  {
    href: "/dashboard/resumes",
    icon: FileText,
    id: "documents",
    label: "Meeting documents",
  },
  {
    href: "/dashboard/instructions",
    icon: Sparkles,
    id: "instructions",
    label: "Instructions",
  },
  {
    href: "/how-it-works",
    icon: Headphones,
    id: "how-to",
    label: "How to use",
  },
] satisfies Array<{
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  id: DashboardItem;
  label: string;
}>;

export function MobileDashboardMenu({
  activeItem,
  isSigningOut,
  open,
  user,
  onClose,
  onSignOut,
  onStartSetup,
}: MobileDashboardMenuProps) {
  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose, open]);

  if (!open) return null;

  const firstName = user.name?.split(" ")[0] ?? "Kasa user";
  const initial = firstName.slice(0, 1).toUpperCase();

  return (
    <div className="kasa-mobile-navigation-layer fixed inset-0 z-50 lg:hidden">
      <button
        aria-label="Close navigation"
        className="absolute inset-0 bg-slate-950/45 backdrop-blur-[2px] animate-in fade-in duration-200"
        onClick={onClose}
        type="button"
      />
      <aside
        aria-labelledby="mobile-navigation-title"
        aria-modal="true"
        className="relative flex h-full max-h-full w-[min(88vw,350px)] flex-col overflow-hidden border-r border-slate-200 bg-white shadow-2xl animate-in slide-in-from-left duration-200"
        role="dialog"
      >
        <div className="flex h-16 shrink-0 items-center justify-between border-b border-slate-200 px-4">
          <div className="flex items-center gap-3">
            <Image
              alt=""
              className="size-9 rounded-xl shadow-sm"
              height={36}
              priority
              src="/kasa-icon.png"
              width={36}
            />
            <div>
              <p id="mobile-navigation-title" className="font-semibold">
                Kasa Cue
              </p>
              <p className="text-xs text-slate-500">Communication copilot</p>
            </div>
          </div>
          <Button
            aria-label="Close menu"
            className="size-10 rounded-xl"
            onClick={onClose}
            size="icon"
            type="button"
            variant="ghost"
          >
            <X className="size-5" />
          </Button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-4">
          <div className="mb-4 rounded-2xl border border-slate-200 bg-slate-50 p-3">
            <div className="flex items-center gap-3">
              <div className="grid size-11 shrink-0 place-items-center rounded-xl bg-slate-950 text-sm font-bold text-white">
                {initial}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">
                  {user.name ?? "Kasa user"}
                </p>
                <p className="truncate text-xs text-slate-500">{user.email}</p>
              </div>
              <Badge className="shrink-0 bg-indigo-600 text-[10px] text-white hover:bg-indigo-600">
                {user.role}
              </Badge>
            </div>
          </div>

          {onStartSetup ? (
            <Button
              className="mb-4 h-11 w-full gap-2 rounded-xl bg-slate-950 text-white hover:bg-slate-800"
              onClick={() => {
                onClose();
                onStartSetup();
              }}
              type="button"
            >
              <MonitorUp className="size-4" />
              Start a session
            </Button>
          ) : null}

          <nav aria-label="Dashboard navigation" className="space-y-1">
            {navigationItems.map((item) => {
              const Icon = item.icon;
              const active = activeItem === item.id;

              return (
                <Link
                  aria-current={active ? "page" : undefined}
                  className={`flex h-12 items-center gap-3 rounded-xl px-3 text-sm font-semibold transition ${
                    active
                      ? "bg-slate-950 text-white shadow-sm"
                      : "text-slate-600 hover:bg-slate-100 hover:text-slate-950"
                  }`}
                  href={item.href}
                  key={item.id}
                  onClick={onClose}
                >
                  <Icon className="size-4.5" />
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="font-medium text-emerald-800">
                Available minutes
              </span>
              <span className="font-semibold text-emerald-950">Unlimited</span>
            </div>
            <Button
              asChild
              className="mt-3 h-9 w-full rounded-xl border-emerald-200 bg-white text-emerald-900 hover:bg-emerald-100"
              variant="outline"
            >
              <Link href="/pricing" onClick={onClose}>
                Manage plan
              </Link>
            </Button>
          </div>

        </div>

        <div className="sticky bottom-0 z-10 shrink-0 border-t border-slate-200 bg-white p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-[0_-8px_24px_rgba(15,23,42,0.06)]">
          <Button
            className="h-11 w-full gap-2 rounded-xl text-red-700 hover:bg-red-50 hover:text-red-800"
            disabled={isSigningOut}
            onClick={onSignOut}
            type="button"
            variant="ghost"
          >
            <LogOut className="size-4" />
            Sign out
          </Button>
        </div>
      </aside>
    </div>
  );
}
