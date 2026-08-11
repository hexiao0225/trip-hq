import Link from "next/link";

import { confirmSegment, discardSegment, reparseEmail } from "@/app/actions";
import { Nav } from "@/components/nav";
import { SegmentCard } from "@/components/segment-card";
import { SetupNotice } from "@/components/setup-notice";
import type { InboundEmail, Segment } from "@/lib/db/schema";
import {
  getPendingSegments,
  getRecentEmails,
} from "@/lib/queries";
import { formatDayHeading } from "@/lib/time";

const STATUS_STYLES: Record<string, string> = {
  parsed: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200",
  pending: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200",
  failed: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200",
  ignored: "bg-stone-100 text-stone-700 dark:bg-stone-800 dark:text-stone-300",
};

function EmailRow({ email }: { email: InboundEmail }) {
  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-edge px-4 py-3 last:border-b-0">
      <span
        className={`rounded-md px-1.5 py-0.5 text-[10px] font-semibold tracking-wide uppercase ${
          STATUS_STYLES[email.parseStatus] ?? STATUS_STYLES.ignored
        }`}
      >
        {email.parseStatus}
      </span>

      <span className="min-w-0 flex-1 truncate text-sm">
        {email.subject ?? "(no subject)"}
        <span className="text-muted"> · {email.fromAddress ?? "unknown"}</span>
      </span>

      {email.parseError && (
        <span className="w-full text-xs text-muted">{email.parseError}</span>
      )}

      <form action={reparseEmail}>
        <input type="hidden" name="id" value={email.id} />
        <button type="submit" className="btn-secondary px-2 py-1 text-xs">
          Re-parse
        </button>
      </form>
    </li>
  );
}

function PendingItem({ segment }: { segment: Segment }) {
  return (
    <div className="rounded-xl border border-amber-300 bg-amber-50/50 p-2 dark:border-amber-900 dark:bg-amber-950/20">
      <SegmentCard segment={segment} />

      <div className="mt-2 flex flex-wrap items-center gap-2 px-2 pb-1">
        <form action={confirmSegment}>
          <input type="hidden" name="id" value={segment.id} />
          <button type="submit" className="btn-primary px-3 py-1.5 text-xs">
            Add to timeline
          </button>
        </form>

        <Link
          href={`/segment/${segment.id}`}
          className="btn-secondary px-3 py-1.5 text-xs"
        >
          Edit first
        </Link>

        <form action={discardSegment}>
          <input type="hidden" name="id" value={segment.id} />
          <button type="submit" className="btn-danger px-3 py-1.5 text-xs">
            Discard
          </button>
        </form>
      </div>
    </div>
  );
}

// Trip data is per-request and changes constantly; never prerender it.
export const dynamic = "force-dynamic";

export default async function InboxPage() {
  let pending: Segment[];
  let emails: InboundEmail[];
  try {
    [pending, emails] = await Promise.all([
      getPendingSegments(),
      getRecentEmails(),
    ]);
  } catch (error) {
    return <SetupNotice error={error} />;
  }

  return (
    <>
      <Nav pendingCount={pending.length} />

      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-6">
        <h1 className="text-xl font-semibold tracking-tight">Review</h1>
        <p className="mt-1 text-sm text-muted">
          Anything parsed out of a forwarded email waits here until you confirm
          it, so a bad read never lands on the timeline.
        </p>

        {pending.length === 0 ? (
          <div className="mt-6 rounded-xl border border-dashed border-edge px-4 py-8 text-center text-sm text-muted">
            Nothing waiting. Forward a confirmation email to your trip address
            and it&apos;ll show up here.
          </div>
        ) : (
          <div className="mt-6 space-y-3">
            {pending.map((segment) => (
              <PendingItem key={segment.id} segment={segment} />
            ))}
          </div>
        )}

        <h2 className="mt-10 text-sm font-semibold tracking-wide uppercase">
          Recent emails
        </h2>

        {emails.length === 0 ? (
          <p className="mt-3 text-sm text-muted">
            No emails received yet. See the README for connecting an inbound
            address.
          </p>
        ) : (
          <ul className="mt-3 overflow-hidden rounded-xl border border-edge bg-surface">
            {emails.map((email) => (
              <EmailRow key={email.id} email={email} />
            ))}
          </ul>
        )}

        {emails.length > 0 && (
          <p className="mt-3 text-xs text-muted">
            Most recent:{" "}
            {formatDayHeading(
              emails[0].receivedAt.toISOString().slice(0, 10),
            )}
          </p>
        )}
      </main>
    </>
  );
}
