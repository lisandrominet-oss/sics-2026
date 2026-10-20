import LoadingFrame, { HeaderSkeleton } from "@/components/ui/LoadingFrame";
import { Skeleton } from "@/components/ui/Skeleton";

export default function Loading() {
  return (
    <LoadingFrame width="max-w-4xl">
      <HeaderSkeleton />
      <Skeleton className="mt-6 h-64 w-full rounded-xl" />
    </LoadingFrame>
  );
}
