import { getCurrentUser } from "@/lib/desktop-auth";

const OPENAI_API_URL = "https://api.openai.com/v1";
const CLEANUP_MODEL = process.env.OPENAI_REPLY_MODEL ?? "gpt-4o-mini";

type CleanupRequest = {
  context?: string;
  language?: string;
  text?: string;
};

type OpenAITextResponse = {
  output?: Array<{
    content?: Array<{
      text?: string;
      type?: string;
    }>;
  }>;
  output_text?: string;
  error?: {
    message?: string;
  };
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

    const response = await fetch(`${OPENAI_API_URL}/responses`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: CLEANUP_MODEL,
        input: [
          {
            role: "system",
            content: [
              "You correct one short live workplace speech-recognition transcript.",
              "Fix only words that are very likely misheard by using grammar, sentence meaning, nearby meeting context, and common British, American, and Indian accents.",
              "Preserve what the speaker actually meant and keep the same language.",
              "Do not summarize, answer, translate, explain, or make the wording more professional.",
              "Never invent names, companies, project terms, numbers, dates, amounts, owners, or commitments.",
              "Context is only a clue for resolving a misheard sound; never copy unspoken facts from it.",
              "Add light punctuation and capitalization so the line is easy to read.",
              "If the text is already plausible, return it unchanged.",
              "Return only the corrected transcript line.",
            ].join(" "),
          },
          {
            role: "user",
            content: [
              `Expected language: ${body.language || "auto detect"}`,
              body.context
                ? `Meeting context:\n${body.context.trim().slice(-2400)}`
                : "",
              `Raw transcript:\n${text.slice(0, 1800)}`,
            ]
              .filter(Boolean)
              .join("\n\n"),
          },
        ],
        max_output_tokens: 300,
      }),
    });
    const data = (await response.json()) as OpenAITextResponse;

    if (!response.ok) {
      throw new Error(data.error?.message ?? "Transcript cleanup failed.");
    }

    const correctedText = extractResponseText(data).trim();

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

function extractResponseText(data: OpenAITextResponse) {
  if (data.output_text?.trim()) {
    return data.output_text;
  }

  return (data.output ?? [])
    .flatMap((item) => item.content ?? [])
    .filter((item) => item.type === "output_text" || Boolean(item.text))
    .map((item) => item.text ?? "")
    .join("");
}
