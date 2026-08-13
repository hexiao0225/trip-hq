"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { login, type FormState } from "@/app/actions";
import { SECURITY_QUESTION } from "@/lib/config";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-primary w-full" disabled={pending}>
      {pending ? "Checking…" : "Enter"}
    </button>
  );
}

export function LoginForm({ next }: { next: string }) {
  const [state, formAction] = useActionState<FormState, FormData>(login, {});

  return (
    <form action={formAction} className="mt-8 space-y-3">
      <input type="hidden" name="next" value={next} />

      <div>
        <label className="label" htmlFor="passcode">
          {SECURITY_QUESTION}
        </label>
        <input
          id="passcode"
          name="passcode"
          type="password"
          autoComplete="current-password"
          autoFocus
          className="field"
        />
      </div>

      {state.error && (
        <p className="text-sm text-red-600">{state.error}</p>
      )}

      <SubmitButton />
    </form>
  );
}
