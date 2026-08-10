"use client";

import { useMemo, useState } from "react";

import type { UserDocumentSummary } from "@/components/workspace/types";

import { AudioSetupPanel } from "./setup/audio-setup-panel";
import { DesktopWindowShell } from "./setup/desktop-window-shell";
import { PastSessionsPanel } from "./setup/past-sessions-panel";
import { SessionDetailsPanel } from "./setup/session-details-panel";
import { SessionTypePanel } from "./setup/session-type-panel";
import type {
  DesktopDocumentGroups,
  DesktopSessionDraft,
  DesktopSetupStep,
} from "./setup/types";

type DesktopSessionLauncherProps = {
  documents: UserDocumentSummary[];
  userName: string;
};

const initialDraft: DesktopSessionDraft = {
  autoAnswer: false,
  company: "",
  humanize: true,
  instructions: "",
  language: "english",
  model: "gpt-4o-mini",
  position: "",
  referenceDocumentIds: [],
  resumeDocumentId: "",
  sessionType: "interview",
};

export function DesktopSessionLauncher({
  documents,
}: DesktopSessionLauncherProps) {
  const [savedDocuments, setSavedDocuments] =
    useState<UserDocumentSummary[]>(documents);
  const [step, setStep] = useState<DesktopSetupStep>("home");
  const [draft, setDraft] = useState<DesktopSessionDraft>(initialDraft);
  const [isCreating, setIsCreating] = useState(false);
  const [isUploadingReference, setIsUploadingReference] = useState(false);
  const [error, setError] = useState("");

  const documentGroups = useMemo<DesktopDocumentGroups>(
    () => ({
      references: savedDocuments.filter(
        (document) => document.documentType === "reference"
      ),
      resumes: savedDocuments.filter(
        (document) => document.documentType === "resume"
      ),
    }),
    [savedDocuments]
  );

  async function createSession() {
    setError("");
    setIsCreating(true);

    try {
      const selectedResume = documentGroups.resumes.find(
        (document) => document.id === draft.resumeDocumentId
      );
      const selectedReferences = documentGroups.references.filter((document) =>
        draft.referenceDocumentIds.includes(document.id)
      );
      const response = await fetch("/api/sessions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          context: buildContext(draft, selectedResume, selectedReferences),
          instructions: buildInstructions(draft),
          language: draft.language,
          mode: toApiMode(draft.sessionType),
          model: draft.model,
          referenceDocumentIds: draft.referenceDocumentIds,
          referenceFiles: selectedReferences.map((document) => document.fileName),
          resumeDocumentId: selectedResume?.id,
          resumeFileName: selectedResume?.fileName,
          title: createTitle(draft),
          tone: draft.humanize ? "human-spoken-adaptive" : "adaptive-genuine",
        }),
      });
      const data = (await response.json()) as {
        error?: string;
        session?: { id: string };
      };

      if (!response.ok || !data.session?.id) {
        throw new Error(data.error ?? "Could not create desktop session.");
      }

      if (window.kasaDesktop) {
        await window.kasaDesktop.openOverlay({ sessionId: data.session.id });
      } else {
        window.location.href = `/desktop/overlay?sessionId=${data.session.id}`;
      }
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Could not create desktop session."
      );
      setStep("details");
    } finally {
      setIsCreating(false);
    }
  }

  async function uploadReferenceFiles(files: FileList | null) {
    if (!files?.length) {
      return;
    }

    setError("");
    setIsUploadingReference(true);

    try {
      const uploadedDocuments: UserDocumentSummary[] = [];

      for (const file of Array.from(files)) {
        const formData = new FormData();

        formData.append("documentType", "reference");
        formData.append("extractedText", await readTextAttachment(file));
        formData.append("file", file);

        const response = await fetch("/api/documents", {
          method: "POST",
          body: formData,
        });
        const data = (await response.json()) as {
          document?: UserDocumentSummary;
          error?: string;
        };

        if (!response.ok || !data.document) {
          throw new Error(data.error ?? "Could not upload meeting brief.");
        }

        uploadedDocuments.push(data.document);
      }

      setSavedDocuments((current) => [...uploadedDocuments, ...current]);
      setDraft((current) => ({
        ...current,
        referenceDocumentIds: [
          ...new Set([
            ...uploadedDocuments.map((document) => document.id),
            ...current.referenceDocumentIds,
          ]),
        ],
      }));
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Could not upload meeting brief."
      );
    } finally {
      setIsUploadingReference(false);
    }
  }

  return (
    <DesktopWindowShell>
      {step === "home" ? (
        <SessionTypePanel
          selectedType={draft.sessionType}
          onSelectType={(sessionType) =>
            setDraft((current) => ({
              ...current,
              company: sessionType === "normal" ? "" : current.company,
              position: "",
              resumeDocumentId:
                sessionType === "interview" ? current.resumeDocumentId : "",
              model:
                sessionType === "normal" && current.model === "gpt-4o-mini"
                  ? "gpt-4.1-mini"
                  : current.model,
              sessionType,
            }))
          }
          onStepChange={setStep}
        />
      ) : null}

      {step === "past" ? <PastSessionsPanel onStepChange={setStep} /> : null}

      {step === "details" ? (
        <SessionDetailsPanel
          documents={documentGroups}
          draft={draft}
          error={error}
          isUploadingReference={isUploadingReference}
          onDraftChange={setDraft}
          onReferenceUpload={(files) => void uploadReferenceFiles(files)}
          onStepChange={setStep}
        />
      ) : null}

      {step === "audio" ? (
        <AudioSetupPanel
          isCreating={isCreating}
          onCreateSession={() => void createSession()}
          onStepChange={setStep}
        />
      ) : null}
    </DesktopWindowShell>
  );
}

