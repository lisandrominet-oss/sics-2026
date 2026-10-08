import LoadingFrame, { HeaderSkeleton, InfoCardSkeleton } from "@/components/ui/LoadingFrame";
import { Skeleton, SkeletonRows } from "@/components/ui/Skeleton";

export default function Loading() {
  return (
    <LoadingFrame width="max-w-3xl">
      <Skeleton className="h-4 w-36" />
      <div className="mt-4">
        <HeaderSkeleton />
      </div>
      <div className="mt-6">
        <InfoCardSkeleton items={8} />
      </div>
      <div className="mt-4">
        <SkeletonRows silent rows={2} />
      </div>
    </LoadingFrame>
  );
}
