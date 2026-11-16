/**
 * Trip configuration.
 *
 * This is the one file to edit as plans firm up: who's involved, the legs of
 * each trip, and their date ranges. Everything else in the app derives from it.
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

const EVERYONE: Companion[] = [...TRAVELERS, ...PETS];
const PET_IDS: string[] = PETS.map((p) => p.id);

/** Every id a segment may be assigned to, for validating form input. */
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

/** A leg id. Ids are unique across every trip, so a leg names its trip too. */
export type LegId = string;

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

export interface Trip {
  /** Used in the URL (?trip=vancouver). */
  id: string;
  name: string;
  /** One line under the name in the trip switcher. */
  summary: string;
  /**
   * First day of this trip's window, YYYY-MM-DD. A booking with no leg set
   * belongs to the latest trip whose window has started by its date, so a new
   * trip only needs a `from` date for forwarded emails to file under it.
   */
  from: string;
  /** Defaults for the Add form. */
  timezone: string;
  currency: string;
  legs: Leg[];
  milestones: Milestone[];
}

/**
 * Every trip, oldest first. The last one is the current trip: it is what the
 * timeline opens on, and where undated bookings with no leg land.
 *
 * To start a new trip, append one here with a `from` date after the previous
 * trip ended. Leg dates marked null are still TBD — fill them in and the
 * timeline will group and label segments automatically.
 */
export const TRIPS: Trip[] = [
  {
    id: "uk-2026",
    name: "UK & Beijing",
    summary: "London, Scotland, the residency, and the way home",
    from: "2026-01-01",
    timezone: "Europe/London",
    currency: "GBP",
    legs: [
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
    ],
    milestones: [
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
    ],
  },
  {
    id: "vancouver",
    name: "Vancouver",
    summary: "Vancouver, BC",
    from: "2026-11-01",
    timezone: "America/Vancouver",
    currency: "CAD",
    legs: [
      {
        id: "vancouver",
        label: "Vancouver",
        place: "Vancouver, BC",
        timezone: "America/Vancouver",
        start: null,
        end: null,
        travelers: ["xiao", "hanyang"],
        accentClass: "border-l-red-400",
      },
    ],
    milestones: [],
  },
];

export const CURRENT_TRIP: Trip = TRIPS[TRIPS.length - 1];

export function tripById(id: string | null | undefined): Trip | undefined {
  if (!id) return undefined;
  return TRIPS.find((t) => t.id === id);
}

/** The trip a leg belongs to. */
export function tripForLeg(legId: string): Trip | undefined {
  return TRIPS.find((t) => t.legs.some((l) => l.id === legId));
}

/** The trip whose window covers a date (YYYY-MM-DD). */
export function tripForDate(iso: string): Trip {
  let match = TRIPS[0];
  for (const trip of TRIPS) {
    if (trip.from <= iso) match = trip;
  }
  return match;
}

/** Every leg of every trip, plus the catch-all for segments that match none. */
export const LEGS: Leg[] = [
  ...TRIPS.flatMap((t) => t.legs),
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

/**
 * The sign-in prompt.
 *
 * The answer lives in the APP_PASSCODE environment variable, never here. Keep
 * the question generic too: this file is public, and a question that names a
 * specific fact about you narrows the guess space for anyone who finds the
 * app, however good the answer itself is.
 */
export const SECURITY_QUESTION = "What is my favorite dog breed?";

/** Timezones offered in the segment form, in the order they appear. */
export const TIMEZONE_OPTIONS = [
  "America/Vancouver",
  "America/Los_Angeles",
  "Europe/London",
  "Asia/Shanghai",
  "America/New_York",
  "Europe/Paris",
  "UTC",
];
