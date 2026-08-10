import {
  BriefcaseBusiness,
  UserRoundCheck,
  Volume2,
} from "lucide-react";

import type { ModeOption } from "./types";

export const modeOptions: ModeOption[] = [
  { value: "normal-talk", label: "Team meeting", icon: Volume2 },
  { value: "client-call", label: "Client call / KT", icon: BriefcaseBusiness },
  { value: "interview", label: "Past session", icon: UserRoundCheck },
];

export const modeDescriptions: Record<string, string> = {
  interview: "Legacy saved session.",
  "normal-talk": "Standups, team meetings, and daily work communication.",
  "client-call": "Client updates, project KT, risks, and next steps.",
};

export const modelOptions = [
  {
    value: "gpt-4o-mini",
    label: "GPT-4o Mini — Fast Live",
    tag: "Recommended",
    description: "Fast and reliable for live answers.",
  },
  {
    value: "gpt-5-mini",
    label: "GPT-5 Mini — Smart",
    tag: "Smart",
    description: "Better quality, but can be slower for live calls.",
  },
  {
    value: "gpt-5-nano",
    label: "GPT-5 Nano — Super Fast",
    tag: "Fast",
    description: "Fastest and lowest-cost option for quick testing.",
  },
  {
    value: "gpt-5",
    label: "GPT-5 — Smart",
    tag: "Premium",
    description: "Highest quality option for important meetings and calls.",
  },
  {
    value: "gpt-4.1",
    label: "GPT-4.1 — Thinking",
    tag: "Strong",
    description: "Higher quality for important calls.",
  },
  {
    value: "gpt-4.1-mini",
    label: "GPT-4.1 Mini — Balanced",
    tag: "Light",
    description: "Stronger reasoning while still lightweight.",
  },
  {
    value: "gpt-4o",
    label: "GPT-4o — Realtime",
    tag: "Realtime",
    description: "Balanced quality for real-time assistant use.",
  },
];
