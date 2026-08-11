import { auth } from "@/auth";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { Badge } from "@/components/ui/badge";
import { prisma } from "@/lib/prisma";
import { CalendarClock, MessageSquareText } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

export default async function SessionsPage() {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login?callbackUrl=/dashboard/sessions");
  }

  if (session.user.role === "admin") {
    redirect("/admin");
  }

  const sessions = await prisma.communicationSession.findMany({
    where: {
      userId: session.user.id,
    },
    orderBy: {
      startedAt: "desc",
    },
    take: 50,
    select: {
      id: true,
      endedAt: true,
      language: true,
      mode: true,
      model: true,
      referenceFiles: true,
      resumeFileName: true,
      startedAt: true,
      title: true,
      _count: {
        select: {
          turns: true,
        },
      },
    },
  });

  return (
    <DashboardShell activeItem="sessions" user={session.user}>
      <div className="border-b border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-950 sm:px-6">
        <span className="font-semibold">History:</span> Review saved call,
        interview, and normal talk sessions.
      </div>

      <div className="flex-1 px-4 py-6 sm:px-6 lg:px-8">
        <div className="mb-6 flex flex-col gap-2">
          <h1 className="text-3xl font-semibold tracking-tight">
            Session history
          </h1>
          <p className="max-w-2xl text-sm leading-6 text-slate-600">
            Every saved transcript line and generated answer appears inside its
            session detail page.
          </p>
        </div>

        {sessions.length ? (
          <div className="grid gap-3">
            {sessions.map((item) => (
              <Link
                className="grid gap-4 rounded-lg border border-slate-200 bg-white p-4 shadow-sm transition hover:border-slate-300 hover:shadow-md lg:grid-cols-[1fr_auto]"
                href={`/dashboard/sessions/${item.id}`}
                key={item.id}
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="truncate text-lg font-semibold">
                      {item.title ?? formatMode(item.mode)}
                    </h2>
                    <Badge
                      className={
                        item.endedAt
                          ? "bg-slate-100 text-slate-700 hover:bg-slate-100"
                          : "bg-emerald-600 text-white hover:bg-emerald-600"
                      }
                    >
                      {item.endedAt ? "Ended" : "Live"}
                    </Badge>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-600">
                    <span>{formatDateTime(item.startedAt)}</span>
                    <span>{formatMode(item.mode)}</span>
                    <span>{item.language}</span>
                    <span>{item.model}</span>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-500">
                    {item.resumeFileName ? (
                      <span className="rounded-full bg-slate-100 px-2 py-1">
                        Resume: {item.resumeFileName}
                      </span>
                    ) : null}
                    {Array.isArray(item.referenceFiles)
                      ? item.referenceFiles.slice(0, 3).map((file) => (
                          <span
                            className="rounded-full bg-slate-100 px-2 py-1"
                            key={String(file)}
                          >
                            {String(file)}
                          </span>
                        ))
                      : null}
                  </div>
                </div>
                <div className="flex items-center gap-4 text-sm text-slate-600 lg:justify-end">
                  <div className="flex items-center gap-2">
                    <MessageSquareText className="size-4" />
                    <span>{item._count.turns} turns</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CalendarClock className="size-4" />
                    <span>{formatDuration(item.startedAt, item.endedAt)}</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-slate-300 bg-white p-8 text-center">
            <CalendarClock className="mx-auto mb-3 size-8 text-slate-400" />
            <h2 className="font-semibold">No sessions yet</h2>
            <p className="mt-2 text-sm text-slate-600">
              Start a session from the dashboard and your saved conversation
              will appear here.
            </p>
          </div>
        )}
      </div>
    </DashboardShell>
  );
}

function formatMode(mode: string) {
  if (mode === "interview") {
    return "Interview";
  }

  if (mode === "normal-talk") {
    return "Normal talk";
  }

  return "Client call";
}

function formatDateTime(value: Date) {
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeZone: "Asia/Kolkata",
    timeStyle: "short",
  }).format(value);
}

function formatDuration(startedAt: Date, endedAt: Date | null) {
  const end = endedAt ?? new Date();
  const totalSeconds = Math.max(
    0,
    Math.floor((end.getTime() - startedAt.getTime()) / 1000)
  );
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${minutes}m ${seconds.toString().padStart(2, "0")}s`;
}
