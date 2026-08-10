import {
  BriefcaseBusiness,
  FileText,
  MessageSquareText,
  Play,
  Settings2,
  WandSparkles,
} from "lucide-react";

export const sessionModes = [
  {
    id: "normal-talk",
    title: "Team meeting",
    description: "Daily standups, project discussions, and internal communication.",
    icon: MessageSquareText,
    accent: "border-emerald-300 bg-emerald-50 text-emerald-700",
  },
  {
    id: "client-call",
    title: "Client call / KT",
    description: "Client updates, project KT, risks, decisions, and planning.",
    icon: BriefcaseBusiness,
    accent: "border-amber-300 bg-amber-50 text-amber-800",
  },
] as const;

export const setupSteps = [
  {
    label: "Optional",
    title: "Add meeting context",
    body: "Agenda, project notes, client brief, or daily update.",
    action: "Attach in setup",
    icon: FileText,
  },
  {
    label: "Step 1",
    title: "Choose session mode",
    body: "Team meeting, daily standup, client call, or project KT.",
    action: "Choose mode",
    icon: WandSparkles,
  },
  {
    label: "Step 2",
    title: "Tune answers",
    body: "Language, model, and saved context.",
    action: "Configure",
    icon: Settings2,
  },
  {
    label: "Step 3",
    title: "Start live session",
    body: "Open transcript, suggested replies, and timer.",
    action: "Start",
    icon: Play,
  },
];

export type SessionModeId = (typeof sessionModes)[number]["id"];
