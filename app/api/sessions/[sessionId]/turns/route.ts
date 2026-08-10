import { getCurrentUser } from "@/lib/desktop-auth";
import { prisma } from "@/lib/prisma";

type SaveTurnRequest = {
  content?: string;
  model?: string;
  speaker?: "other" | "user" | "assistant";
  turns?: Array<{
    content?: string;
    createdAt?: string;
    model?: string;
    speaker?: "other" | "user" | "assistant";
  }>;
};

export async function GET(
  request: Request,
  context: { params: Promise<{ sessionId: string }> }
) {
  const user = await getCurrentUser();

  if (!user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { sessionId } = await context.params;
  const owningSession = await prisma.communicationSession.findFirst({
    where: { id: sessionId, userId: user.id },
    select: { id: true },
  });

  if (!owningSession) {
    return Response.json({ error: "Session not found" }, { status: 404 });
  }

  const { searchParams } = new URL(request.url);
  const afterValue = searchParams.get("after");
  const after = afterValue ? new Date(afterValue) : null;
  const validAfter = after && !Number.isNaN(after.getTime()) ? after : null;
  const turns = await prisma.communicationTurn.findMany({
    where: {
      sessionId,
      speaker: { in: ["other", "user"] },
      ...(validAfter ? { createdAt: { gte: validAfter } } : {}),
    },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    take: 100,
    select: {
      content: true,
      createdAt: true,
      id: true,
      speaker: true,
    },
  });

  return Response.json({ turns });
}

export async function POST(
  request: Request,
  context: { params: Promise<{ sessionId: string }> }
) {
  const user = await getCurrentUser();

  if (!user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { sessionId } = await context.params;
  const body = (await request.json()) as SaveTurnRequest;
  const turns = body.turns?.length
    ? body.turns
        .slice(0, 2000)
        .map((turn) => ({
          content: turn.content?.trim() ?? "",
          createdAt: turn.createdAt ? new Date(turn.createdAt) : new Date(),
          model: turn.model?.trim() || null,
          speaker: turn.speaker ?? "user",
        }))
        .filter(
          (turn) => turn.content && !Number.isNaN(turn.createdAt.getTime())
        )
    : [
        {
          content: body.content?.trim() ?? "",
          createdAt: new Date(),
          model: body.model?.trim() || null,
          speaker: body.speaker ?? "user",
        },
      ];

  if (!turns.length || turns.some((turn) => !turn.content)) {
    return Response.json({ error: "Content is required" }, { status: 400 });
  }

  const owningSession = await prisma.communicationSession.findFirst({
    where: {
      id: sessionId,
      userId: user.id,
    },
    select: {
      id: true,
    },
  });

  if (!owningSession) {
    return Response.json({ error: "Session not found" }, { status: 404 });
  }

  const result = await prisma.communicationTurn.createMany({
    data: turns.map((turn) => ({
      ...turn,
      sessionId,
    })),
  });

  return Response.json({ count: result.count });
}
