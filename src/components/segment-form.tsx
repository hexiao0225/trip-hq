"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";

import { deleteSegment, saveSegment, type FormState } from "@/app/actions";
import { PETS, TRAVELERS, timezoneOptions } from "@/lib/config";
import { KINDS, SEGMENT_STATUSES, kindMeta } from "@/lib/kinds";

/** The trip a booking is being added to, and the legs it can be filed under. */
export interface SegmentFormTrip {
  id: string;
  slug: string;
  timezone: string;
  currency: string | null;
  travelers: string[];
  legs: { id: string; label: string; timezone: string }[];
}

export interface SegmentFormValues {
  id: string;
  legId: string;
  kind: string;
  title: string;
  vendor: string;
  confirmation: string;
  startLocal: string;
  startTz: string;
  endLocal: string;
  endTz: string;
  fromLabel: string;
  toLabel: string;
  fromCity: string;
  toCity: string;
  address: string;
  travelers: string[];
  status: string;
  costAmount: string;
  costCurrency: string;
  notes: string;
  link: string;
}

/**
 * A blank booking, pre-filled from the trip it's being added to — its zone,
 * its currency, and whoever is going. Nearly every field on a Singapore
 * booking differs from a London one, and none of it should be typed twice.
 *
 * Not exported: this module is a client component, so a server page calling
 * it directly fails at render. The Add page leaves `initial` off instead.
 */
function emptySegment(trip: SegmentFormTrip): SegmentFormValues {
  return {
    id: "",
    legId: "",
    kind: "flight",
    title: "",
    vendor: "",
    confirmation: "",
    startLocal: "",
    startTz: trip.timezone,
    endLocal: "",
    endTz: "",
    fromLabel: "",
    toLabel: "",
    fromCity: "",
    toCity: "",
    address: "",
    travelers: trip.travelers.length > 0 ? trip.travelers : TRAVELERS.map((t) => t.id),
    status: "confirmed",
    costAmount: "",
    costCurrency: trip.currency ?? "",
    notes: "",
    link: "",
  };
}

function SaveButton({ isEdit }: { isEdit: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-primary" disabled={pending}>
      {pending ? "Saving…" : isEdit ? "Save changes" : "Add to trip"}
    </button>
  );
}

