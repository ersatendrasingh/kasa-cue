"use client";

import {
  AudioLines,
  BadgeCheck,
  CalendarClock,
  Download,
  FileText,
  Headphones,
  Home,
  Laptop,
  Sparkles,
} from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import type { WorkspaceUser } from "@/components/workspace/types";

type DashboardSidebarProps = {
  activeItem?: "home" | "sessions" | "documents" | "instructions" | "how-to";
  user: WorkspaceUser;
};

export function DashboardSidebar({
  activeItem = "home",
  user,
}: DashboardSidebarProps) {
  const firstName = user.name?.split(" ")[0] ?? "K";

  return (
    <aside className="sticky left-0 top-0 hidden h-screen w-[280px] shrink-0 overflow-y-auto overscroll-contain border-r border-slate-200 bg-white lg:flex lg:flex-col">
      <div className="flex h-20 items-center gap-3 border-b border-slate-200 px-6">
        <div className="flex size-10 items-center justify-center rounded-md bg-slate-950 text-white">
          <AudioLines className="size-5" />
        </div>
        <div>
          <p className="text-lg font-semibold">Kasa Cue</p>
          <p className="text-xs text-slate-500">Communication copilot</p>
        </div>
      </div>

      <nav className="flex-1 space-y-1 px-4 py-5">
        <SidebarItem
          active={activeItem === "home"}
          href="/dashboard"
          icon={Home}
          label="Home"
        />
        <SidebarItem
          active={activeItem === "sessions"}
          href="/dashboard/sessions"
          icon={CalendarClock}
          label="Sessions"
        />
        <SidebarItem
          active={activeItem === "documents"}
          href="/dashboard/resumes"
          icon={FileText}
          label="Meeting documents"
        />
        <SidebarItem
          active={activeItem === "instructions"}
          href="/dashboard/instructions"
          icon={Sparkles}
          label="Instructions"
        />
        <SidebarItem
          active={activeItem === "how-to"}
          href="/how-it-works"
          icon={Headphones}
          label="How to use"
        />
      </nav>

      <div className="m-4 rounded-md border border-emerald-200 bg-emerald-50 p-4">
        <div className="mb-3 flex items-center gap-2 font-semibold text-emerald-950">
          <BadgeCheck className="size-4 text-emerald-700" />
          Session credits
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-emerald-800">Available minutes</span>
          <span className="font-semibold text-emerald-950">Unlimited</span>
        </div>
        <Separator className="my-3 bg-emerald-200" />
        <Button asChild className="w-full bg-emerald-700 text-white hover:bg-emerald-800">
          <Link href="/pricing">Manage plan</Link>
        </Button>
      </div>

      <div className="mx-4 mb-4 rounded-md border border-slate-200 bg-slate-50 p-4">
        <div className="mb-3 flex items-center gap-2 font-semibold text-slate-950">
          <Laptop className="size-4 text-slate-700" />
          Desktop app
        </div>
        <p className="mb-3 text-xs leading-5 text-slate-500">
          Desktop app for live sessions and floating answers.
        </p>
        <Button
          asChild
          className="h-9 w-full gap-2 bg-slate-950 text-white hover:bg-slate-800"
        >
          <a href="/api/desktop/download?platform=mac-arm64">
            <Download className="size-4" />
            Mac M-series
          </a>
        </Button>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <a
            className="inline-flex h-8 items-center justify-center rounded-md border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-100"
            href="/api/desktop/download?platform=mac-x64"
          >
            Intel Mac
          </a>
          <a
            className="inline-flex h-8 items-center justify-center rounded-md border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-100"
            href="/api/desktop/download?platform=windows-x64"
          >
            Windows
          </a>
        </div>
      </div>

      <div className="border-t border-slate-200 p-4">
        <div className="flex items-center gap-3 rounded-md bg-slate-50 p-3">
          <div className="flex size-9 items-center justify-center rounded-md bg-slate-900 text-sm font-semibold text-white">
            {firstName.slice(0, 1).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">
              {user.name ?? "Kasa user"}
            </p>
            <p className="truncate text-xs text-slate-500">{user.email}</p>
          </div>
        </div>
      </div>
    </aside>
  );
}

function SidebarItem({
  active,
  href,
  icon: Icon,
  label,
}: {
  active?: boolean;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
}) {
  return (
    <Link
      href={href}
      className={`flex w-full items-center gap-3 rounded-md px-3 py-3 text-sm font-medium transition ${
        active
          ? "bg-slate-950 text-white"
          : "text-slate-600 hover:bg-slate-100 hover:text-slate-950"
      }`}
    >
      <Icon className="size-4" />
      {label}
    </Link>
  );
}
