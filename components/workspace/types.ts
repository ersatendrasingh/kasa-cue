import type { LucideIcon } from "lucide-react";

export type WorkspaceUser = {
  name?: string | null;
  email?: string | null;
  role: "admin" | "user";
};

export type UserDocumentSummary = {
  id: string;
  contentType: string;
  createdAt: string | Date;
  documentType: string;
  fileName: string;
  sizeBytes: number;
};

export type ActiveWorkspaceSession = {
  id: string;
  context: string | null;
  historyContext: string;
  instructions: string | null;
  language: string;
  mode: "interview" | "normal-talk" | "client-call";
  model: string;
  referenceDocumentIds: string[];
  referenceFiles: string[];
  resumeDocumentId: string | null;
  resumeFileName: string | null;
  startedAt: string;
  title: string | null;
  tone: string | null;
};

export type ModeOption = {
  value: "interview" | "normal-talk" | "client-call";
  label: string;
  icon: LucideIcon;
};

export type GenerateReplyResponse = {
  error?: string;
  model?: string;
  reply?: string;
  warning?: string;
};

export type KasaSpeechRecognition = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onend: (() => void) | null;
  onerror: ((event: { error?: string }) => void) | null;
  onresult: ((event: KasaSpeechRecognitionEvent) => void) | null;
  start: () => void;
  stop: () => void;
};

export type KasaSpeechRecognitionEvent = {
  resultIndex: number;
  results: ArrayLike<{
    isFinal: boolean;
    0: {
      transcript: string;
    };
  }>;
};

export type SpeechRecognitionConstructor = new () => KasaSpeechRecognition;

export type SpeechWindow = Window & {
  __KASA_NATIVE_IOS__?: boolean;
  SpeechRecognition?: SpeechRecognitionConstructor;
  webkitSpeechRecognition?: SpeechRecognitionConstructor;
  webkit?: {
    messageHandlers?: {
      kasaNative?: {
        postMessage: (message: Record<string, unknown>) => void;
      };
    };
  };
};
