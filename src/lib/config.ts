/**
 * Household configuration.
 *
 * Who can appear on a trip, and the handful of settings that aren't worth a
 * database row. Trips themselves — their legs, dates and milestones — used to
 * live here too; they are rows now, edited at /t/<trip>/settings, so that
 * adding a destination doesn't mean editing code.
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
 * sitter visits, vet appointments — running alongside whichever trip is on.
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

/** Just the people, for choosing who is going on a trip. */
export const TRAVELER_IDS: string[] = TRAVELERS.map((t) => t.id);

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

/** Where the household lives, used as the default zone for a new trip. */
export const HOME_TIMEZONE = "America/Los_Angeles";

/**
 * The sign-in prompt.
 *
 * The answer lives in the APP_PASSCODE environment variable, never here. Keep
 * the question generic too: this file is public, and a question that names a
 * specific fact about you narrows the guess space for anyone who finds the
 * app, however good the answer itself is.
 */
export const SECURITY_QUESTION = "What's the passphrase?";

/**
 * Timezones always offered in the segment form. A trip's own zones — its home
 * zone and one per leg — are added to this at render time, so a Singapore trip
 * offers Asia/Singapore without anyone editing this list.
 */
export const BASE_TIMEZONES = [
  "America/Los_Angeles",
  "America/New_York",
  "Europe/London",
  "Europe/Paris",
  "Asia/Singapore",
  "Asia/Shanghai",
  "Asia/Tokyo",
  "Australia/Sydney",
  "UTC",
];

/**
 * Timezones offered for one trip: the base list, plus anything the trip or its
 * legs actually use, so a zone in use is never missing from the dropdown.
 */
export function timezoneOptions(...extra: (string | null | undefined)[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const tz of [...extra, ...BASE_TIMEZONES]) {
    const value = tz?.trim();
    if (!value || seen.has(value)) continue;
    seen.add(value);
    out.push(value);
  }
  return out;
}
