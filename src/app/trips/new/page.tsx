import { Nav } from "@/components/nav";
import { SetupNotice } from "@/components/setup-notice";
import { EMPTY_TRIP, TripForm } from "@/components/trip-form";
import { HOME_TIMEZONE } from "@/lib/config";
import { getNavData } from "@/lib/nav";

export const dynamic = "force-dynamic";

export default async function NewTripPage() {
  let nav: Awaited<ReturnType<typeof getNavData>>;
  try {
    nav = await getNavData();
  } catch (error) {
    return <SetupNotice error={error} />;
  }

  return (
    <>
      <Nav trip={null} trips={nav.trips} pendingCount={0} />

      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-6">
        <h1 className="text-xl font-semibold tracking-tight">New trip</h1>
        <p className="mt-1 mb-6 text-sm text-muted">
          Just the outline for now. Legs and milestones come next, on the
          trip&apos;s own settings page.
        </p>

        <TripForm initial={EMPTY_TRIP} defaultTimezone={HOME_TIMEZONE} />
      </main>
    </>
  );
}
