import { DateTime } from "luxon";

/**
 * The trip crosses BST, CST and PDT, so every displayed time is rendered in the
 * timezone that segment actually happens in rather than the viewer's local one.
 */

function inZone(date: Date, timezone: string): DateTime {
  return DateTime.fromJSDate(date).setZone(timezone || "UTC");
}

/** "Tue 15 Sep" */
export function formatDate(date: Date, timezone: string): string {
  return inZone(date, timezone).toFormat("ccc d LLL");
}

/** "14:35" */
function formatTime(date: Date, timezone: string): string {
  return inZone(date, timezone).toFormat("HH:mm");
}

/**
 * The city an IANA zone is named after — "Europe/London" becomes "London".
 *
 * Used to label a time when the segment has no city of its own. Timezone
 * abbreviations were the obvious choice here and turn out not to work: no
 * single locale renders them all well (en-US gives "PDT" but "GMT+1" for
 * London; en-GB gives "BST" but "GMT-7" for Los Angeles), and an offset tells
 * you nothing about where the time is local to.
 */
function zoneCity(timezone: string): string {
  const tail = (timezone || "").split("/").pop() ?? "";
  return tail.replace(/_/g, " ") || timezone;
}

/** "14:35 London" — says plainly which place the clock time belongs to. */
export function formatTimeWithZone(
  date: Date,
  timezone: string,
  city?: string | null,
): string {
  return `${formatTime(date, timezone)} ${city?.trim() || zoneCity(timezone)}`;
}

/** Stable key for grouping segments into days, in the segment's own zone. */
export function dayKey(date: Date, timezone: string): string {
  return inZone(date, timezone).toISODate() ?? "unknown";
}

/** "Tuesday, 15 September 2026" */
export function formatDayHeading(isoDate: string): string {
  const dt = DateTime.fromISO(isoDate);
  if (!dt.isValid) return "Undated";
  return dt.toFormat("cccc, d LLLL yyyy");
}

/**
 * Convert the `datetime-local` value a form submits (which has no zone) into a
 * real instant, by interpreting those wall-clock digits in `timezone`.
 */
export function localInputToDate(
  value: string | null | undefined,
  timezone: string,
): Date | null {
  if (!value) return null;
  const dt = DateTime.fromISO(value, { zone: timezone || "UTC" });
  return dt.isValid ? dt.toJSDate() : null;
}

/** Inverse of `localInputToDate`, for pre-filling the edit form. */
export function dateToLocalInput(
  date: Date | null | undefined,
  timezone: string,
): string {
  if (!date) return "";
  return inZone(date, timezone).toFormat("yyyy-LL-dd'T'HH:mm");
}

/** Whole days from now until `date`. Negative once it's in the past. */
function daysUntil(date: Date, timezone: string): number {
  const target = inZone(date, timezone).startOf("day");
  const today = DateTime.now().setZone(timezone || "UTC").startOf("day");
  return Math.round(target.diff(today, "days").days);
}

/** "in 44 days" / "today" / "3 days ago" */
export function relativeDays(date: Date, timezone: string): string {
  const days = daysUntil(date, timezone);
  if (days === 0) return "today";
  if (days === 1) return "tomorrow";
  if (days === -1) return "yesterday";
  if (days > 0) return `in ${days} days`;
  return `${Math.abs(days)} days ago`;
}

/** Nights between check-in and check-out, for hotel rows. */
export function nightsBetween(
  start: Date,
  end: Date,
  timezone: string,
): number {
  const a = inZone(start, timezone).startOf("day");
  const b = inZone(end, timezone).startOf("day");
  return Math.max(0, Math.round(b.diff(a, "days").days));
}

/** "2h 45m" — flight and train duration. */
export function formatDuration(start: Date, end: Date): string {
  const minutes = Math.round((end.getTime() - start.getTime()) / 60000);
  if (minutes <= 0) return "";
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours === 0) return `${mins}m`;
  if (mins === 0) return `${hours}h`;
  return `${hours}h ${mins}m`;
}

/** Interpret a plain YYYY-MM-DD as noon in `timezone`, avoiding DST edges. */
export function isoDateToDate(isoDate: string, timezone: string): Date {
  return DateTime.fromISO(isoDate, { zone: timezone })
    .set({ hour: 12 })
    .toJSDate();
}
