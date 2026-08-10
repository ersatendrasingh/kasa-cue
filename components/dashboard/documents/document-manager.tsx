"use client";

import {
  CheckCircle2,
  FileText,
  Loader2,
  Sparkles,
  Trash2,
  Upload,
} from "lucide-react";
import { useMemo, useRef, useState } from "react";

import { DeleteDocumentModal } from "@/components/dashboard/modals/delete-document-modal";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { UserDocumentSummary } from "@/components/workspace/types";

type DocumentManagerProps = {
  initialDocuments: UserDocumentSummary[];
};

type DocumentTab = "resume" | "reference";

const tabLabels: Record<DocumentTab, string> = {
  resume: "Resumes",
  reference: "Cue notes",
};

export function DocumentManager({ initialDocuments }: DocumentManagerProps) {
  const [documents, setDocuments] =
    useState<UserDocumentSummary[]>(initialDocuments);
  const [activeTab, setActiveTab] = useState<DocumentTab>("resume");
  const [deleteTarget, setDeleteTarget] = useState<UserDocumentSummary | null>(
    null
  );
  const [isUploading, setIsUploading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState("");
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const visibleDocuments = useMemo(
    () => documents.filter((document) => document.documentType === activeTab),
    [activeTab, documents]
  );

  async function uploadFiles(files: FileList | null) {
    if (!files?.length) {
      return;
    }

    setError("");
    setIsUploading(true);

    try {
      const uploadedDocuments: UserDocumentSummary[] = [];

      for (const file of Array.from(files)) {
        const formData = new FormData();
        formData.append("documentType", activeTab);
        formData.append("extractedText", await readTextAttachment(file));
        formData.append("file", file);

        const response = await fetch("/api/documents", {
          method: "POST",
          body: formData,
        });
        const data = await parseUploadResponse(response);

        if (!response.ok || !data.document) {
          throw new Error(data.error ?? "Could not upload document.");
        }

        uploadedDocuments.push(data.document);
      }

      setDocuments((current) => [...uploadedDocuments, ...current]);
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Could not upload document."
      );
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  }

  async function deleteDocument() {
    if (!deleteTarget) {
      return;
    }

    setError("");
    setIsDeleting(true);

    try {
      const response = await fetch(`/api/documents/${deleteTarget.id}`, {
        method: "DELETE",
      });
      const data = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(data.error ?? "Could not delete document.");
      }

      setDocuments((current) =>
        current.filter((document) => document.id !== deleteTarget.id)
      );
      setDeleteTarget(null);
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Could not delete document."
      );
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="text-2xl font-semibold">Resume / Documents</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
            Upload resumes, daily cue notes, meeting briefs, agendas, and
            talking points so live sessions can answer with consistent context.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline">
            <Sparkles className="size-4" />
            Create AI resume
          </Button>
          <Button
            className="bg-amber-700 text-white hover:bg-amber-800"
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className="size-4" />
            Upload {activeTab === "resume" ? "resume" : "cue notes"}
          </Button>
        </div>
      </div>

      <div className="border-b border-slate-200">
        <div className="flex gap-6">
          {(["resume", "reference"] as DocumentTab[]).map((tab) => (
            <button
              className={
                activeTab === tab
                  ? "border-b-2 border-amber-700 px-1 py-3 text-sm font-semibold text-amber-700"
                  : "px-1 py-3 text-sm font-semibold text-slate-400 transition hover:text-slate-700"
              }
              key={tab}
              onClick={() => setActiveTab(tab)}
              type="button"
            >
              {tabLabels[tab]}
            </button>
          ))}
        </div>
      </div>

      <button
        className="flex min-h-48 w-full flex-col items-center justify-center rounded-lg border-2 border-dashed border-slate-300 bg-white px-6 py-8 text-center transition hover:border-amber-500 hover:bg-amber-50/40"
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => {
          event.preventDefault();
          void uploadFiles(event.dataTransfer.files);
        }}
        onClick={() => fileInputRef.current?.click()}
        type="button"
      >
        {isUploading ? (
          <Loader2 className="mb-3 size-9 animate-spin text-slate-400" />
        ) : (
          <Upload className="mb-3 size-9 text-slate-400" />
        )}
        <p className="text-sm font-semibold text-slate-950">
          Click to upload or drag and drop
        </p>
        <p className="mt-2 text-xs text-slate-500">
          PDF, DOC, DOCX, TXT, MD, CSV, JSON · max 8MB
        </p>
      </button>

      <input
        ref={fileInputRef}
        accept={
          activeTab === "resume"
            ? ".pdf,.doc,.docx,.txt,.md"
            : ".pdf,.doc,.docx,.txt,.md,.csv,.json"
        }
        className="hidden"
        multiple={activeTab === "reference"}
        onChange={(event) => void uploadFiles(event.target.files)}
        type="file"
      />

      {error ? (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
          {error}
        </p>
      ) : null}

      <DocumentList
        documents={visibleDocuments}
        emptyText={
          activeTab === "resume"
            ? "No resumes uploaded yet."
            : "No cue notes or reference documents uploaded yet."
        }
        onDelete={setDeleteTarget}
      />

      <DeleteDocumentModal
        document={deleteTarget}
        isDeleting={isDeleting}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => void deleteDocument()}
      />
    </div>
  );
}

