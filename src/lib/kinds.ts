export type SegmentKind =
  | "flight"
  | "train"
  | "hotel"
  | "car"
  | "ferry"
  | "activity"
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
  chipClass: string;
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
  },
  {
    id: "train",
    label: "Train",
    icon: "🚆",
    ranged: false,
    fromLabel: "From (station)",
    toLabel: "To (station)",
    chipClass: "bg-emerald-100 text-emerald-900",
  },
  {
    id: "hotel",
    label: "Stay",
    icon: "🏨",
    ranged: true,
    fromLabel: null,
    toLabel: null,
    chipClass: "bg-violet-100 text-violet-900",
  },
  {
    id: "car",
    label: "Car hire",
    icon: "🚗",
    ranged: true,
    fromLabel: "Pick-up",
    toLabel: "Drop-off",
    chipClass: "bg-amber-100 text-amber-900",
  },
  {
    id: "ferry",
    label: "Ferry",
    icon: "⛴️",
    ranged: false,
    fromLabel: "From (port)",
    toLabel: "To (port)",
    chipClass: "bg-cyan-100 text-cyan-900",
  },
  {
    id: "activity",
    label: "Activity",
    icon: "📍",
    ranged: true,
    fromLabel: null,
    toLabel: null,
    chipClass: "bg-pink-100 text-pink-900",
  },
  {
    id: "note",
    label: "Note",
    icon: "📝",
    ranged: false,
    fromLabel: null,
    toLabel: null,
    chipClass: "bg-slate-100 text-slate-900",
  },
];

const FALLBACK_KIND: KindMeta = KINDS[KINDS.length - 1];

export function kindMeta(kind: string): KindMeta {
  return KINDS.find((k) => k.id === kind) ?? FALLBACK_KIND;
}

export const KIND_IDS: string[] = KINDS.map((k) => k.id);

export const SEGMENT_STATUSES = ["confirmed", "pending", "cancelled"] as const;
export type SegmentStatus = (typeof SEGMENT_STATUSES)[number];
