import LoadingFrame, { HeaderSkeleton } from "@/components/ui/LoadingFrame";
import { Skeleton } from "@/components/ui/Skeleton";

export default function Loading() {
  return (
    <LoadingFrame width="max-w-4xl">
      <HeaderSkeleton withAction />
      <Skeleton className="mt-6 h-48 w-full rounded-xl" />
      <Skeleton className="mt-4 h-40 w-full rounded-xl" />
    </LoadingFrame>
  );
}
