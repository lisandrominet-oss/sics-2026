import LoadingFrame, { HeaderSkeleton } from "@/components/ui/LoadingFrame";
import { Skeleton, SkeletonRows } from "@/components/ui/Skeleton";

export default function Loading() {
  return (
    <LoadingFrame width="max-w-5xl">
      <HeaderSkeleton />
      <Skeleton className="mt-6 h-10 w-full max-w-md rounded-lg" />
      <div className="mt-4">
        <SkeletonRows silent rows={6} />
      </div>
    </LoadingFrame>
  );
}
