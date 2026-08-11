import { LoadingOverlay } from "@/components/ui/loading-overlay";

export default function DashboardLoading() {
  return (
    <LoadingOverlay
      description="Loading your sessions and saved context."
      label="Opening dashboard"
    />
  );
}
