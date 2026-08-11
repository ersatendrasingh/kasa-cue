"use client";

import { CheckCircle2, Languages, Loader2, Save, Sparkles } from "lucide-react";
import { useState } from "react";

import { instructionTemplates } from "@/components/dashboard/instructions/instruction-templates";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";

type InstructionsManagerProps = {
  initialSettings: {
    customInstructions: string | null;
    defaultLanguage: string;
    desiMode: boolean;
  };
};

const MAX_INSTRUCTION_LENGTH = 2000;

export function InstructionsManager({
  initialSettings,
}: InstructionsManagerProps) {
  const [defaultLanguage, setDefaultLanguage] = useState(
    initialSettings.defaultLanguage
  );
  const [desiMode, setDesiMode] = useState(initialSettings.desiMode);
  const [customInstructions, setCustomInstructions] = useState(
    initialSettings.customInstructions ?? ""
  );
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function saveInstructions() {
    setError("");
    setMessage("");
    setIsSaving(true);

    try {
      const response = await fetch("/api/instructions", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          customInstructions,
          defaultLanguage,
          desiMode,
        }),
      });
      const data = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(data.error ?? "Could not save instructions.");
      }

      setMessage("Instructions saved.");
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Could not save instructions."
      );
    } finally {
      setIsSaving(false);
    }
  }

  function applyTemplate(template: string) {
    setCustomInstructions((current) =>
      [current.trim(), template].filter(Boolean).join("\n\n").slice(0, 2000)
    );
    setMessage("");
    setError("");
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-3 sm:gap-4">
        <div className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-amber-50 text-amber-700 sm:size-14">
          <Sparkles className="size-5 sm:size-7" />
        </div>
        <div>
          <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            Instructions for Kasa
          </h2>
          <p className="mt-2 text-slate-600">
            Customize how Kasa represents you during live sessions.
          </p>
        </div>
      </div>

      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="text-lg font-semibold">How this works</h3>
        <p className="mt-3 max-w-5xl text-sm leading-6 text-slate-600">
          Kasa uses your saved documents plus these custom instructions to
          answer in your preferred style. Add anything that is not in your
          resume but helps represent you professionally.
        </p>
        <div className="mt-5 grid gap-6 md:grid-cols-2">
          <InfoList
            title="What to include"
            items={[
              "Personal values and work philosophy",
              "Communication style preferences",
              "Career goals and aspirations",
              "Technical preferences and interests",
            ]}
          />
          <InfoList
            title="Examples"
            items={[
              "I prefer concise answers with practical examples",
              "I want negotiation replies to stay polite and confident",
              "I am interested in AI/ML applications",
              "I value ownership and clear communication",
            ]}
          />
        </div>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center gap-3">
          <Languages className="size-5 text-slate-500" />
          <div>
            <h3 className="text-lg font-semibold">Default interview language</h3>
            <p className="mt-1 text-sm text-slate-600">
              This language is used when a session starts with auto language.
            </p>
          </div>
        </div>
        <div className="mt-4 max-w-xs">
          <Select value={defaultLanguage} onValueChange={setDefaultLanguage}>
            <SelectTrigger className="h-11 w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="english">English</SelectItem>
              <SelectItem value="hindi">Hindi</SelectItem>
              <SelectItem value="hinglish">Hinglish</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </section>

      <section className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm sm:gap-4 sm:p-5">
        <div>
          <h3 className="text-lg font-semibold">Desi Mode</h3>
          <p className="mt-1 text-sm text-slate-600">
            Make answers sound natural for Indian professional conversations.
          </p>
        </div>
        <Switch checked={desiMode} onCheckedChange={setDesiMode} />
      </section>

      <section>
        <h3 className="text-xl font-semibold">Quick start templates</h3>
        <p className="mt-2 text-sm text-slate-600">
          Click a template to add it to your custom instructions.
        </p>
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {instructionTemplates.map((template) => (
            <button
              className="rounded-lg border border-slate-200 bg-white p-4 text-left transition hover:border-amber-300 hover:bg-amber-50/40"
              key={template.title}
              onClick={() => applyTemplate(template.body)}
              type="button"
            >
              <p className="font-semibold">{template.title}</p>
              <p className="mt-2 line-clamp-3 text-sm leading-6 text-slate-600">
                {template.body}
              </p>
            </button>
          ))}
        </div>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <Label className="text-xl font-semibold">
              Your custom instructions
            </Label>
            <p className="mt-2 text-sm text-slate-600">
              These instructions are saved and added to every new session.
            </p>
          </div>
          {message ? (
            <span className="flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">
              <CheckCircle2 className="size-3.5" />
              {message}
            </span>
          ) : null}
        </div>
        <Textarea
          className="min-h-72 resize-none bg-white p-4 text-sm leading-7"
          maxLength={MAX_INSTRUCTION_LENGTH}
          placeholder="Example: For negotiation calls, keep replies polite and confident. Mention my full-stack experience, but avoid sounding desperate. Prefer practical short answers."
          value={customInstructions}
          onChange={(event) => setCustomInstructions(event.target.value)}
        />
        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-slate-500">
            {customInstructions.length}/{MAX_INSTRUCTION_LENGTH} characters
          </p>
          <Button
            className="gap-2 bg-amber-700 text-white hover:bg-amber-800"
            disabled={isSaving}
            onClick={() => void saveInstructions()}
          >
            {isSaving ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Save className="size-4" />
            )}
            Save instructions
          </Button>
        </div>
        {error ? (
          <p className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
            {error}
          </p>
        ) : null}
      </section>
    </div>
  );
}

function InfoList({ items, title }: { items: string[]; title: string }) {
  return (
    <div>
      <p className="font-semibold text-slate-800">{title}</p>
      <ul className="mt-2 space-y-1 text-sm leading-6 text-slate-600">
        {items.map((item) => (
          <li key={item}>- {item}</li>
        ))}
      </ul>
    </div>
  );
}
