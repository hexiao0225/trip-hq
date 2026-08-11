import { Nav } from "@/components/nav";
import { EMPTY_SEGMENT, SegmentForm } from "@/components/segment-form";
import { SetupNotice } from "@/components/setup-notice";
import { getPendingCount } from "@/lib/queries";

// Trip data is per-request and changes constantly; never prerender it.
export const dynamic = "force-dynamic";

export default async function AddPage() {
  let pendingCount = 0;
  try {
    pendingCount = await getPendingCount();
  } catch (error) {
    return <SetupNotice error={error} />;
  }

  return (
    <>
      <Nav pendingCount={pendingCount} />
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-6">
        <h1 className="mb-6 text-xl font-semibold tracking-tight">
          Add to the trip
        </h1>
        <SegmentForm initial={EMPTY_SEGMENT} />
      </main>
    </>
  );
}