async function parseUploadResponse(response: Response) {
  const text = await response.text();

  if (!text) {
    return {
      error: response.ok
        ? "Upload response was empty."
        : "Upload failed without an error message.",
    } as {
      document?: UserDocumentSummary;
      error?: string;
    };
  }

  try {
    return JSON.parse(text) as {
      document?: UserDocumentSummary;
      error?: string;
    };
  } catch {
    return {
      error: text.slice(0, 300),
    };
  }
}

function DocumentList({
  documents,
  emptyText,
  onDelete,
}: {
  documents: UserDocumentSummary[];
  emptyText: string;
  onDelete: (document: UserDocumentSummary) => void;
}) {
  if (!documents.length) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
        <FileText className="mx-auto mb-3 size-8 text-slate-300" />
        {emptyText}
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
      <div className="grid grid-cols-[minmax(0,1fr)_160px_160px_96px] border-b border-slate-200 px-5 py-4 text-sm font-semibold text-slate-700 md:grid-cols-[minmax(0,1fr)_160px_160px_120px]">
        <span>Title</span>
        <span>Type</span>
        <span>Date</span>
        <span className="text-right">Actions</span>
      </div>
      {documents.map((document) => (
        <div
          className="grid grid-cols-[minmax(0,1fr)_160px_160px_96px] items-center border-b border-slate-100 px-5 py-4 last:border-b-0 md:grid-cols-[minmax(0,1fr)_160px_160px_120px]"
          key={document.id}
        >
          <div className="flex min-w-0 items-center gap-3">
            <FileText className="size-5 shrink-0 text-slate-400" />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-slate-950">
                {document.fileName}
              </p>
              <p className="text-xs text-slate-500">
                {document.contentType || "Document"} ·{" "}
                {formatFileSize(document.sizeBytes)}
              </p>
            </div>
          </div>
          <Badge className="w-fit gap-1 bg-emerald-50 text-emerald-700 hover:bg-emerald-50">
            <CheckCircle2 className="size-3.5" />
            Uploaded
          </Badge>
          <span className="text-sm text-slate-600">
            {formatDate(document.createdAt)}
          </span>
          <div className="flex justify-end gap-2">
            <Button
              className="text-red-600 hover:text-red-700"
              size="icon"
              variant="ghost"
              onClick={() => onDelete(document)}
            >
              <Trash2 className="size-4" />
            </Button>
          </div>
        </div>
      ))}
    </div>
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

function formatFileSize(sizeBytes: number) {
  if (sizeBytes < 1024 * 1024) {
    return `${Math.max(1, Math.round(sizeBytes / 1024))} KB`;
  }

  return `${(sizeBytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(value: string | Date) {
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(value));
}
