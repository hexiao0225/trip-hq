type SegmentKind =
  | "flight"
  | "train"
  | "hotel"
  | "car"
  | "ferry"
  | "activity"
  | "pet"
  | "note";

export interface KindMeta {
  id: SegmentKind;
  label: string;
  icon: string;
  /** Does this kind span a range (hotel, car hire) or a moment (flight)? */
  ranged: boolean;
  /** Labels for the from/to fields, or null when the kind has no route. */
  fromLabel: string | null;
  toLabel: string | null;
  /** Tint for the small type chip. */
  chipClass: string;
  /**
   * Tint for the whole card. Kept at the 50/200 end of each ramp so a screen
   * full of segments reads as one surface with categories, rather than as a
   * pile of coloured boxes — the icon and chip do the identifying, the card
   * tint just groups at a glance while scrolling on a phone.
   */
  tintClass: string;
}

export const KINDS: KindMeta[] = [
  {
    id: "flight",
    label: "Flight",
    icon: "✈️",
    ranged: false,
    fromLabel: "From (airport)",
    toLabel: "To (airport)",
    chipClass: "bg-sky-100 text-sky-900",
    tintClass: "border-sky-200 bg-sky-50",
  },
  {
    id: "train",
    label: "Train",
    icon: "🚆",
    ranged: false,
    fromLabel: "From (station)",
    toLabel: "To (station)",
    chipClass: "bg-emerald-100 text-emerald-900",
    tintClass: "border-emerald-200 bg-emerald-50",
  },
  {
    id: "hotel",
    label: "Stay",
    icon: "🏠",
    ranged: true,
    fromLabel: null,
    toLabel: null,
    chipClass: "bg-violet-100 text-violet-900",
    tintClass: "border-violet-200 bg-violet-50",
  },
  {
    id: "car",
    label: "Car hire",
    icon: "🚗",
    ranged: true,
    fromLabel: "Pick-up",
    toLabel: "Drop-off",
    chipClass: "bg-amber-100 text-amber-900",
    tintClass: "border-amber-200 bg-amber-50",
  },
  {
    id: "ferry",
    label: "Ferry",
    icon: "⛴️",
    ranged: false,
    fromLabel: "From (port)",
    toLabel: "To (port)",
    chipClass: "bg-cyan-100 text-cyan-900",
    tintClass: "border-cyan-200 bg-cyan-50",
  },
  {
    id: "activity",
    label: "Activity",
    icon: "📍",
    ranged: true,
    fromLabel: null,
    toLabel: null,
    chipClass: "bg-pink-100 text-pink-900",
    tintClass: "border-pink-200 bg-pink-50",
  },
  {
    id: "pet",
    label: "Pet stay",
    icon: "🐕",
    ranged: true,
    fromLabel: null,
    toLabel: null,
    chipClass: "bg-teal-100 text-teal-900",
    tintClass: "border-teal-200 bg-teal-50",
  },
  {
    id: "note",
    label: "Note",
    icon: "📝",
    ranged: false,
    fromLabel: null,
    toLabel: null,
    chipClass: "bg-slate-100 text-slate-900",
    tintClass: "border-edge bg-surface",
  },
];

const FALLBACK_KIND: KindMeta = KINDS[KINDS.length - 1];

export function kindMeta(kind: string): KindMeta {
  return KINDS.find((k) => k.id === kind) ?? FALLBACK_KIND;
}

export const KIND_IDS: string[] = KINDS.map((k) => k.id);

export const SEGMENT_STATUSES = ["confirmed", "pending", "cancelled"] as const;
