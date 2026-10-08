import LoadingFrame, { HeaderSkeleton, InfoCardSkeleton } from "@/components/ui/LoadingFrame";
import { Skeleton } from "@/components/ui/Skeleton";

export default function Loading() {
  return (
    <LoadingFrame width="max-w-5xl">
      <Skeleton className="h-4 w-36" />
      <div className="mt-4">
        <HeaderSkeleton />
      </div>
      <div className="mt-4">
        <InfoCardSkeleton items={4} />
      </div>
      <Skeleton className="mt-6 h-9 w-full max-w-md" />
      <div className="mt-4">
        <InfoCardSkeleton items={6} />
      </div>
    </LoadingFrame>
  );
}
