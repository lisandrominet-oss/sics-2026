import LoadingFrame, { HeaderSkeleton } from "@/components/ui/LoadingFrame";
import { SkeletonRows } from "@/components/ui/Skeleton";

export default function Loading() {
  return (
    <LoadingFrame>
      <HeaderSkeleton withAction />
      <div className="mt-6">
        <SkeletonRows silent rows={5} />
      </div>
    </LoadingFrame>
  );
}
