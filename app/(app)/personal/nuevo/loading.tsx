import LoadingFrame, { HeaderSkeleton } from "@/components/ui/LoadingFrame";
import { Skeleton } from "@/components/ui/Skeleton";

export default function Loading() {
  return (
    <LoadingFrame width="max-w-3xl">
      <HeaderSkeleton />
      <Skeleton className="mt-6 h-96 w-full rounded-xl" />
    </LoadingFrame>
  );
}
