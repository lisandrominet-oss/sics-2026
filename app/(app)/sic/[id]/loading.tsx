import LoadingFrame, { HeaderSkeleton } from "@/components/ui/LoadingFrame";
import { Skeleton, SkeletonRows } from "@/components/ui/Skeleton";

export default function Loading() {
  return (
    <LoadingFrame width="max-w-6xl">
      <Skeleton className="h-4 w-36" />
      <div className="mt-4">
        <HeaderSkeleton />
      </div>
      <div className="mt-6 grid grid-cols-1 items-start gap-4 lg:grid-cols-[minmax(0,1fr)_24rem] lg:gap-x-6">
        <div className="rounded-xl border border-slate-200 bg-white p-5 lg:col-start-2 lg:row-start-1">
          <Skeleton className="h-6 w-40 rounded-full" />
        </div>
        <div className="space-y-4 lg:col-start-1 lg:row-span-2 lg:row-start-1">
          <div className="flex flex-wrap gap-x-10 gap-y-5 rounded-xl border border-slate-200 bg-white p-5">
            <Skeleton className="h-10 w-40" />
            <Skeleton className="h-10 w-32" />
            <Skeleton className="h-10 w-28" />
          </div>
          <SkeletonRows silent rows={2} />
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5 lg:col-start-2 lg:row-start-2">
          <Skeleton className="h-4 w-36" />
          <Skeleton className="mt-4 h-3 w-48" />
          <Skeleton className="mt-3 h-3 w-40" />
        </div>
      </div>
    </LoadingFrame>
  );
}
