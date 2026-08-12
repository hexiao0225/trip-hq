/**
 * Trip configuration.
 *
 * This is the one file to edit as plans firm up: who's involved, the legs of
 * the trip, and their date ranges. Everything else in the app derives from it.
 */

export type TravelerId = "xiao" | "hanyang";
export type PetId = "zero" | "totoro";

/** Anyone a segment can belong to — people and dogs alike. */
export type WhoId = TravelerId | PetId;

export interface Companion {
  id: WhoId;
  name: string;
  /** Single letter used in compact badges. */
  initial: string;
  /** Tailwind classes for this companion's badge. */
  badgeClass: string;
}

export const TRAVELERS: Companion[] = [
  {
    id: "xiao",
    name: "Xiao",
    initial: "X",
    badgeClass: "bg-rose-100 text-rose-800",
  },
  {
    id: "hanyang",
    name: "Hanyang",
    initial: "H",
    badgeClass: "bg-sky-100 text-sky-800",
  },
];

/**
 * The dogs. They don't travel, but they need their own schedule — boarding,
 * sitter visits, vet appointments — running alongside the trip.
 */
export const PETS: Companion[] = [
  {
    id: "zero",
    name: "Zero",
    initial: "Z",
    badgeClass: "bg-teal-100 text-teal-800",
  },
  {
    id: "totoro",
    name: "Totoro",
    initial: "T",
    badgeClass: "bg-lime-100 text-lime-800",
  },
];

export const EVERYONE: Companion[] = [...TRAVELERS, ...PETS];

export const TRAVELER_IDS: string[] = TRAVELERS.map((t) => t.id);
export const PET_IDS: string[] = PETS.map((p) => p.id);
export const EVERYONE_IDS: string[] = EVERYONE.map((c) => c.id);

export function companionById(id: string): Companion | undefined {
  return EVERYONE.find((c) => c.id === id);
}

export function isPet(id: string): boolean {
  return PET_IDS.includes(id);
}

/**
 * The dogs share one filter tab. They stay individually assignable — a vet
 * visit is often for one of them — but nobody wants to check two tabs to see
 * what's happening at home.
 */
export const PETS_FILTER_ID = "pets";

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
  /** Who is on this leg. */
  travelers: WhoId[];
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
    travelers: ["xiao", "hanyang"],
    accentClass: "border-l-indigo-400",
  },
  {
    id: "scotland",
    label: "Scotland",
    place: "Scotland, UK",
    timezone: "Europe/London",
    start: null,
    end: null,
    travelers: ["xiao", "hanyang"],
    accentClass: "border-l-emerald-400",
  },
  {
    id: "residency",
    label: "Residency",
    place: "Dumfries House, Ayrshire",
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
    travelers: ["hanyang"],
    accentClass: "border-l-fuchsia-400",
  },
  {
    id: "home",
    label: "Home",
    place: "San Mateo, CA",
    timezone: "America/Los_Angeles",
    start: null,
    end: null,
    travelers: ["xiao", "hanyang"],
    accentClass: "border-l-slate-400",
  },
  {
    id: "unscheduled",
    label: "Unscheduled",
    place: "No date set",
    timezone: "America/Los_Angeles",
    start: null,
    end: null,
    travelers: ["xiao", "hanyang"],
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
  who: WhoId[];
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

/**
 * The sign-in prompt. Only the question lives here — the answer stays in the
 * APP_PASSCODE environment variable so it is never committed to the repo.
 */
export const SECURITY_QUESTION = "What is our first dog's name (in number)?";

/** Timezones offered in the segment form, in the order they appear. */
export const TIMEZONE_OPTIONS = [
  "Europe/London",
  "America/Los_Angeles",
  "Asia/Shanghai",
  "America/New_York",
  "Europe/Paris",
  "UTC",
];
