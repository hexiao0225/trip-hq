"use client";

import Link from "next/link";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import {
  createTrip,
  updateTrip,
  type FormState,
} from "@/app/trip-actions";
import { ACCENTS } from "@/lib/accents";
import { TRAVELERS, timezoneOptions } from "@/lib/config";

export interface TripFormValues {
  id: string;
  slug: string;
  name: string;
  destination: string;
  emoji: string;
  startDate: string;
  endDate: string;
  timezone: string;
  currency: string;
  travelers: string[];
  accent: string;
  notes: string;
}

export const EMPTY_TRIP: TripFormValues = {
  id: "",
  slug: "",
  name: "",
  destination: "",
  emoji: "",
  startDate: "",
  endDate: "",
  timezone: "",
  currency: "",
  travelers: TRAVELERS.map((t) => t.id),
  accent: "indigo",
  notes: "",
};

function SaveButton({ isEdit }: { isEdit: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-primary" disabled={pending}>
      {pending ? "Saving…" : isEdit ? "Save changes" : "Create trip"}
    </button>
  );
}

export function TripForm({
  initial,
  defaultTimezone,
}: {
  initial: TripFormValues;
  /** Where home is, offered as the trip's zone when nothing is chosen yet. */
  defaultTimezone: string;
}) {
  const isEdit = Boolean(initial.id);
  const [state, formAction] = useActionState<FormState, FormData>(
    isEdit ? updateTrip : createTrip,
    {},
  );

  const zones = timezoneOptions(initial.timezone, defaultTimezone);

  return (
    <form action={formAction} className="space-y-5">
      {isEdit && <input type="hidden" name="id" value={initial.id} />}

      <div className="grid gap-3 sm:grid-cols-[5rem_1fr]">
        <div>
          <label className="label" htmlFor="emoji">
            Mark
          </label>
          <input
            id="emoji"
            name="emoji"
            defaultValue={initial.emoji}
            placeholder="🇸🇬"
            // One emoji, shown wherever the trip is named. Not a required
            // field — the switcher falls back to a compass.
            className="field text-center"
          />
        </div>
        <div>
          <label className="label" htmlFor="name">
            Name
          </label>
          <input
            id="name"
            name="name"
            defaultValue={initial.name}
            placeholder="Singapore"
            className="field"
            required
          />
        </div>
      </div>

      <div>
        <label className="label" htmlFor="destination">
          Where
        </label>
        <input
          id="destination"
          name="destination"
          defaultValue={initial.destination}
          placeholder="Singapore, with a weekend in Johor"
          className="field"
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="startDate">
            Starts
          </label>
          <input
            id="startDate"
            name="startDate"
            type="date"
            defaultValue={initial.startDate}
            className="field"
          />
        </div>
        <div>
          <label className="label" htmlFor="endDate">
            Ends
          </label>
          <input
            id="endDate"
            name="endDate"
            type="date"
            defaultValue={initial.endDate}
            className="field"
          />
        </div>
      </div>
      <p className="-mt-3 text-xs text-muted">
        Dates are what let a forwarded booking find its own way to this trip.
        Leave them blank while it&apos;s only an idea.
      </p>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="timezone">
            Main timezone
          </label>
          <select
            id="timezone"
            name="timezone"
            defaultValue={initial.timezone || defaultTimezone}
            className="field"
          >
            {zones.map((tz) => (
              <option key={tz} value={tz}>
                {tz}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="currency">
            Currency
          </label>
          <input
            id="currency"
            name="currency"
            defaultValue={initial.currency}
            placeholder="SGD"
            className="field"
          />
        </div>
      </div>

      <div>
        <span className="label">Who&apos;s going</span>
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
        </div>
      </div>

      <div>
        <span className="label">Colour</span>
        <div className="flex flex-wrap gap-2">
          {ACCENTS.map((option) => (
            <label
              key={option.id}
              className="cursor-pointer"
              title={option.label}
            >
              <input
                type="radio"
                name="accent"
                value={option.id}
                defaultChecked={initial.accent === option.id}
                className="peer sr-only"
              />
              <span
                className={`flex h-9 w-9 items-center justify-center rounded-lg border border-edge transition peer-checked:border-stone-900 peer-checked:ring-2 peer-checked:ring-stone-900/20`}
              >
                <span
                  aria-hidden
                  className={`h-4 w-4 rounded-full ${option.dotClass}`}
                />
                <span className="sr-only">{option.label}</span>
              </span>
            </label>
          ))}
        </div>
      </div>

      {isEdit && (
        <div>
          <label className="label" htmlFor="slug">
            Address
          </label>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted">/t/</span>
            <input
              id="slug"
              name="slug"
              defaultValue={initial.slug}
              className="field"
            />
          </div>
          <p className="mt-1 text-xs text-muted">
            Changing this changes the trip&apos;s links. Renaming the trip
            leaves it alone.
          </p>
        </div>
      )}

      <div>
        <label className="label" htmlFor="notes">
          Notes
        </label>
        <textarea
          id="notes"
          name="notes"
          rows={2}
          defaultValue={initial.notes}
          className="field"
        />
      </div>

      {state.error && <p className="text-sm text-red-600">{state.error}</p>}

      <div className="flex items-center gap-2">
        <SaveButton isEdit={isEdit} />
        <Link href={isEdit ? `/t/${initial.slug}` : "/trips"} className="btn-secondary">
          Cancel
        </Link>
      </div>
    </form>
  );
}
