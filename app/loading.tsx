import { LoadingOverlay } from "@/components/ui/loading-overlay";

export default function Loading() {
  return (
    <LoadingOverlay
      description="Preparing your Kasa Cue workspace."
      label="Loading"
    />
  );
}
