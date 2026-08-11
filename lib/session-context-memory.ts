type SessionTurnForMemory = {
  content: string;
  speaker: string;
};

export function buildSessionContextMemory(turns: SessionTurnForMemory[]) {
  const recentTurns = turns
    .map((turn) => ({
      content: turn.content.trim(),
      speaker: turn.speaker,
    }))
    .filter((turn) => turn.content)
    .slice(-100);

  const latestUserLine = [...recentTurns]
    .reverse()
    .find((turn) => turn.speaker !== "assistant")?.content;
  const latestAssistantAnswer = [...recentTurns]
    .reverse()
    .find((turn) => turn.speaker === "assistant")?.content;
  const topicTrail = recentTurns
    .filter((turn) => turn.speaker !== "assistant")
    .map((turn) => compactLine(turn.content))
    .slice(-24);
  const answerTrail = recentTurns
    .filter((turn) => turn.speaker === "assistant")
    .map((turn) => compactLine(turn.content))
    .slice(-12);
  const questionTrail = recentTurns
    .filter(
      (turn) =>
        turn.speaker !== "assistant" &&
        (turn.content.includes("?") ||
          /^(what|why|how|when|where|who|which|can|could|would|will|do|does|did|are|is|should|tell me|explain)\b/i.test(
            turn.content.trim()
          ))
    )
    .map((turn) => compactLine(turn.content, 500))
    .slice(-12);
  const importantTrail = recentTurns
    .filter(
      (turn) =>
        turn.speaker !== "assistant" &&
        /\b(decid|agree|action|owner|deadline|today|tomorrow|yesterday|block|risk|issue|task|follow[ -]?up|need|must|should|will|plan|require)/i.test(
          turn.content
        )
    )
    .map((turn) => compactLine(turn.content, 500))
    .slice(-20);

  return [
    "Active session memory:",
    "Use this to preserve continuity across pauses and follow-up questions. The latest other-speaker/user line is the immediate thing to answer, while earlier turns explain what it refers to.",
    latestUserLine ? `Latest other-speaker/user line: ${compactLine(latestUserLine, 700)}` : "",
    latestAssistantAnswer
      ? `Last assistant answer summary: ${compactLine(latestAssistantAnswer, 500)}`
      : "",
    importantTrail.length
      ? `Remembered decisions, tasks, blockers, dates, and commitments:\n${importantTrail.join("\n")}`
      : "",
    questionTrail.length ? `Recent question trail:\n${questionTrail.join("\n")}` : "",
    topicTrail.length ? `Recent discussion trail:\n${topicTrail.join("\n")}` : "",
    answerTrail.length ? `Recent Kasa reply trail:\n${answerTrail.join("\n")}` : "",
  ]
    .filter(Boolean)
    .join("\n")
    .slice(0, 12000);
}

function compactLine(value: string, maxLength = 280) {
  return value.replace(/\s+/g, " ").trim().slice(0, maxLength);
}
