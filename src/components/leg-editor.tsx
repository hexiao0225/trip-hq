"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";

import { deleteLeg, saveLeg, type FormState } from "@/app/trip-actions";
import { ACCENTS } from "@/lib/accents";
import { PETS, TRAVELERS, timezoneOptions } from "@/lib/config";

export interface LegValues {
  id: string;
  label: string;
  place: string;
  timezone: string;
  startDate: string;
  endDate: string;
  travelers: string[];
  accent: string;
  position: number;
}

function SaveButton({ isNew }: { isNew: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      className="btn-primary min-h-10 px-3 text-xs"
      disabled={pending}
    >
      {pending ? "Saving…" : isNew ? "Add leg" : "Save"}
    </button>
  );
}

/**
 * One leg, edited in place.
 *
 * Each row is its own form so a change to Scotland can be saved without
 * touching London — legs get their dates one at a time as plans firm up, and
 * a single save-everything button would make that feel riskier than it is.
 */
export function LegEditor({
  tripId,
  tripSlug,
  tripTimezone,
  initial,
  defaultPosition = 0,
}: {
  tripId: string;
  tripSlug: string;
  tripTimezone: string;
  /** Null renders the blank "add a leg" row. */
  initial: LegValues | null;
  /** Where a newly added leg sorts, so it lands at the end of the list. */
  defaultPosition?: number;
}) {
  const isNew = initial === null;
  const [state, formAction] = useActionState<FormState, FormData>(saveLeg, {});
  const [open, setOpen] = useState(isNew);

  const values: LegValues = initial ?? {
    id: "",
    label: "",
    place: "",
    timezone: tripTimezone,
    startDate: "",
    endDate: "",
    travelers: [],
    accent: "stone",
    position: defaultPosition,
  };

  const zones = timezoneOptions(values.timezone, tripTimezone);

  if (!isNew && !open) {
    return (
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border border-edge bg-surface px-4 py-3">
        <span className="font-medium">{values.label}</span>
        {values.place && (
          <span className="text-sm text-muted">{values.place}</span>
        )}
        <span className="font-mono text-xs text-muted">
          {values.startDate || "—"} → {values.endDate || "—"}
        </span>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="btn-secondary ml-auto min-h-10 px-3 text-xs"
        >
          Edit
        </button>
      </div>
    );
  }

  return (
    <form
      action={formAction}
      className="space-y-3 rounded-xl border border-edge bg-surface p-4"
    >
      <input type="hidden" name="tripId" value={tripId} />
      {!isNew && <input type="hidden" name="id" value={values.id} />}
      <input type="hidden" name="position" value={values.position} />

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor={`label-${values.id}`}>
            Leg
          </label>
          <input
            id={`label-${values.id}`}
            name="label"
            defaultValue={values.label}
            placeholder="Sentosa"
            className="field"
            required
          />
        </div>
        <div>
          <label className="label" htmlFor={`place-${values.id}`}>
            Where
          </label>
          <input
            id={`place-${values.id}`}
            name="place"
            defaultValue={values.place}
            placeholder="Singapore"
            className="field"
          />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <label className="label" htmlFor={`start-${values.id}`}>
            From
          </label>
          <input
            id={`start-${values.id}`}
            name="startDate"
            type="date"
            defaultValue={values.startDate}
            className="field"
          />
        </div>
        <div>
          <label className="label" htmlFor={`end-${values.id}`}>
            To
          </label>
          <input
            id={`end-${values.id}`}
            name="endDate"
            type="date"
            defaultValue={values.endDate}
            className="field"
          />
        </div>
        <div>
          <label className="label" htmlFor={`tz-${values.id}`}>
            Timezone
          </label>
          <select
            id={`tz-${values.id}`}
            name="timezone"
            defaultValue={values.timezone}
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

      <div>
        <span className="label">Who&apos;s on this leg</span>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          {[...TRAVELERS, ...PETS].map((companion) => (
            <label
              key={companion.id}
              className="flex cursor-pointer items-center gap-2 text-sm"
            >
              <input
                type="checkbox"
                name="travelers"
                value={companion.id}
                defaultChecked={values.travelers.includes(companion.id)}
                className="h-4 w-4 rounded border-edge"
              />
              {companion.name}
            </label>
          ))}
        </div>
      </div>

      <div>
        <span className="label">Colour</span>
        <div className="flex flex-wrap gap-2">
          {ACCENTS.map((option) => (
            <label key={option.id} className="cursor-pointer" title={option.label}>
              <input
                type="radio"
                name="accent"
                value={option.id}
                defaultChecked={values.accent === option.id}
                className="peer sr-only"
              />
              <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-edge transition peer-checked:border-stone-900 peer-checked:ring-2 peer-checked:ring-stone-900/20">
                <span
                  aria-hidden
                  className={`h-3.5 w-3.5 rounded-full ${option.dotClass}`}
                />
                <span className="sr-only">{option.label}</span>
              </span>
            </label>
          ))}
        </div>
      </div>

      {state.error && <p className="text-sm text-red-600">{state.error}</p>}

      <div className="flex flex-wrap items-center gap-2">
        <SaveButton isNew={isNew} />

        {!isNew && (
          <>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="btn-secondary min-h-10 px-3 text-xs"
            >
              Done
            </button>

            {/*
              Submits the same form to a different action. `formNoValidate`
              matters: without it the browser blocks the delete on the empty
              required field of a leg you were halfway through clearing.
            */}
            <button
              type="submit"
              formAction={deleteLeg}
              formNoValidate
              className="btn-danger ml-auto min-h-10 px-3 text-xs"
            >
              Delete
            </button>
            <input type="hidden" name="tripSlug" value={tripSlug} />
          </>
        )}
      </div>
    </form>
  );
}
