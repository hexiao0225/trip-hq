/**
 * Trip configuration.
 *
 * This is the one file to edit as plans firm up: traveler names, the legs of
 * the trip, and their date ranges. Everything else in the app derives from it.
 */

export type TravelerId = "xiao" | "husband";

export interface Traveler {
  id: TravelerId;
  name: string;
  /** Single letter used in compact badges. */
  initial: string;
  /** Tailwind classes for this traveler's badge. */
  badgeClass: string;
}

export const TRAVELERS: Traveler[] = [
  {
    id: "xiao",
    name: "Xiao",
    initial: "X",
    badgeClass: "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-200",
  },
  {
    id: "husband",
    name: "Husband",
    initial: "H",
    badgeClass: "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-200",
  },
];

export const TRAVELER_IDS: string[] = TRAVELERS.map((t) => t.id);

export function travelerById(id: string): Traveler | undefined {
  return TRAVELERS.find((t) => t.id === id);
}

export type LegId =
  | "london"
  | "scotland"
  | "residency"
  | "beijing"
  | "home"
  | "unscheduled";

export interface Leg {
  id: LegId;
  label: string;
  /** Where this leg happens, shown under the label. */
  place: string;
  /** IANA timezone used as the default when adding segments in this leg. */
  timezone: string;
  /** Inclusive start date, YYYY-MM-DD. Null means "not decided yet". */
  start: string | null;
  /** Inclusive end date, YYYY-MM-DD. Null means "not decided yet". */
  end: string | null;
  /** Which travelers are on this leg. */
  travelers: TravelerId[];
  accentClass: string;
}

/**
 * The shape of the trip. Dates marked null are still TBD — fill them in here
 * and the timeline will group and label segments automatically.
 */
export const LEGS: Leg[] = [
  {
    id: "london",
    label: "London",
    place: "London, UK",
    timezone: "Europe/London",
    start: null,
    end: null,
    travelers: ["xiao", "husband"],
    accentClass: "border-l-indigo-400",
  },
  {
    id: "scotland",
    label: "Scotland",
    place: "Scotland, UK",
    timezone: "Europe/London",
    start: null,
    end: null,
    travelers: ["xiao", "husband"],
    accentClass: "border-l-emerald-400",
  },
  {
    id: "residency",
    label: "Residency",
    place: "Artist residency",
    timezone: "Europe/London",
    start: null,
    end: "2026-09-24",
    travelers: ["xiao"],
    accentClass: "border-l-amber-400",
  },
  {
    id: "beijing",
    label: "Beijing",
    place: "Beijing, China",
    timezone: "Asia/Shanghai",
    start: null,
    end: null,
    travelers: ["husband"],
    accentClass: "border-l-fuchsia-400",
  },
  {
    id: "home",
    label: "Home",
    place: "San Mateo, CA",
    timezone: "America/Los_Angeles",
    start: null,
    end: null,
    travelers: ["xiao", "husband"],
    accentClass: "border-l-slate-400",
  },
  {
    id: "unscheduled",
    label: "Unscheduled",
    place: "No date set",
    timezone: "America/Los_Angeles",
    start: null,
    end: null,
    travelers: ["xiao", "husband"],
    accentClass: "border-l-slate-300",
  },
];

export function legById(id: string | null | undefined): Leg | undefined {
  if (!id) return undefined;
  return LEGS.find((l) => l.id === id);
}

/** Legs shown as choices in the segment form (everything but the catch-all). */
export const SELECTABLE_LEGS = LEGS.filter((l) => l.id !== "unscheduled");

/**
 * Milestones surfaced on the dashboard. These are the fixed points the rest of
 * the trip is planned around.
 */
export interface Milestone {
  label: string;
  /** YYYY-MM-DD, interpreted in `timezone`. */
  date: string;
  timezone: string;
  who: TravelerId[];
}

export const MILESTONES: Milestone[] = [
  {
    label: "Residency ends",
    date: "2026-09-24",
    timezone: "Europe/London",
    who: ["xiao"],
  },
  {
    label: "Fly home to San Mateo",
    date: "2026-09-25",
    timezone: "Europe/London",
    who: ["xiao"],
  },
];

/** Timezones offered in the segment form, in the order they appear. */
export const TIMEZONE_OPTIONS = [
  "Europe/London",
  "America/Los_Angeles",
  "Asia/Shanghai",
  "America/New_York",
  "Europe/Paris",
  "UTC",
];
