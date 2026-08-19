/**
 * The colours a trip or a leg can be tinted with.
 *
 * Trips and legs are rows now, so their colour is picked in a form and stored
 * as a key rather than written as a class name. Tailwind only ships classes it
 * can see in the source, so every variant has to be spelled out here — a
 * template like `border-l-${accent}-400` would compile to nothing.
 */

export interface Accent {
  id: string;
  label: string;
  /** Left border on a leg heading or a trip card. */
  borderClass: string;
  /** Filled dot in the trip switcher. */
  dotClass: string;
  /** Soft chip behind a trip's name. */
  chipClass: string;
}

export const ACCENTS: Accent[] = [
  {
    id: "indigo",
    label: "Indigo",
    borderClass: "border-l-indigo-400",
    dotClass: "bg-indigo-400",
    chipClass: "bg-indigo-100 text-indigo-900",
  },
  {
    id: "emerald",
    label: "Emerald",
    borderClass: "border-l-emerald-400",
    dotClass: "bg-emerald-400",
    chipClass: "bg-emerald-100 text-emerald-900",
  },
  {
    id: "amber",
    label: "Amber",
    borderClass: "border-l-amber-400",
    dotClass: "bg-amber-400",
    chipClass: "bg-amber-100 text-amber-900",
  },
  {
    id: "fuchsia",
    label: "Fuchsia",
    borderClass: "border-l-fuchsia-400",
    dotClass: "bg-fuchsia-400",
    chipClass: "bg-fuchsia-100 text-fuchsia-900",
  },
  {
    id: "sky",
    label: "Sky",
    borderClass: "border-l-sky-400",
    dotClass: "bg-sky-400",
    chipClass: "bg-sky-100 text-sky-900",
  },
  {
    id: "rose",
    label: "Rose",
    borderClass: "border-l-rose-400",
    dotClass: "bg-rose-400",
    chipClass: "bg-rose-100 text-rose-900",
  },
  {
    id: "teal",
    label: "Teal",
    borderClass: "border-l-teal-400",
    dotClass: "bg-teal-400",
    chipClass: "bg-teal-100 text-teal-900",
  },
  {
    id: "stone",
    label: "Stone",
    borderClass: "border-l-stone-400",
    dotClass: "bg-stone-400",
    chipClass: "bg-stone-100 text-stone-900",
  },
];

const FALLBACK_ACCENT = ACCENTS[ACCENTS.length - 1];

export function accent(id: string | null | undefined): Accent {
  return ACCENTS.find((a) => a.id === id) ?? FALLBACK_ACCENT;
}

export const ACCENT_IDS: string[] = ACCENTS.map((a) => a.id);

/**
 * A colour for a trip that doesn't have one yet, spread around the palette so
 * two trips created in a row don't look alike.
 */
export function nextAccent(taken: string[]): string {
  return ACCENTS.find((a) => !taken.includes(a.id))?.id ?? FALLBACK_ACCENT.id;
}
