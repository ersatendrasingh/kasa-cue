import {
  cleanSpeechDisfluencies,
  isLikelyTranscriptionArtifact,
} from "@/lib/transcript-safety";

const OPENAI_API_URL = "https://api.openai.com/v1";
const CLEANUP_MODEL =
  process.env.OPENAI_TRANSCRIPT_CLEANUP_MODEL ??
  process.env.OPENAI_REPLY_MODEL ??
  "gpt-4o-mini";

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

export async function correctTranscriptWithContext({
  context,
  language,
  text,
}: {
  context?: string;
  language?: string;
  text: string;
}) {
  const cleanedInput = cleanSpeechDisfluencies(text);

  if (!cleanedInput || !process.env.OPENAI_API_KEY) return cleanedInput;

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
            "You reconstruct one short live workplace utterance from imperfect speech recognition.",
            "Understand the intended sentence the way a careful human listener would, using grammar, sentence meaning, nearby discussion, and common British, American, and Indian accents.",
            "When the speaker gets stuck and immediately repeats a word or short phrase, keep it only once in the completed sentence.",
            "Remove accidental restarts and filler sounds such as um, uh, er, and hmm only when they carry no meaning.",
            "Correct a misheard word when the sentence and nearby context make the intended word reasonably clear.",
            "Preserve the speaker's meaning, language, uncertainty, and level of formality. Do not summarize, answer, translate, or professionalize the sentence.",
            "Never invent or alter names, companies, product terms, code identifiers, numbers, dates, amounts, owners, deadlines, or commitments.",
            "Context is evidence for resolving sounds only. Never copy a fact from context unless it was actually spoken in this utterance.",
            "Return one natural corrected transcript line and nothing else.",
          ].join(" "),
        },
        {
          role: "user",
          content: [
            `Expected language: ${language || "auto detect"}`,
            context
              ? `Nearby meeting context:\n${context.trim().slice(-3000)}`
              : "",
            `Raw utterance:\n${cleanedInput.slice(0, 1800)}`,
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

  const correctedText = cleanSpeechDisfluencies(extractResponseText(data));

  if (
    !correctedText ||
    isLikelyTranscriptionArtifact(correctedText, context ?? "")
  ) {
    return cleanedInput;
  }

  return correctedText;
}

function extractResponseText(data: OpenAITextResponse) {
  if (data.output_text?.trim()) return data.output_text.trim();

  return (data.output ?? [])
    .flatMap((item) => item.content ?? [])
    .filter((item) => item.type === "output_text" || Boolean(item.text))
    .map((item) => item.text ?? "")
    .join("")
    .trim();
}
