const TRANSCRIPTION_INSTRUCTION_MARKERS = [
  "listen for the speaker's intended meaning",
  "listen for the speakers intended meaning",
  "especially in noisy accented fast broken",
  "hindi english or hinglish speech",
  "prefer the most likely clear sentence",
  "literal sequence of garbled words",
  "never invent names numbers dates or facts",
  "return english words in latin script only",
  "never return urdu arabic hindi devanagari",
  "any non latin script",
  "routine work communication listen for",
];

export function normalizeTranscriptFingerprint(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function cleanSpeechDisfluencies(value: string) {
  const tokens = value.trim().split(/\s+/).filter(Boolean);
  const output: string[] = [];
  const emphasisWords = new Set(["no", "yes", "very", "really", "so"]);
  let index = 0;

  while (index < tokens.length) {
    let repeatedLength = 0;

    for (let length = Math.min(4, output.length); length >= 1; length -= 1) {
      if (index + length > tokens.length) continue;

      const previous = output
        .slice(-length)
        .map(normalizeSpeechToken)
        .join(" ");
      const incoming = tokens
        .slice(index, index + length)
        .map(normalizeSpeechToken)
        .join(" ");

      if (
        previous &&
        previous === incoming &&
        !(length === 1 && emphasisWords.has(incoming))
      ) {
        repeatedLength = length;
        break;
      }
    }

    if (repeatedLength) {
      index += repeatedLength;
      continue;
    }

    output.push(tokens[index]);
    index += 1;
  }

  return output
    .join(" ")
    .replace(/\s+([,.;!?])/g, "$1")
    .replace(/\s{2,}/g, " ")
    .trim();
}

export function isLikelyTranscriptionArtifact(
  value: string,
  prompt = ""
) {
  const normalizedValue = normalizeTranscriptFingerprint(value);

  if (!normalizedValue) return true;

  if (
    TRANSCRIPTION_INSTRUCTION_MARKERS.some((marker) =>
      normalizedValue.includes(normalizeTranscriptFingerprint(marker))
    )
  ) {
    return true;
  }

  const normalizedPrompt = normalizeTranscriptFingerprint(prompt);

  return Boolean(
    normalizedPrompt &&
      normalizedValue.split(" ").length >= 5 &&
      hasSharedWordRun(normalizedValue, normalizedPrompt, 5)
  );
}

export function isNearDuplicateTranscript(
  candidate: string,
  previousValue: string
) {
  const candidateFingerprint = normalizeTranscriptFingerprint(candidate);
  const previousFingerprint = normalizeTranscriptFingerprint(previousValue);

  if (!candidateFingerprint || !previousFingerprint) return false;
  if (candidateFingerprint === previousFingerprint) return true;

  const shorter =
    candidateFingerprint.length <= previousFingerprint.length
      ? candidateFingerprint
      : previousFingerprint;
  const longer =
    candidateFingerprint.length > previousFingerprint.length
      ? candidateFingerprint
      : previousFingerprint;

  return shorter.length >= 18 && longer.includes(shorter);
}

function hasSharedWordRun(first: string, second: string, runLength: number) {
  const firstWords = first.split(" ");

  if (firstWords.length < runLength) return false;

  for (let index = 0; index <= firstWords.length - runLength; index += 1) {
    const phrase = firstWords.slice(index, index + runLength).join(" ");

    if (second.includes(phrase)) return true;
  }

  return false;
}

function normalizeSpeechToken(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9'-]/g, "");
}
