import { getCurrentUser } from "@/lib/desktop-auth";
import { isLikelyTranscriptionArtifact } from "@/lib/transcript-safety";

const OPENAI_API_URL = "https://api.openai.com/v1";
const TRANSCRIPTION_MODEL =
  process.env.OPENAI_TRANSCRIPTION_MODEL ?? "gpt-4o-transcribe";
const REPLY_MODEL = process.env.OPENAI_REPLY_MODEL ?? "gpt-4o-mini";

type OpenAITextResponse = {
  output_text?: string;
  error?: {
    message?: string;
  };
};

type OpenAITranscriptionResponse = {
  text?: string;
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
        {
          error:
            "OPENAI_API_KEY is missing. Add it to .env.local and restart the dev server.",
        },
        { status: 500 }
      );
    }

    const formData = await request.formData();
    const audio = formData.get("audio");
    const mode = String(formData.get("mode") ?? "client-call");
    const prompt = String(formData.get("prompt") ?? "");
    const tone = String(formData.get("tone") ?? "adaptive-genuine");
    const instructions = String(formData.get("instructions") ?? "");
    const language = String(formData.get("language") ?? "");
    const outputLanguage = String(formData.get("outputLanguage") ?? "english");
    const transcribeOnly = String(formData.get("transcribeOnly") ?? "") === "true";

    if (!(audio instanceof File) || audio.size === 0) {
      return Response.json(
        { error: "Audio file is required." },
        { status: 400 }
      );
    }

    const transcription = await transcribeAudio(audio, prompt, language);

    if (isLikelyTranscriptionArtifact(transcription.text, prompt)) {
      return Response.json(
        { error: "No speech detected in this audio chunk." },
        { status: 422 }
      );
    }

    const normalizedTranscript = await normalizeTranscriptLanguage(
      transcription.text,
      outputLanguage
    );

    if (
      !normalizedTranscript ||
      isLikelyTranscriptionArtifact(normalizedTranscript, prompt)
    ) {
      return Response.json(
        { error: "No speech detected in this audio chunk." },
        { status: 422 }
      );
    }

    if (transcribeOnly) {
      return Response.json({
        transcript: normalizedTranscript,
        models: {
          transcription: TRANSCRIPTION_MODEL,
        },
      });
    }

    const reply = await generateReply({
      transcript: normalizedTranscript,
      instructions,
      mode,
      tone,
    });

    return Response.json({
      transcript: normalizedTranscript,
      reply,
      models: {
        transcription: TRANSCRIPTION_MODEL,
        reply: REPLY_MODEL,
      },
    });
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "OpenAI processing failed.",
      },
      { status: 500 }
    );
  }
}

async function transcribeAudio(audio: File, prompt: string, language: string) {
  const body = new FormData();
  body.append("file", audio, audio.name || "audio.webm");
  body.append("model", TRANSCRIPTION_MODEL);
  if (language) {
    body.append("language", language);
  }
  if (prompt.trim()) {
    body.append("prompt", prompt.trim().slice(-800));
  }

  const response = await fetch(`${OPENAI_API_URL}/audio/transcriptions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body,
  });

  const data = (await response.json()) as OpenAITranscriptionResponse;

  if (!response.ok) {
    throw new Error(data.error?.message ?? "OpenAI transcription failed.");
  }

  return {
    text: data.text?.trim() ?? "",
  };
}

async function normalizeTranscriptLanguage(
  transcript: string,
  outputLanguage: string
) {
  const text = transcript.trim();

  if (!text) {
    return "";
  }

  if (
    outputLanguage !== "english" ||
    !/[\u0600-\u06ff\u0750-\u077f\u08a0-\u08ff\u0900-\u097f]/u.test(text)
  ) {
    return text;
  }

  const response = await fetch(`${OPENAI_API_URL}/responses`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: REPLY_MODEL,
      input: [
        {
          role: "system",
          content:
            "Convert live transcript text to English in Latin script only. Preserve names, companies, technologies, numbers, and code terms. Return only the converted transcript.",
        },
        {
          role: "user",
          content: text,
        },
      ],
      max_output_tokens: 250,
    }),
  });

  const data = (await response.json()) as OpenAITextResponse;

  if (!response.ok) {
    throw new Error(data.error?.message ?? "Transcript language cleanup failed.");
  }

  return data.output_text?.trim() ?? text;
}

async function generateReply({
  instructions,
  mode,
  tone,
  transcript,
}: {
  instructions: string;
  mode: string;
  tone: string;
  transcript: string;
}) {
  const response = await fetch(`${OPENAI_API_URL}/responses`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: REPLY_MODEL,
      input: [
        {
          role: "system",
          content: [
            "You are Kasa Cue, a private communication copilot.",
            "Generate a speakable reply the user can use immediately.",
            "Do not mention that you are an AI.",
            "Understand the user's real need from the speech: immediate reply, meeting/report preparation, English polishing, clarification questions, action plan, summary, objection handling, or next-step alignment.",
            "If the user gives a rough story, convert it into usable output: what happened, what matters now, what the user should say, what questions they should ask, and what next action should be proposed.",
            "For meeting, report, standup, manager call, client call, or colleague discussion prep, give a practical structure with an opening line, key points, questions to ask, and a short version to say directly.",
            "If selected reference documents, daily cue notes, status notes, or talking points are available in the instructions/context, treat them as the source of truth for the user's facts, priorities, and intended position.",
            "When notes include yesterday, today, blockers, questions, people to meet, or next steps, preserve that structure when the user asks for preparation.",
            "Documents and quick notes may be written in Hindi or Hinglish. Use them for meaning only; write the final suggested reply in clean, simple, speakable English unless another output language is explicitly requested.",
            "For simple live replies, answer the exact latest speech act in first person as the user.",
            "If the input is Hinglish or broken spoken English, understand the intent and reply in clean, natural, simple English unless another language is requested.",
            "Do not hardcode or imitate any single example. Adapt to the actual topic, people, dates, blockers, deliverables, and urgency.",
            "Preserve concrete details exactly. If important context is missing, include focused questions instead of inventing details.",
          ].join(" "),
        },
        {
          role: "user",
          content: [
            `Session mode: ${mode}`,
            `Answer style: ${tone}`,
            `User instructions: ${instructions || "Keep it concise and natural."}`,
            `Latest heard speech: ${transcript}`,
            "Return only the suggested reply. Use the right length for the question; do not force an overly short answer.",
          ].join("\n"),
        },
      ],
      max_output_tokens: 450,
    }),
  });

  const data = (await response.json()) as OpenAITextResponse;

  if (!response.ok) {
    throw new Error(data.error?.message ?? "OpenAI reply generation failed.");
  }

  return data.output_text?.trim() ?? "";
}
