"use client";

import { Play } from "lucide-react";
import { useState } from "react";

import { ContextLibrary } from "@/components/dashboard/context-library";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { StartSessionModal } from "@/components/dashboard/modals/start-session-modal";
import { SessionHistory } from "@/components/dashboard/session-history";
import { SetupSteps } from "@/components/dashboard/setup-steps";
import type { DashboardProps } from "@/components/dashboard/types";
import { UsageCard } from "@/components/dashboard/usage-card";
import { Button } from "@/components/ui/button";

export default function UserDashboard({
  documents,
  openStartSession = false,
  sessions,
  user,
}: DashboardProps & { openStartSession?: boolean }) {
  const [isStartModalOpen, setIsStartModalOpen] = useState(openStartSession);

  return (
    <DashboardShell user={user} onStartSetup={() => setIsStartModalOpen(true)}>
      <div className="border-b border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-950 sm:px-6">
        <span className="font-semibold">Mobile ready:</span> Use Kasa Cue for
        team meetings, daily standups, client calls, and project KT.
      </div>

      <div className="flex-1 space-y-6 px-4 py-6 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              Prepare your next work meeting.
            </h2>
            <p className="mt-2 max-w-2xl text-slate-600">
              Add your agenda or project notes, choose the call type, and open
              a live mobile-friendly transcript and reply workspace.
            </p>
          </div>
          <Button
            className="w-full gap-2 bg-slate-950 text-white hover:bg-slate-800 sm:w-auto"
            onClick={() => setIsStartModalOpen(true)}
          >
            <Play className="size-4" />
            Start session
          </Button>
        </div>

        <SetupSteps onStart={() => setIsStartModalOpen(true)} />

        <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
          <SessionHistory sessions={sessions} />
          <div className="space-y-6">
            <ContextLibrary />
            <UsageCard sessionsCount={sessions.length} />
          </div>
        </div>
      </div>

      <StartSessionModal
        documents={documents}
        open={isStartModalOpen}
        onClose={() => setIsStartModalOpen(false)}
      />
    </DashboardShell>
  );
}
