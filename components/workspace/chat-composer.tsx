"use client";

import { Send } from "lucide-react";

import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export type ChatIntent =
  | "say-in-english"
  | "ask-question"
  | "standup-update"
  | "live-reply";

type ChatComposerProps = {
  disabled: boolean;
  intent: ChatIntent;
  value: string;
  onChange: (value: string) => void;
  onIntentChange: (intent: ChatIntent) => void;
  onSend: () => void;
};

const intentOptions: Array<{
  label: string;
  mobileLabel: string;
  value: ChatIntent;
}> = [
  {
    label: "Say in English",
    mobileLabel: "English",
    value: "say-in-english",
  },
  {
    label: "Ask a question",
    mobileLabel: "Question",
    value: "ask-question",
  },
  {
    label: "Standup update",
    mobileLabel: "Standup",
    value: "standup-update",
  },
  {
    label: "Reply to speaker",
    mobileLabel: "Reply",
    value: "live-reply",
  },
];

const intentPlaceholders: Record<ChatIntent, string> = {
  "say-in-english":
    'Hindi/Hinglish mein likho, jaise: "Mujhe project mein ek task assign kar dijiye."',
  "ask-question":
    "Hindi/Hinglish mein woh sawaal likho jo meeting mein poochna hai.",
  "standup-update":
    "Kal kya kiya, aaj kya karoge aur blocker kya hai—Hindi/Hinglish mein likho.",
  "live-reply": "Latest meeting line ya apna reply idea type karo.",
};

export function ChatComposer({
  disabled,
  intent,
  value,
  onChange,
  onIntentChange,
  onSend,
}: ChatComposerProps) {
  const selectedIntent =
    intentOptions.find((option) => option.value === intent) ?? intentOptions[0];

  return (
    <div className="mb-1 rounded-xl border border-slate-200 bg-white p-2 shadow-sm sm:mb-0 sm:rounded-md sm:p-3">
      <div className="mb-2 sm:flex sm:items-center sm:gap-2 sm:overflow-x-auto sm:pb-0.5">
        <Label className="hidden shrink-0 text-xs text-slate-500 sm:inline-flex">
          I want to
        </Label>
        <div className="grid grid-cols-4 gap-1 sm:flex sm:gap-1.5">
          {intentOptions.map((option) => {
            const active = option.value === intent;

            return (
              <button
                aria-pressed={active}
                className={`min-w-0 rounded-lg border px-1.5 py-2 text-[11px] font-semibold transition sm:shrink-0 sm:rounded-full sm:px-3 sm:py-1.5 sm:text-xs ${
                  active
                    ? "border-slate-950 bg-slate-950 text-white"
                    : "border-slate-200 bg-slate-50 text-slate-600 hover:border-slate-400 hover:bg-white"
                }`}
                key={option.value}
                onClick={() => onIntentChange(option.value)}
                type="button"
              >
                <span className="sm:hidden">{option.mobileLabel}</span>
                <span className="hidden sm:inline">{option.label}</span>
              </button>
            );
          })}
        </div>
      </div>
      <div className="relative">
        <Label htmlFor="chat-message" className="sr-only">
          Your thought or notes
        </Label>
        <Textarea
          id="chat-message"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              onSend();
            }
          }}
          className="min-h-20 resize-none bg-white px-3 py-3.5 pr-14 text-sm leading-6 sm:min-h-16 sm:text-base"
          placeholder={intentPlaceholders[intent]}
        />
        <button
          aria-label={`${selectedIntent.label} and send`}
          className="absolute bottom-2 right-2 flex size-10 items-center justify-center rounded-full bg-slate-950 text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
          disabled={disabled || !value.trim()}
          onClick={onSend}
          title={selectedIntent.label}
          type="button"
        >
          <Send className="size-4" />
        </button>
      </div>
      <p className="mt-1.5 hidden text-[11px] text-slate-500 sm:block">
        Hindi/Hinglish → spoken English · Enter to send
      </p>
    </div>
  );
}
