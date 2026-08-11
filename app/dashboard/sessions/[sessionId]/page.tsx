import { auth } from "@/auth";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { Badge } from "@/components/ui/badge";
import { prisma } from "@/lib/prisma";
import {
  ArrowLeft,
  Bot,
  CalendarClock,
  FileText,
  MessageSquareText,
  UserRound,
} from "lucide-react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

type SessionDetailPageProps = {
  params: Promise<{
    sessionId: string;
  }>;
};

export default async function SessionDetailPage({
  params,
}: SessionDetailPageProps) {
  const authSession = await auth();

  if (!authSession?.user?.id) {
    redirect("/login?callbackUrl=/dashboard/sessions");
  }

  if (authSession.user.role === "admin") {
    redirect("/admin");
  }

  const { sessionId } = await params;
  const session = await prisma.communicationSession.findFirst({
    where: {
      id: sessionId,
      userId: authSession.user.id,
    },
    select: {
      context: true,
      endedAt: true,
      instructions: true,
      language: true,
      mode: true,
      model: true,
      referenceFiles: true,
      resumeFileName: true,
      startedAt: true,
      title: true,
      tone: true,
      turns: {
        orderBy: {
          createdAt: "asc",
        },
        select: {
          content: true,
          createdAt: true,
          id: true,
          model: true,
          speaker: true,
        },
      },
    },
  });

  if (!session) {
    notFound();
  }

  return (
    <DashboardShell activeItem="sessions" user={authSession.user}>
      <div className="border-b border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-950 sm:px-6">
        <span className="font-semibold">Session detail:</span> Full saved
        conversation and generated replies.
      </div>

      <div className="flex-1 px-4 py-6 sm:px-6 lg:px-8">
        <Link
          className="mb-5 inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-slate-950"
          href="/dashboard/sessions"
        >
          <ArrowLeft className="size-4" />
          Back to sessions
        </Link>

        <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
          <section className="min-w-0">
            <div className="mb-5 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div>
                  <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
                    {session.title ?? formatMode(session.mode)}
                  </h1>
                  <p className="mt-2 text-sm text-slate-600">
                    {formatDateTime(session.startedAt)} ·{" "}
                    {formatDuration(session.startedAt, session.endedAt)}
                  </p>
                </div>
                <Badge
                  className={
                    session.endedAt
                      ? "bg-slate-100 text-slate-700 hover:bg-slate-100"
                      : "bg-emerald-600 text-white hover:bg-emerald-600"
                  }
                >
                  {session.endedAt ? "Ended" : "Live"}
                </Badge>
              </div>
            </div>

            <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-200 p-5">
                <h2 className="flex items-center gap-2 font-semibold">
                  <MessageSquareText className="size-5 text-emerald-600" />
                  Conversation timeline
                </h2>
                <p className="mt-1 text-sm text-slate-600">
                  {session.turns.length} saved turns
                </p>
              </div>

              {session.turns.length ? (
                <div className="divide-y divide-slate-100">
                  {session.turns.map((turn) => (
                    <article className="grid gap-3 p-5 md:grid-cols-[160px_1fr]" key={turn.id}>
                      <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                        {turn.speaker === "assistant" ? (
                          <Bot className="size-4 text-emerald-600" />
                        ) : (
                          <UserRound className="size-4 text-indigo-600" />
                        )}
                        <span>{formatSpeaker(turn.speaker)}</span>
                      </div>
                      <div>
                        <p className="whitespace-pre-wrap text-sm leading-7 text-slate-800">
                          {turn.content}
                        </p>
                        <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-500">
                          <span>{formatDateTime(turn.createdAt)}</span>
                          {turn.model ? <span>Model: {turn.model}</span> : null}
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <div className="p-8 text-center text-sm text-slate-500">
                  No conversation turns were saved for this session yet.
                </div>
              )}
            </div>
          </section>

          <aside className="space-y-4">
            <InfoCard
              icon={CalendarClock}
              items={[
                ["Mode", formatMode(session.mode)],
                ["Language", session.language],
                ["Model", session.model],
                ["Tone", session.tone ?? "adaptive"],
              ]}
              title="Session setup"
            />
            <InfoCard
              icon={FileText}
              items={[
                ["Resume", session.resumeFileName ?? "Not attached"],
                [
                  "References",
                  Array.isArray(session.referenceFiles) &&
                  session.referenceFiles.length
                    ? session.referenceFiles.map(String).join(", ")
                    : "Not attached",
                ],
              ]}
              title="Context files"
            />
            {session.instructions ? (
              <TextCard title="Instructions" value={session.instructions} />
            ) : null}
            {session.context ? (
              <TextCard title="Meeting setup" value={session.context} />
            ) : null}
          </aside>
        </div>
      </div>
    </DashboardShell>
  );
}

function InfoCard({
  icon: Icon,
  items,
  title,
}: {
  icon: React.ComponentType<{ className?: string }>;
  items: Array<[string, string]>;
  title: string;
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="mb-4 flex items-center gap-2 font-semibold">
        <Icon className="size-5 text-emerald-600" />
        {title}
      </h2>
      <div className="space-y-3">
        {items.map(([label, value]) => (
          <div key={label}>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
              {label}
            </p>
            <p className="mt-1 break-words text-sm text-slate-800">{value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function TextCard({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="font-semibold">{title}</h2>
      <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-700">
        {value}
      </p>
    </div>
  );
}

function formatSpeaker(speaker: string) {
  if (speaker === "assistant") {
    return "Kasa Cue";
  }

  if (speaker === "other") {
    return "Other speaker";
  }

  return "You";
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
