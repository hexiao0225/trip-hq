"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import {
  deleteMilestone,
  saveMilestone,
  type FormState,
} from "@/app/trip-actions";
import { PETS, TRAVELERS, timezoneOptions } from "@/lib/config";

export interface MilestoneValues {
  id: string;
  label: string;
  date: string;
  timezone: string;
  who: string[];
}

function SaveButton({ isNew }: { isNew: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      className="btn-primary min-h-10 px-3 text-xs"
      disabled={pending}
    >
      {pending ? "Saving…" : isNew ? "Add milestone" : "Save"}
    </button>
  );
}

/** One countdown card, edited in place. Null renders the blank "add" row. */
export function MilestoneEditor({
  tripId,
  tripSlug,
  tripTimezone,
  initial,
}: {
  tripId: string;
  tripSlug: string;
  tripTimezone: string;
  initial: MilestoneValues | null;
}) {
  const isNew = initial === null;
  const [state, formAction] = useActionState<FormState, FormData>(
    saveMilestone,
    {},
  );

  const values: MilestoneValues = initial ?? {
    id: "",
    label: "",
    date: "",
    timezone: tripTimezone,
    who: [],
  };

  const zones = timezoneOptions(values.timezone, tripTimezone);

  return (
    <form
      action={formAction}
      className="space-y-3 rounded-xl border border-edge bg-surface p-4"
    >
      <input type="hidden" name="tripId" value={tripId} />
      <input type="hidden" name="tripSlug" value={tripSlug} />
      {!isNew && <input type="hidden" name="id" value={values.id} />}

      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <label className="label" htmlFor={`ms-label-${values.id}`}>
            Milestone
          </label>
          <input
            id={`ms-label-${values.id}`}
            name="label"
            defaultValue={values.label}
            placeholder="Fly home"
            className="field"
            required
          />
        </div>
        <div>
          <label className="label" htmlFor={`ms-date-${values.id}`}>
            Date
          </label>
          <input
            id={`ms-date-${values.id}`}
            name="date"
            type="date"
            defaultValue={values.date}
            className="field"
            required
          />
        </div>
        <div>
          <label className="label" htmlFor={`ms-tz-${values.id}`}>
            Timezone
          </label>
          <select
            id={`ms-tz-${values.id}`}
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
        <span className="label">Who it&apos;s for</span>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          {[...TRAVELERS, ...PETS].map((companion) => (
            <label
              key={companion.id}
              className="flex cursor-pointer items-center gap-2 text-sm"
            >
              <input
                type="checkbox"
                name="who"
                value={companion.id}
                defaultChecked={values.who.includes(companion.id)}
                className="h-4 w-4 rounded border-edge"
              />
              {companion.name}
            </label>
          ))}
        </div>
      </div>

      {state.error && <p className="text-sm text-red-600">{state.error}</p>}

      <div className="flex items-center gap-2">
        <SaveButton isNew={isNew} />
        {!isNew && (
          <button
            type="submit"
            formAction={deleteMilestone}
            formNoValidate
            className="btn-danger ml-auto min-h-10 px-3 text-xs"
          >
            Delete
          </button>
        )}
      </div>
    </form>
  );
}
