import { notFound } from "next/navigation";

import { Nav } from "@/components/nav";
import { SegmentForm, type SegmentFormValues } from "@/components/segment-form";
import { SetupNotice } from "@/components/setup-notice";
import type { Segment } from "@/lib/db/schema";
import { getPendingCount, getSegment } from "@/lib/queries";
import { dateToLocalInput } from "@/lib/time";

/** Flatten a stored row into the plain strings the client form works with. */
function toFormValues(segment: Segment): SegmentFormValues {
  return {
    id: segment.id,
    kind: segment.kind,
    title: segment.title,
    vendor: segment.vendor ?? "",
    confirmation: segment.confirmation ?? "",
    startLocal: dateToLocalInput(segment.startAt, segment.startTz),
    startTz: segment.startTz,
    endLocal: dateToLocalInput(segment.endAt, segment.endTz ?? segment.startTz),
    endTz: segment.endTz ?? "",
    fromLabel: segment.fromLabel ?? "",
    toLabel: segment.toLabel ?? "",
    address: segment.address ?? "",
    travelers: segment.travelers,
    leg: segment.leg ?? "",
    status: segment.status,
    costAmount: segment.costAmount ?? "",
    costCurrency: segment.costCurrency ?? "",
    notes: segment.notes ?? "",
    link: segment.link ?? "",
  };
}

// Trip data is per-request and changes constantly; never prerender it.
export const dynamic = "force-dynamic";

export default async function EditSegmentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  let segment: Segment | undefined;
  let pendingCount = 0;
  try {
    [segment, pendingCount] = await Promise.all([
      getSegment(id),
      getPendingCount(),
    ]);
  } catch (error) {
    return <SetupNotice error={error} />;
  }

  if (!segment) notFound();

  const details = Object.entries(segment.details);

  return (
    <>
      <Nav pendingCount={pendingCount} />
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-6">
        <h1 className="mb-1 text-xl font-semibold tracking-tight">
          {segment.title}
        </h1>
        <p className="mb-6 text-sm text-muted">
          {segment.source === "email"
            ? "Added from a forwarded email"
            : "Added by hand"}
        </p>

        {details.length > 0 && (
          <dl className="mb-6 grid gap-x-6 gap-y-2 rounded-xl border border-edge bg-surface px-4 py-3 text-sm sm:grid-cols-2">
            {details.map(([label, value]) => (
              <div key={label} className="flex justify-between gap-3">
                <dt className="text-muted">{label}</dt>
                <dd className="text-right font-medium">{value}</dd>
              </div>
            ))}
          </dl>
        )}

        <SegmentForm initial={toFormValues(segment)} />
      </main>
    </>
  );
}
