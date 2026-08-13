"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";

import { deleteSegment, saveSegment, type FormState } from "@/app/actions";
import {
  PETS,
  SELECTABLE_LEGS,
  TIMEZONE_OPTIONS,
  TRAVELERS,
} from "@/lib/config";
import { KINDS, SEGMENT_STATUSES, kindMeta } from "@/lib/kinds";

export interface SegmentFormValues {
  id: string;
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
  leg: string;
  status: string;
  costAmount: string;
  costCurrency: string;
  notes: string;
  link: string;
}

export const EMPTY_SEGMENT: SegmentFormValues = {
  id: "",
  kind: "flight",
  title: "",
  vendor: "",
  confirmation: "",
  startLocal: "",
  startTz: "Europe/London",
  endLocal: "",
  endTz: "",
  fromLabel: "",
  toLabel: "",
  fromCity: "",
  toCity: "",
  address: "",
  travelers: TRAVELERS.map((t) => t.id),
  leg: "",
  status: "confirmed",
  costAmount: "",
  costCurrency: "GBP",
  notes: "",
  link: "",
};

function SaveButton({ isEdit }: { isEdit: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-primary" disabled={pending}>
      {pending ? "Saving…" : isEdit ? "Save changes" : "Add to trip"}
    </button>
  );
}

export function SegmentForm({ initial }: { initial: SegmentFormValues }) {
  const [state, formAction] = useActionState<FormState, FormData>(
    saveSegment,
    {},
  );
  const [kind, setKind] = useState(initial.kind);
  const meta = kindMeta(kind);
  const isEdit = Boolean(initial.id);

  return (
    <div className="space-y-6">
      <form action={formAction} className="space-y-5">
        {isEdit && <input type="hidden" name="id" value={initial.id} />}

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
              {TIMEZONE_OPTIONS.map((tz) => (
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
              {TIMEZONE_OPTIONS.map((tz) => (
                <option key={tz} value={tz}>
                  {tz}
                </option>
              ))}
            </select>
          </div>
        </div>

        {(meta.id === "hotel" ||
          meta.id === "activity" ||
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
            <label className="label" htmlFor="leg">
              Leg
            </label>
            <select
              id="leg"
              name="leg"
              defaultValue={initial.leg}
              className="field"
            >
              <option value="">Work it out from the date</option>
              {SELECTABLE_LEGS.map((leg) => (
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
          <Link href="/" className="btn-secondary">
            Cancel
          </Link>
        </div>
      </form>

      {isEdit && (
        <form action={deleteSegment} className="border-t border-edge pt-5">
          <input type="hidden" name="id" value={initial.id} />
          <button type="submit" className="btn-danger">
            Delete this segment
          </button>
        </form>
      )}
    </div>
  );
}
