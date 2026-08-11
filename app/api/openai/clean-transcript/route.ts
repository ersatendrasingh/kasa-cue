import { getCurrentUser } from "@/lib/desktop-auth";
import { correctTranscriptWithContext } from "@/lib/transcript-correction";

type CleanupRequest = {
  context?: string;
  language?: string;
  text?: string;
};

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();

    if (!user?.id) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!process.env.OPENAI_API_KEY) {
      return Response.json(
        { error: "OPENAI_API_KEY is missing." },
        { status: 500 }
      );
    }

    const body = (await request.json()) as CleanupRequest;
    const text = body.text?.trim() ?? "";

    if (!text) {
      return Response.json({ error: "Transcript text is required." }, { status: 400 });
    }

    const correctedText = await correctTranscriptWithContext({
      context: body.context,
      language: body.language,
      text,
    });

    return Response.json({
      transcript: correctedText || text,
    });
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error ? error.message : "Transcript cleanup failed.",
      },
      { status: 500 }
    );
  }
}
