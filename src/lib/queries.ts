import "server-only";

import { asc, desc, eq, ne } from "drizzle-orm";

import { LEGS, type LegId } from "@/lib/config";
import { getDb } from "@/lib/db";
import { inboundEmails, segments, type Segment } from "@/lib/db/schema";
import { dayKey } from "@/lib/time";

export interface DayGroup {
  /** ISO date in the day's own timezone, or "unknown" for undated segments. */
  date: string;
  segments: Segment[];
}

/** All segments that belong on the timeline, earliest first. Nulls last. */
export async function getTimelineSegments(): Promise<Segment[]> {
  return getDb()
    .select()
    .from(segments)
    .where(ne(segments.status, "pending"))
    .orderBy(asc(segments.startAt), asc(segments.createdAt));
}

/** Segments parsed from email that still need a human to confirm them. */
export async function getPendingSegments(): Promise<Segment[]> {
  return getDb()
    .select()
    .from(segments)
    .where(eq(segments.status, "pending"))
    .orderBy(desc(segments.createdAt));
}

export async function getSegment(id: string): Promise<Segment | undefined> {
  const rows = await getDb()
    .select()
    .from(segments)
    .where(eq(segments.id, id))
    .limit(1);
  return rows[0];
}

export async function getRecentEmails(limit = 25) {
  return getDb()
    .select()
    .from(inboundEmails)
    .orderBy(desc(inboundEmails.receivedAt))
    .limit(limit);
}

export async function getPendingCount(): Promise<number> {
  const rows = await getDb()
    .select({ id: segments.id })
    .from(segments)
    .where(eq(segments.status, "pending"));
  return rows.length;
}

/**
 * Group segments into calendar days, using each segment's own timezone so a
 * red-eye landing at 06:00 in London files under the London date.
 */
export function groupByDay(rows: Segment[]): DayGroup[] {
  const groups = new Map<string, Segment[]>();

  for (const row of rows) {
    const key = row.startAt ? dayKey(row.startAt, row.startTz) : "unknown";
    const bucket = groups.get(key);
    if (bucket) bucket.push(row);
    else groups.set(key, [row]);
  }

  return [...groups.entries()]
    .sort(([a], [b]) => {
      // Undated segments sort to the very end.
      if (a === "unknown") return 1;
      if (b === "unknown") return -1;
      return a.localeCompare(b);
    })
    .map(([date, items]) => ({ date, segments: items }));
}

/**
 * Which leg a segment belongs to. An explicit `leg` always wins; otherwise fall
 * back to matching the date against the ranges in config.
 */
export function resolveLeg(row: Segment): LegId {
  if (row.leg && LEGS.some((l) => l.id === row.leg)) {
    return row.leg as LegId;
  }
  if (!row.startAt) return "unscheduled";

  const iso = dayKey(row.startAt, row.startTz);
  for (const leg of LEGS) {
    if (leg.id === "unscheduled") continue;
    const afterStart = !leg.start || iso >= leg.start;
    const beforeEnd = !leg.end || iso <= leg.end;
    if (leg.start && leg.end && afterStart && beforeEnd) return leg.id;
  }
  return "unscheduled";
}

/** Restrict a list to segments involving a given traveler. */
export function filterByTraveler(
  rows: Segment[],
  travelerId: string | null,
): Segment[] {
  if (!travelerId) return rows;
  return rows.filter(
    (row) => row.travelers.length === 0 || row.travelers.includes(travelerId),
  );
}

/** The next thing happening, used for the "up next" card. */
export function nextUpcoming(rows: Segment[], now = new Date()): Segment | null {
  return (
    rows.find(
      (row) =>
        row.startAt !== null &&
        row.status !== "cancelled" &&
        row.startAt.getTime() >= now.getTime(),
    ) ?? null
  );
}
