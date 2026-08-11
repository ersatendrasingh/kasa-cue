import { auth } from "@/auth";
import UserDashboard from "@/components/user-dashboard";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";

export default async function DashboardPage({
  searchParams,
}: PageProps<"/dashboard">) {
  const query = await searchParams;
  const session = await auth();

  if (!session?.user) {
    redirect("/login?callbackUrl=/dashboard");
  }

  if (session.user.role === "admin") {
    redirect("/admin");
  }

  const [documents, sessions] = await Promise.all([
    prisma.userDocument.findMany({
      where: {
        userId: session.user.id,
      },
      orderBy: {
        createdAt: "desc",
      },
      select: {
        id: true,
        contentType: true,
        createdAt: true,
        documentType: true,
        fileName: true,
        sizeBytes: true,
      },
    }),
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
        endedAt: true,
        mode: true,
        model: true,
        startedAt: true,
        title: true,
        _count: {
          select: {
            turns: true,
          },
        },
      },
    }),
  ]);

  return (
    <UserDashboard
      documents={documents.map((document) => ({
        ...document,
        createdAt: document.createdAt.toISOString(),
      }))}
      sessions={sessions.map((item) => ({
        ...item,
        endedAt: item.endedAt?.toISOString() ?? null,
        startedAt: item.startedAt.toISOString(),
        turnsCount: item._count.turns,
      }))}
      openStartSession={query.startSession === "1"}
      user={session.user}
    />
  );
}
