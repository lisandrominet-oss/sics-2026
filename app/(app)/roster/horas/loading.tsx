import LoadingFrame, { HeaderSkeleton } from "@/components/ui/LoadingFrame";
import { Skeleton, SkeletonRows } from "@/components/ui/Skeleton";

export default function Loading() {
  return (
    <LoadingFrame width="max-w-[96rem]">
      <HeaderSkeleton />
      <Skeleton className="mt-6 h-10 w-80 max-w-full rounded-lg" />
      <div className="mt-6">
        <SkeletonRows silent rows={8} />
      </div>
    </LoadingFrame>
  );
}
