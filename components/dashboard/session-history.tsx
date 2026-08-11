"use client";

import { CalendarClock } from "lucide-react";
import Link from "next/link";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import type { DashboardSessionSummary } from "./types";

type SessionHistoryProps = {
  sessions: DashboardSessionSummary[];
};

export function SessionHistory({ sessions }: SessionHistoryProps) {
  return (
    <Card className="rounded-md border-slate-200 bg-white shadow-sm">
      <CardHeader>
        <CardTitle>Session history</CardTitle>
        <CardDescription>
          Saved sessions stay here for review and follow-up.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {sessions.length ? (
          <div className="grid gap-3">
            {sessions.map((session) => (
              <Link
                className="flex items-center justify-between gap-3 rounded-md border border-slate-200 bg-slate-50 p-3 transition hover:border-slate-300 hover:bg-white"
                href={`/dashboard/sessions/${session.id}`}
                key={session.id}
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">
                    {session.title ?? formatMode(session.mode)}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    {formatDate(session.startedAt)} ·{" "}
                    {formatDuration(session.startedAt, session.endedAt)}
                  </p>
                </div>
                <div className="shrink-0 text-right text-xs text-slate-500">
                  <p className="font-medium text-slate-900">
                    {session.turnsCount} turns
                  </p>
                  <p>{session.endedAt ? "Ended" : "Live"}</p>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="rounded-md border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-500">
            <CalendarClock className="mb-2 size-5" />
            No sessions yet. Start one from the setup modal.
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function formatMode(mode: string) {
  if (mode === "interview") {
    return "Interview session";
  }

  if (mode === "normal-talk") {
    return "Normal talk session";
  }

  return "Client call session";
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    timeZone: "Asia/Kolkata",
    year: "numeric",
  }).format(new Date(value));
}

function formatDuration(startedAt: string, endedAt: string | null) {
  const end = endedAt ? new Date(endedAt) : new Date();
  const totalSeconds = Math.max(
    0,
    Math.floor((end.getTime() - new Date(startedAt).getTime()) / 1000)
  );
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${minutes}m ${seconds.toString().padStart(2, "0")}s`;
}