async function readTextAttachment(file: File) {
  const extension = file.name.split(".").pop()?.toLowerCase();
  const readableExtensions = ["txt", "md", "csv", "json"];

  if (
    !file.type.startsWith("text/") &&
    !readableExtensions.includes(extension ?? "")
  ) {
    return "";
  }

  return (await file.text()).slice(0, 2500);
}

function toApiMode(type: DesktopSessionDraft["sessionType"]) {
  if (type === "normal") {
    return "normal-talk";
  }

  if (type === "client") {
    return "client-call";
  }

  return "interview";
}

function createTitle(draft: DesktopSessionDraft) {
  if (draft.sessionType === "normal") {
    return draft.position || draft.company || "Normal talk session";
  }

  if (draft.sessionType === "client") {
    return draft.position || draft.company || "Client call session";
  }

  return draft.position || draft.company || "Interview session";
}

function buildContext(
  draft: DesktopSessionDraft,
  selectedResume: UserDocumentSummary | undefined,
  selectedReferences: UserDocumentSummary[]
) {
  const sessionPurpose = {
    client: "Client call support: concise professional replies for updates, risks, planning, negotiation, and follow-up.",
    interview:
      "Interview support: answer as the candidate using resume evidence, practical examples, and natural spoken structure.",
    normal:
      "Normal workplace call support: help a non-native English speaker respond naturally to managers, teammates, HR, clients, and overseas colleagues.",
  }[draft.sessionType];

  const primaryLabel =
    draft.sessionType === "interview"
      ? "Company"
      : draft.sessionType === "client"
        ? "Client/company"
        : "Conversation context";
  const topicLabel =
    draft.sessionType === "interview"
      ? "Position"
      : draft.sessionType === "client"
        ? "Call topic"
        : "Main topic";

  return [
    `Session purpose: ${sessionPurpose}`,
    draft.company ? `${primaryLabel}: ${draft.company}` : "",
    draft.position ? `${topicLabel}: ${draft.position}` : "",
    selectedResume
      ? `Selected resume for candidate background: ${selectedResume.fileName}`
      : "",
    selectedReferences.length
      ? `Selected reference documents: ${selectedReferences
          .map((document) => document.fileName)
          .join(", ")}`
      : "",
    draft.autoAnswer
      ? "Auto answer is enabled: generate helpful replies automatically when speech is detected."
      : "",
    draft.humanize
      ? "Humanize is enabled: write answers that sound like a real person speaking, not like a formal essay."
      : "",
  ]
    .filter(Boolean)
    .join("\n");
}

function buildInstructions(draft: DesktopSessionDraft) {
  const baseInstructions =
    draft.sessionType === "normal"
      ? [
          "Normal talk mode: the user is on a real workplace call with English-speaking managers, teammates, HR, clients, or overseas colleagues.",
          "The user needs a reply they can speak immediately in simple, natural, professional English.",
          "Infer what the other person means, even if transcription is imperfect, and answer the latest line only.",
          "Use first person as the user. Sound respectful, calm, and confident, not like an AI or a formal email.",
          "If the user needs time, clarification, agreement, disagreement, status update, apology, or follow-up, provide the best spoken sentence for that situation.",
          "Treat quick instructions as session cue notes: follow them for today's facts, priorities, talking points, questions to ask, and intended reply style.",
          "Wrap the most important words or phrases in **bold** so they are highlighted in the answer window.",
        ]
      : [
          "Reply according to the actual latest interviewer/client line. Do not repeat an introduction unless the line asks for introduction or background.",
          "For technical questions, first explain the concept clearly, then give a practical example, then connect it to project experience when relevant.",
          "For long interviewer speech, infer the real question and answer that question directly.",
          "Keep the answer spoken, confident, and complete enough to say in a real conversation.",
        ];

  return [
    ...baseInstructions,
    draft.instructions.trim()
      ? `Quick session cue notes:\n${draft.instructions.trim()}`
      : "",
  ]
    .filter(Boolean)
    .join("\n");
}
