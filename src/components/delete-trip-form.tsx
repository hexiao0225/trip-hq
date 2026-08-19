"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";

import { deleteTrip, type FormState } from "@/app/trip-actions";

function DeleteButton({ name }: { name: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-danger" disabled={pending}>
      {pending ? "Deleting…" : `Delete ${name} and everything on it`}
    </button>
  );
}

/**
 * Deleting a trip takes its bookings with it, and there is no undo, so the
 * form stays folded away until asked for and then wants the name typed out.
 */
export function DeleteTripForm({
  tripId,
  tripName,
}: {
  tripId: string;
  tripName: string;
}) {
  const [state, formAction] = useActionState<FormState, FormData>(
    deleteTrip,
    {},
  );
  const [armed, setArmed] = useState(false);

  if (!armed) {
    return (
      <button
        type="button"
        onClick={() => setArmed(true)}
        className="btn-secondary"
      >
        Delete this trip…
      </button>
    );
  }

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="id" value={tripId} />

      <p className="text-sm">
        This removes the trip, its legs, its milestones and every booking on
        it. Archiving hides a finished trip instead, and keeps all of that.
      </p>

      <div>
        <label className="label" htmlFor="confirmName">
          Type <strong>{tripName}</strong> to confirm
        </label>
        <input
          id="confirmName"
          name="confirmName"
          className="field"
          autoComplete="off"
          required
        />
      </div>

      {state.error && <p className="text-sm text-red-600">{state.error}</p>}

      <div className="flex items-center gap-2">
        <DeleteButton name={tripName} />
        <button
          type="button"
          onClick={() => setArmed(false)}
          className="btn-secondary"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
