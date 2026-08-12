import Link from "next/link";

import { travelerById } from "@/lib/config";
import type { Segment } from "@/lib/db/schema";
import { kindMeta } from "@/lib/kinds";
import {
  formatDate,
  formatDuration,
  formatTimeWithZone,
  nightsBetween,
} from "@/lib/time";

function TravelerBadges({ ids }: { ids: string[] }) {
  if (ids.length === 0) return null;
  return (
    <span className="flex gap-1">
      {ids.map((id) => {
        const traveler = travelerById(id);
        if (!traveler) return null;
        return (
          <span
            key={id}
            title={traveler.name}
            className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold ${traveler.badgeClass}`}
          >
            {traveler.initial}
          </span>
        );
      })}
    </span>
  );
}

/**
 * Describes when the segment happens, in words that suit its kind: a duration
 * for flights, a night count for stays, a plain time for everything else.
 */
function Timing({ segment }: { segment: Segment }) {
  const { startAt, endAt, startTz, endTz } = segment;
  const meta = kindMeta(segment.kind);

  if (!startAt) {
    return <span className="text-muted">No date set</span>;
  }

  const start = formatTimeWithZone(startAt, startTz);

  if (!endAt) return <span>{start}</span>;

  const arrivalZone = endTz ?? startTz;

  // Stays and hires span days, so a night/day count reads better than the
  // raw duration a flight would want ("4 days", not "96h").
  if (meta.ranged) {
    const span = nightsBetween(startAt, endAt, startTz);
    const unit = meta.id === "hotel" ? "night" : "day";
    return (
      <span>
        {start} → {formatDate(endAt, arrivalZone)}
        {span > 0 && (
          <span className="text-muted">
            {" "}
            · {span} {span === 1 ? unit : `${unit}s`}
          </span>
        )}
      </span>
    );
  }

  const sameDay =
    formatDate(startAt, startTz) === formatDate(endAt, arrivalZone);
  const end = formatTimeWithZone(endAt, arrivalZone);
  const duration = formatDuration(startAt, endAt);

  return (
    <span>
      {start} → {sameDay ? end : `${formatDate(endAt, arrivalZone)}, ${end}`}
      {duration && <span className="text-muted"> · {duration}</span>}
    </span>
  );
}

export function SegmentCard({ segment }: { segment: Segment }) {
  const meta = kindMeta(segment.kind);
  const cancelled = segment.status === "cancelled";

  return (
    <Link
      href={`/segment/${segment.id}`}
      className={`block rounded-xl border border-edge bg-surface p-4 transition hover:border-stone-300 hover:shadow-sm ${
        cancelled ? "opacity-55" : ""
      }`}
    >
      <div className="flex items-start gap-3">
        <span aria-hidden className="mt-0.5 text-lg leading-none">
          {meta.icon}
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`rounded-md px-1.5 py-0.5 text-[10px] font-semibold tracking-wide uppercase ${meta.chipClass}`}
            >
              {meta.label}
            </span>
            {cancelled && (
              <span className="rounded-md bg-red-100 px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-red-700 uppercase">
                Cancelled
              </span>
            )}
            <TravelerBadges ids={segment.travelers} />
          </div>

          <h3
            className={`mt-1.5 font-medium ${cancelled ? "line-through" : ""}`}
          >
            {segment.title}
          </h3>

          {(segment.fromLabel || segment.toLabel) && (
            <p className="mt-0.5 text-sm text-muted">
              {segment.fromLabel ?? "?"} → {segment.toLabel ?? "?"}
            </p>
          )}

          {segment.address && (
            <p className="mt-0.5 text-sm text-muted">{segment.address}</p>
          )}

          <p className="mt-1.5 font-mono text-xs text-foreground/80">
            <Timing segment={segment} />
          </p>

          {(segment.vendor || segment.confirmation) && (
            <p className="mt-1 text-xs text-muted">
              {segment.vendor}
              {segment.vendor && segment.confirmation && " · "}
              {segment.confirmation && (
                <span className="font-mono">{segment.confirmation}</span>
              )}
            </p>
          )}
        </div>
      </div>
    </Link>
  );
}
