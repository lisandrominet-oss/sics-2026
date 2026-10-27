import LoadingFrame, { HeaderSkeleton } from "@/components/ui/LoadingFrame";
import { Skeleton } from "@/components/ui/Skeleton";

export default function Loading() {
  return (
    <LoadingFrame width="max-w-[96rem]">
      <HeaderSkeleton />
      <Skeleton className="mt-6 h-10 w-80 max-w-full rounded-lg" />
      <div className="max-w-4xl">
        <Skeleton className="mt-6 h-48 w-full rounded-xl" />
        <Skeleton className="mt-4 h-48 w-full rounded-xl" />
      </div>
    </LoadingFrame>
  );
}
