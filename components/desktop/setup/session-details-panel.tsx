"use client";

import { ArrowLeft, ChevronDown, Loader2, Mic, Sparkles, Upload } from "lucide-react";
import { useRef } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";

import type {
  DesktopDocumentGroups,
  DesktopSessionDraft,
  DesktopSetupStep,
} from "./types";

type SessionDetailsPanelProps = {
  documents: DesktopDocumentGroups;
  draft: DesktopSessionDraft;
  error: string;
  isUploadingReference: boolean;
  onDraftChange: (draft: DesktopSessionDraft) => void;
  onReferenceUpload: (files: FileList | null) => void;
  onStepChange: (step: DesktopSetupStep) => void;
};

const languageOptions = [
  { label: "English", value: "english" },
  { label: "Hinglish", value: "hinglish" },
  { label: "Hindi", value: "hindi" },
  { label: "Auto detect", value: "auto" },
];

const modelOptions = [
  { label: "GPT-4o Mini", value: "gpt-4o-mini" },
  { label: "GPT-4.1 Mini", value: "gpt-4.1-mini" },
  { label: "GPT-5 Mini", value: "gpt-5-mini" },
];

export function SessionDetailsPanel({
  documents,
  draft,
  error,
  isUploadingReference,
  onDraftChange,
  onReferenceUpload,
  onStepChange,
}: SessionDetailsPanelProps) {
  const labels = getSessionLabels(draft.sessionType);
  const referenceInputRef = useRef<HTMLInputElement | null>(null);

  function update<K extends keyof DesktopSessionDraft>(
    key: K,
    value: DesktopSessionDraft[K]
  ) {
    onDraftChange({ ...draft, [key]: value });
  }

  function toggleReference(documentId: string) {
    update(
      "referenceDocumentIds",
      draft.referenceDocumentIds.includes(documentId)
        ? draft.referenceDocumentIds.filter((id) => id !== documentId)
        : [...draft.referenceDocumentIds, documentId]
    );
  }

  return (
    <div className="space-y-3 p-4">
      <div className="grid grid-cols-2 gap-3">
        <Field label={labels.primaryLabel}>
          <Input
            className="h-9 rounded-xl text-sm font-normal"
            placeholder={labels.primaryPlaceholder}
            value={draft.company}
            onChange={(event) => update("company", event.target.value)}
          />
        </Field>
        <Field label={labels.topicLabel}>
          <Input
            className="h-9 rounded-xl text-sm font-normal"
            placeholder={labels.topicPlaceholder}
            value={draft.position}
            onChange={(event) => update("position", event.target.value)}
          />
        </Field>
        <Field label="Interview Language">
          <SelectLike
            options={languageOptions}
            value={draft.language}
            onChange={(value) => update("language", value)}
          />
        </Field>
        <Field label="AI Model">
          <SelectLike
            options={modelOptions}
            value={draft.model}
            onChange={(value) => update("model", value)}
          />
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <ToggleRow
          checked={draft.autoAnswer}
          icon={<Mic className="size-4" />}
          label="Auto AI Answer"
          onCheckedChange={(value) => update("autoAnswer", value)}
        />
        <ToggleRow
          checked={draft.humanize}
          icon={<Sparkles className="size-4 text-amber-600" />}
          label="Humanize"
          onCheckedChange={(value) => update("humanize", value)}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Resume">
          <SelectLike
            options={[
              { label: "No resume selected", value: "" },
              ...documents.resumes.map((resume) => ({
                label: resume.fileName,
                value: resume.id,
              })),
            ]}
            value={draft.resumeDocumentId}
            onChange={(value) => update("resumeDocumentId", value)}
          />
        </Field>
        <Field label="Cue Notes / Reference Docs">
          <ReferencePicker
            documents={documents.references}
            selectedIds={draft.referenceDocumentIds}
            onToggle={toggleReference}
          />
          <div className="mt-1.5 flex items-center justify-between gap-2">
            <button
              className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-medium text-amber-700 transition hover:bg-amber-50 hover:text-amber-800 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={isUploadingReference}
              onClick={() => referenceInputRef.current?.click()}
              type="button"
            >
              {isUploadingReference ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Upload className="size-3.5" />
              )}
              Upload cue notes
            </button>
            {draft.referenceDocumentIds.length ? (
              <span className="text-xs text-slate-400">
                {draft.referenceDocumentIds.length} selected
              </span>
            ) : null}
          </div>
          <input
            ref={referenceInputRef}
            accept=".pdf,.doc,.docx,.txt,.md,.csv,.json"
            className="hidden"
            multiple
            type="file"
            onChange={(event) => {
              onReferenceUpload(event.target.files);
              event.currentTarget.value = "";
            }}
          />
        </Field>
      </div>

      <Field label="Quick Instructions / Cue Text">
        <Textarea
          className="min-h-20 resize-none rounded-xl text-sm font-normal"
          maxLength={2000}
          placeholder="Paste quick notes like yesterday's work, today's report points, questions to ask, tone, or exact things Kasa should remember."
          value={draft.instructions}
          onChange={(event) => update("instructions", event.target.value)}
        />
        <div className="mt-1 text-right text-xs text-slate-400">
          {draft.instructions.length}/2000
        </div>
      </Field>

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <div className="grid grid-cols-[1fr_1.35fr] gap-3 border-t border-slate-100 pt-4">
        <Button
          className="h-11 gap-2 rounded-xl hover:bg-slate-100 hover:text-slate-950"
          onClick={() => onStepChange("home")}
          type="button"
          variant="outline"
        >
          <ArrowLeft className="size-4" />
          Back
        </Button>
        <Button
          className="h-11 rounded-xl bg-slate-950 text-white hover:bg-slate-800 hover:text-white"
          onClick={() => onStepChange("audio")}
          type="button"
        >
          Continue
        </Button>
      </div>
    </div>
  );
}