export function SegmentForm({
  initial: given,
  trip,
}: {
  /** Left off when adding, which starts from the trip's own defaults. */
  initial?: SegmentFormValues;
  trip: SegmentFormTrip;
}) {
  const [initial] = useState(() => given ?? emptySegment(trip));
  const [state, formAction] = useActionState<FormState, FormData>(
    saveSegment,
    {},
  );
  const [kind, setKind] = useState(initial.kind);
  const meta = kindMeta(kind);
  const isEdit = Boolean(initial.id);

  // Whatever this trip actually uses comes first in the dropdown, so a
  // Singapore booking doesn't need scrolling past a list of European zones.
  const zones = timezoneOptions(
    initial.startTz,
    initial.endTz,
    trip.timezone,
    ...trip.legs.map((leg) => leg.timezone),
  );

  return (
    <div className="space-y-6">
      <form action={formAction} className="space-y-5">
        {isEdit && <input type="hidden" name="id" value={initial.id} />}
        <input type="hidden" name="tripId" value={trip.id} />

        <div>
          <span className="label">Type</span>
          <div className="flex flex-wrap gap-2">
            {KINDS.map((option) => (
              <label
                key={option.id}
                className={`cursor-pointer rounded-lg border px-3 py-1.5 text-sm transition ${
                  kind === option.id
                    ? "border-stone-900 bg-stone-900 text-white"
                    : "border-edge bg-surface hover:bg-stone-100"
                }`}
              >
                <input
                  type="radio"
                  name="kind"
                  value={option.id}
                  checked={kind === option.id}
                  onChange={() => setKind(option.id)}
                  className="sr-only"
                />
                <span aria-hidden>{option.icon}</span> {option.label}
              </label>
            ))}
          </div>
        </div>

        <div>
          <label className="label" htmlFor="title">
            Title
          </label>
          <input
            id="title"
            name="title"
            defaultValue={initial.title}
            placeholder="BA 286 · SFO → LHR"
            className="field"
            required
          />
        </div>

        {meta.fromLabel && meta.toLabel && (
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="fromLabel">
                {meta.fromLabel}
              </label>
              <input
                id="fromLabel"
                name="fromLabel"
                defaultValue={initial.fromLabel}
                className="field"
              />
            </div>
            <div>
              <label className="label" htmlFor="toLabel">
                {meta.toLabel}
              </label>
              <input
                id="toLabel"
                name="toLabel"
                defaultValue={initial.toLabel}
                className="field"
              />
            </div>
            <div>
              <label className="label" htmlFor="fromCity">
                From city
              </label>
              <input
                id="fromCity"
                name="fromCity"
                defaultValue={initial.fromCity}
                placeholder="San Francisco"
                className="field"
              />
            </div>
            <div>
              <label className="label" htmlFor="toCity">
                To city
              </label>
              <input
                id="toCity"
                name="toCity"
                defaultValue={initial.toCity}
                placeholder="London"
                className="field"
              />
            </div>
          </div>
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="startLocal">
              {meta.id === "hotel" ? "Check-in" : "Starts"} (local time)
            </label>
            <input
              id="startLocal"
              name="startLocal"
              type="datetime-local"
              defaultValue={initial.startLocal}
              className="field"
            />
          </div>
          <div>
            <label className="label" htmlFor="startTz">
              Start timezone
            </label>
            <select
              id="startTz"
              name="startTz"
              defaultValue={initial.startTz}
              className="field"
            >
              {zones.map((tz) => (
                <option key={tz} value={tz}>
                  {tz}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="endLocal">
              {meta.id === "hotel" ? "Check-out" : "Ends"} (local time)
            </label>
            <input
              id="endLocal"
              name="endLocal"
              type="datetime-local"
              defaultValue={initial.endLocal}
              className="field"
            />
          </div>
          <div>
            <label className="label" htmlFor="endTz">
              End timezone
            </label>
            <select
              id="endTz"
              name="endTz"
              defaultValue={initial.endTz}
              className="field"
            >
              <option value="">Same as start</option>
              {zones.map((tz) => (
                <option key={tz} value={tz}>
                  {tz}
                </option>
              ))}
            </select>
          </div>
        </div>

        {(meta.id === "hotel" ||
          meta.id === "activity" ||
          meta.id === "dining" ||
          meta.id === "pet") && (
          <div>
            <label className="label" htmlFor="address">
              Address
            </label>
            <input
              id="address"
              name="address"
              defaultValue={initial.address}
              className="field"
            />
          </div>
        )}

        <div>
          <span className="label">Who&apos;s this for</span>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            {TRAVELERS.map((traveler) => (
              <label
                key={traveler.id}
                className="flex cursor-pointer items-center gap-2 text-sm"
              >
                <input
                  type="checkbox"
                  name="travelers"
                  value={traveler.id}
                  defaultChecked={initial.travelers.includes(traveler.id)}
                  className="h-4 w-4 rounded border-edge"
                />
                {traveler.name}
              </label>
            ))}

            <span aria-hidden className="text-edge">
              |
            </span>

            {PETS.map((pet) => (
              <label
                key={pet.id}
                className="flex cursor-pointer items-center gap-2 text-sm"
              >
                <input
                  type="checkbox"
                  name="travelers"
                  value={pet.id}
                  defaultChecked={initial.travelers.includes(pet.id)}
                  className="h-4 w-4 rounded border-edge"
                />
                🐕 {pet.name}
              </label>
            ))}
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="vendor">
              Provider
            </label>
            <input
              id="vendor"
              name="vendor"
              defaultValue={initial.vendor}
              placeholder="British Airways"
              className="field"
            />
          </div>
          <div>
            <label className="label" htmlFor="confirmation">
              Confirmation
            </label>
            <input
              id="confirmation"
              name="confirmation"
              defaultValue={initial.confirmation}
              placeholder="XY12ZW"
              className="field"
            />
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <label className="label" htmlFor="legId">
              Leg
            </label>
            <select
              id="legId"
              name="legId"
              defaultValue={initial.legId}
              className="field"
              disabled={trip.legs.length === 0}
            >
              <option value="">
                {trip.legs.length === 0
                  ? "No legs on this trip yet"
                  : "Work it out from the date"}
              </option>
              {trip.legs.map((leg) => (
                <option key={leg.id} value={leg.id}>
                  {leg.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="costAmount">
              Cost
            </label>
            <input
              id="costAmount"
              name="costAmount"
              inputMode="decimal"
              defaultValue={initial.costAmount}
              className="field"
            />
          </div>
          <div>
            <label className="label" htmlFor="costCurrency">
              Currency
            </label>
            <input
              id="costCurrency"
              name="costCurrency"
              defaultValue={initial.costCurrency}
              className="field"
            />
          </div>
        </div>

        <div>
          <label className="label" htmlFor="link">
            Link
          </label>
          <input
            id="link"
            name="link"
            type="url"
            defaultValue={initial.link}
            placeholder="https://…"
            className="field"
          />
        </div>

        <div>
          <label className="label" htmlFor="notes">
            Notes
          </label>
          <textarea
            id="notes"
            name="notes"
            rows={3}
            defaultValue={initial.notes}
            className="field"
          />
        </div>

        <div>
          <label className="label" htmlFor="status">
            Status
          </label>
          <select
            id="status"
            name="status"
            defaultValue={initial.status}
            className="field"
          >
            {SEGMENT_STATUSES.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
        </div>

        {state.error && (
          <p className="text-sm text-red-600">{state.error}</p>
        )}

        <div className="flex items-center gap-2">
          <SaveButton isEdit={isEdit} />
          <Link href={`/t/${trip.slug}`} className="btn-secondary">
            Cancel
          </Link>
        </div>
      </form>

      {isEdit && (
        <form action={deleteSegment} className="border-t border-edge pt-5">
          <input type="hidden" name="id" value={initial.id} />
          <input type="hidden" name="tripSlug" value={trip.slug} />
          <button type="submit" className="btn-danger">
            Delete this segment
          </button>
        </form>
      )}
    </div>
  );
}
