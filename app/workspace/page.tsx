import { auth } from "@/auth";
import type { ActiveWorkspaceSession } from "@/components/workspace/types";
import CopilotApp from "@/components/copilot-app";
import { prisma } from "@/lib/prisma";
import { buildSessionContextMemory } from "@/lib/session-context-memory";
import { redirect } from "next/navigation";

type WorkspacePageProps = {
  searchParams: Promise<{
    sessionId?: string;
  }>;
};

export default async function WorkspacePage({ searchParams }: WorkspacePageProps) {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login");
  }

  const { sessionId } = await searchParams;

  if (!sessionId) {
    redirect("/dashboard");
  }

  let activeSession = await prisma.communicationSession.findFirst({
    where: {
      id: sessionId,
      userId: session.user.id,
    },
    select: {
      id: true,
      context: true,
      instructions: true,
      language: true,
      mode: true,
      model: true,
      referenceDocumentIds: true,
      referenceFiles: true,
      resumeDocumentId: true,
      resumeFileName: true,
      startedAt: true,
      title: true,
      tone: true,
    },
  });

  if (!activeSession) {
    redirect("/dashboard");
  }

  const [recentSessions, referenceDocuments] = await Promise.all([
    prisma.communicationSession.findMany({
      where: {
        userId: session.user.id,
      },
      orderBy: {
        startedAt: "desc",
      },
      take: 8,
      select: {
        id: true,
        startedAt: true,
        title: true,
        turns: {
          orderBy: {
            createdAt: "desc",
          },
          take: 40,
          select: {
            content: true,
            speaker: true,
          },
        },
      },
    }),
    prisma.userDocument.findMany({
      where: {
        id: {
          in: normalizeStringArray(activeSession.referenceDocumentIds),
        },
        userId: session.user.id,
      },
      select: {
        extractedText: true,
        fileName: true,
      },
    }),
  ]);
  const historyContext = buildHistorySnapshot({
    activeSessionId: activeSession.id,
    recentSessions,
    referenceDocuments,
  });

  if (
    activeSession.mode === "interview" &&
    !activeSession.resumeDocumentId
  ) {
    const latestResume = await prisma.userDocument.findFirst({
      where: {
        documentType: "resume",
        userId: session.user.id,
      },
      orderBy: {
        createdAt: "desc",
      },
      select: {
        fileName: true,
        id: true,
      },
    });

    if (latestResume) {
      await prisma.communicationSession.update({
        data: {
          resumeDocumentId: latestResume.id,
          resumeFileName: latestResume.fileName,
        },
        where: {
          id: activeSession.id,
        },
      });

      activeSession = {
        ...activeSession,
        resumeDocumentId: latestResume.id,
        resumeFileName: latestResume.fileName,
      };
    }
  }

  return (
    <CopilotApp
      activeSession={{
        ...activeSession,
        historyContext,
        mode: normalizeMode(activeSession.mode),
        referenceDocumentIds: normalizeStringArray(
          activeSession.referenceDocumentIds
        ),
        referenceFiles: normalizeStringArray(activeSession.referenceFiles),
        startedAt: activeSession.startedAt.toISOString(),
      }}
      user={session.user}
    />
  );
}

function normalizeMode(value: string): ActiveWorkspaceSession["mode"] {
  if (
    value === "interview" ||
    value === "normal-talk" ||
    value === "client-call"
  ) {
    return value;
  }

  return "client-call";
}

function normalizeStringArray(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function buildHistorySnapshot({
  activeSessionId,
  recentSessions,
  referenceDocuments,
}: {
  activeSessionId: string;
  recentSessions: Array<{
    id: string;
    startedAt: Date;
    title: string | null;
    turns: Array<{ content: string; speaker: string }>;
  }>;
  referenceDocuments: Array<{
    extractedText: string | null;
    fileName: string;
  }>;
}) {
  const documents = referenceDocuments
    .map((document) =>
      [
        `Reference document: ${document.fileName}`,
        document.extractedText?.slice(0, 3500) ?? "",
      ]
        .filter(Boolean)
        .join("\n")
    )
    .join("\n\n")
    .slice(0, 2200);
  const history = recentSessions
    .map((savedSession) => {
      const chronologicalTurns = savedSession.turns
        .slice()
        .reverse();
      const memory = buildSessionContextMemory(chronologicalTurns).slice(
        0,
        1400
      );

      return [
        savedSession.id === activeSessionId
          ? "Current session saved history"
          : "Previous meeting history",
        `Date: ${savedSession.startedAt.toISOString()}`,
        savedSession.title ? `Title: ${savedSession.title}` : "",
        memory,
      ]
        .filter(Boolean)
        .join("\n");
    })
    .join("\n\n")
    .slice(0, 10000);

  return [documents, history].filter(Boolean).join("\n\n").slice(0, 12000);
}