function Field({
  children,
  label,
}: {
  children: React.ReactNode;
  label: string;
}) {
  return (
    <Label className="block space-y-1.5 text-sm font-medium text-slate-800">
      <span>{label}</span>
      {children}
    </Label>
  );
}

function SelectLike({
  onChange,
  options,
  value,
}: {
  onChange: (value: string) => void;
  options: Array<{ label: string; value: string }>;
  value: string;
}) {
  return (
    <div className="relative">
      <select
        className="h-9 w-full appearance-none rounded-xl border border-slate-200 bg-white px-3 pr-9 text-sm font-normal outline-none transition hover:border-slate-400 hover:text-slate-950 focus:border-amber-500 focus:ring-2 focus:ring-amber-100"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
    </div>
  );
}

function ReferencePicker({
  documents,
  selectedIds,
  onToggle,
}: {
  documents: DesktopDocumentGroups["references"];
  selectedIds: string[];
  onToggle: (documentId: string) => void;
}) {
  if (!documents.length) {
    return (
      <div className="rounded-xl border border-dashed border-slate-200 bg-white px-3 py-2 text-xs leading-5 text-slate-500">
        Upload a meeting brief or notes from Documents.
      </div>
    );
  }

  return (
    <div className="max-h-[82px] space-y-1 overflow-y-auto rounded-xl border border-slate-200 bg-white p-1.5">
      {documents.map((document) => {
        const selected = selectedIds.includes(document.id);

        return (
          <button
            className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs transition ${
              selected
                ? "bg-slate-950 text-white"
                : "text-slate-700 hover:bg-slate-50 hover:text-slate-950"
            }`}
            key={document.id}
            onClick={() => onToggle(document.id)}
            type="button"
          >
            <span
              className={`grid size-4 shrink-0 place-items-center rounded border text-[10px] ${
                selected ? "border-white/60 bg-white text-slate-950" : "border-slate-300"
              }`}
            >
              {selected ? "✓" : ""}
            </span>
            <span className="min-w-0 flex-1 truncate">{document.fileName}</span>
          </button>
        );
      })}
    </div>
  );
}

function ToggleRow({
  checked,
  icon,
  label,
  onCheckedChange,
}: {
  checked: boolean;
  icon: React.ReactNode;
  label: string;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex h-11 items-center justify-between rounded-xl border border-slate-200 px-3 transition hover:border-slate-300 hover:bg-slate-50">
      <div className="flex items-center gap-2 text-sm font-normal">
        {icon}
        {label}
      </div>
      <Switch checked={checked} onCheckedChange={onCheckedChange} />
    </div>
  );
}

function getSessionLabels(type: DesktopSessionDraft["sessionType"]) {
  if (type === "normal") {
    return {
      primaryLabel: "Conversation context",
      primaryPlaceholder: "Example: new overseas company, daily team calls",
      topicLabel: "Main topic",
      topicPlaceholder: "Example: manager updates, HR, standup, client discussion",
    };
  }

  if (type === "client") {
    return {
      primaryLabel: "Client / Company",
      primaryPlaceholder: "Example: Digi Verifier",
      topicLabel: "Call topic",
      topicPlaceholder: "Example: HR negotiation call",
    };
  }

  return {
    primaryLabel: "Company",
    primaryPlaceholder: "Example: Digi Verifier",
    topicLabel: "Position",
    topicPlaceholder: "Example: Senior Full Stack Developer",
  };
}
