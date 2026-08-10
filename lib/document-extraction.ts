const OPENAI_API_URL = "https://api.openai.com/v1";
const DOCUMENT_EXTRACTION_MODEL =
  process.env.OPENAI_DOCUMENT_EXTRACTION_MODEL ?? "gpt-4o-mini";
const MAX_RAW_TEXT_CHARS = 18000;
const MAX_STORED_TEXT_CHARS = 14000;

type ExtractDocumentInput = {
  buffer: Buffer;
  contentType: string;
  documentType: string;
  fileName: string;
};

type OpenAITextResponse = {
  output?: Array<{
    content?: Array<{
      text?: string;
    }>;
  }>;
  output_text?: string;
  error?: {
    message?: string;
  };
};

export async function extractDocumentProfile(input: ExtractDocumentInput) {
  const rawText = normalizeText(await safeExtractDocumentText(input));

  if (!rawText) {
    return "";
  }

  const aiSummary = await withTimeout(
    extractStructuredSummaryWithAI({
      documentType: input.documentType,
      fileName: input.fileName,
      rawText,
    }),
    5500
  );

  return buildStoredDocumentContext({
    aiSummary,
    documentType: input.documentType,
    fileName: input.fileName,
    rawText,
  });
}

function buildStoredDocumentContext({
  aiSummary,
  documentType,
  fileName,
  rawText,
}: {
  aiSummary: string;
  documentType: string;
  fileName: string;
  rawText: string;
}) {
  const quickSummary = buildDeterministicSummary({
    documentType,
    fileName,
    rawText,
  });

  return [
    "AI_EXTRACTED_DOCUMENT_CONTEXT",
    aiSummary || quickSummary,
    "RAW_DOCUMENT_TEXT",
    rawText,
  ]
    .filter(Boolean)
    .join("\n\n")
    .slice(0, MAX_STORED_TEXT_CHARS);
}

function buildDeterministicSummary({
  documentType,
  fileName,
  rawText,
}: {
  documentType: string;
  fileName: string;
  rawText: string;
}) {
  const importantLines = rawText
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) =>
      [
        "experience",
        "summary",
        "skills",
        "frontend",
        "backend",
        "database",
        "infra",
        "work experience",
        "employment",
        "education",
        "project",
        "company",
        "developer",
        "engineer",
        "react",
        "next",
        "node",
        "nestjs",
        "aws",
      ].some((keyword) => line.toLowerCase().includes(keyword))
    )
    .slice(0, 45);

  return [
    `${documentType === "resume" ? "Resume" : "Reference"} extracted from ${fileName}.`,
    "AI summary was not available quickly, so use the raw text below as source of truth.",
    importantLines.length ? `Important lines:\n${importantLines.join("\n")}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number) {
  return Promise.race([
    promise,
    new Promise<T>((resolve) => {
      setTimeout(() => resolve("" as T), timeoutMs);
    }),
  ]);
}

async function safeExtractDocumentText(input: ExtractDocumentInput) {
  try {
    return await extractDocumentText(input);
  } catch {
    return "";
  }
}

export async function extractDocumentText({
  buffer,
  contentType,
  fileName,
}: ExtractDocumentInput) {
  const extension = fileName.split(".").pop()?.toLowerCase() ?? "";

  if (isPlainText(contentType, extension)) {
    return buffer.toString("utf8");
  }

  if (contentType.includes("pdf") || extension === "pdf") {
    return extractPdfText(buffer);
  }

  if (contentType.includes("wordprocessingml") || extension === "docx") {
    return extractDocxText(buffer);
  }

  return "";
}

async function extractStructuredSummaryWithAI({
  documentType,
  fileName,
  rawText,
}: {
  documentType: string;
  fileName: string;
  rawText: string;
}) {
  if (!process.env.OPENAI_API_KEY) {
    return "";
  }

  try {
    const response = await fetch(`${OPENAI_API_URL}/responses`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        input: [
          {
            role: "system",
            content: [
              "You extract reusable context from uploaded user documents for a live AI reply assistant.",
              "Do not guess or invent missing facts.",
              "Keep exact numbers, names, dates, companies, roles, projects, education, links, and constraints from the document.",
              "For daily cue notes, status notes, meeting scripts, or talking points, preserve what the user did, what they plan to do, what they should say, and what they should ask.",
              "If the document is written in Hindi or Hinglish, extract the meaning into clear English while preserving exact names, numbers, dates, tools, and original intent.",
              "Return compact markdown with clear labels so another AI can use it later.",
            ].join(" "),
          },
          {
            role: "user",
            content: [
              `Document type: ${documentType}`,
              `File name: ${fileName}`,
              getExtractionInstruction(documentType),
              "Document text:",
              rawText.slice(0, MAX_RAW_TEXT_CHARS),
            ].join("\n"),
          },
        ],
        max_output_tokens: 900,
        model: DOCUMENT_EXTRACTION_MODEL,
      }),
    });

    const text = await response.text();
    const data = safeParseOpenAIResponse(text);

    if (!response.ok) {
      return "";
    }

    return extractResponseText(data).slice(0, 5000);
  } catch {
    return "";
  }
}

function getExtractionInstruction(documentType: string) {
  if (documentType === "resume") {
    return [
      "Extract a candidate profile.",
      "Include: full name, headline/current role, total experience exactly as written, technical skills, domain skills, companies, roles, dates/durations, projects, responsibilities, measurable achievements, education, certifications, location, contact links, and any interview-relevant strengths.",
      "If a field is not present, omit it.",
      "Mark the exact total experience as IMPORTANT if present.",
    ].join(" ");
  }

  return [
    "Extract the reusable reference context.",
    "Treat this as a possible daily cue sheet, meeting brief, status note, report script, or talking-points document for a live workplace call.",
    "Include: meeting topic, agenda, user's role/side, goals, desired outcome, yesterday's completed work, today's plan, talking points, facts, data points, constraints, decisions, risks, blockers, open questions, questions to ask, terminology, stakeholders, timelines, deadlines, names, numbers, and likely questions.",
    "Extract suggested reply style if present: polite, firm, ask for clarification, give status, negotiate, explain delay, commit to next action, or escalate.",
    "If the document is notes or a brief, preserve the user's intent, priority order, and exact important details so replies stay consistent with the document.",
  ].join(" ");
}

function isPlainText(contentType: string, extension: string) {
  return (
    contentType.startsWith("text/") ||
    ["csv", "json", "md", "txt"].includes(extension)
  );
}

async function extractPdfText(buffer: Buffer) {
  const { PDFParse } = await import("pdf-parse");
  const parser = new PDFParse({ data: new Uint8Array(buffer) });

  try {
    const result = await parser.getText({
      pageJoiner: "\n",
    });

    return result.text;
  } finally {
    await parser.destroy();
  }
}

async function extractDocxText(buffer: Buffer) {
  const mammoth = (await import("mammoth")).default;
  const result = await mammoth.extractRawText({ buffer });

  return result.value;
}

function extractResponseText(data: OpenAITextResponse) {
  const outputText = data.output_text?.trim();

  if (outputText) {
    return outputText;
  }

  return (
    data.output
      ?.flatMap((item) => item.content ?? [])
      .map((content) => content.text ?? "")
      .join("\n")
      .trim() ?? ""
  );
}

function safeParseOpenAIResponse(text: string): OpenAITextResponse {
  if (!text) {
    return {};
  }

  try {
    return JSON.parse(text) as OpenAITextResponse;
  } catch {
    return {};
  }
}

function normalizeText(value: string) {
  return value
    .replace(/\r/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, MAX_RAW_TEXT_CHARS);
}
