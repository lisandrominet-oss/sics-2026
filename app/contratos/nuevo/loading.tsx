import LoadingFrame, { HeaderSkeleton, InfoCardSkeleton } from "@/components/ui/LoadingFrame";

export default function Loading() {
  return (
    <LoadingFrame width="max-w-3xl">
      <HeaderSkeleton />
      <div className="mt-6">
        <InfoCardSkeleton items={8} />
      </div>
    </LoadingFrame>
  );
}
