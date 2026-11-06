import LoadingFrame, { HeaderSkeleton } from "@/components/ui/LoadingFrame";
import { Skeleton, SkeletonRows } from "@/components/ui/Skeleton";

export default function Loading() {
  return (
    <LoadingFrame>
      <HeaderSkeleton withAction />
      <Skeleton className="mt-6 h-8 w-96 max-w-full" />
      <div className="mt-6">
        <SkeletonRows silent rows={6} />
      </div>
    </LoadingFrame>
  );
}
