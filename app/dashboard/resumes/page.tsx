import { auth } from "@/auth";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { DocumentManager } from "@/components/dashboard/documents/document-manager";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";

export default async function ResumeDocumentsPage() {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login");
  }

  if (session.user.role === "admin") {
    redirect("/admin");
  }

  const documents = await prisma.userDocument.findMany({
    where: {
      userId: session.user.id,
    },
    orderBy: {
      createdAt: "desc",
    },
    select: {
      id: true,
      contentType: true,
      createdAt: true,
      documentType: true,
      fileName: true,
      sizeBytes: true,
    },
  });

  return (
    <DashboardShell activeItem="documents" user={session.user}>
      <div className="border-b border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-950 sm:px-6">
        <span className="font-semibold">Documents:</span> Manage resumes, cue
        notes, and reference files used by Kasa Cue during live sessions.
      </div>
      <div className="flex-1 px-4 py-6 sm:px-6 lg:px-8">
        <DocumentManager
          initialDocuments={documents.map((document) => ({
            ...document,
            createdAt: document.createdAt.toISOString(),
          }))}
        />
      </div>
    </DashboardShell>
  );
}
