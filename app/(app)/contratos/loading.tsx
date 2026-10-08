import LoadingFrame, { HeaderSkeleton, StatCardsSkeleton } from "@/components/ui/LoadingFrame";
import { Skeleton, SkeletonRows } from "@/components/ui/Skeleton";

export default function Loading() {
  return (
    <LoadingFrame>
      <HeaderSkeleton withAction />
      <StatCardsSkeleton />
      <Skeleton className="mt-6 h-10 w-80 max-w-full rounded-lg" />
      <div className="mt-4">
        <SkeletonRows silent rows={5} />
      </div>
    </LoadingFrame>
  );
}
