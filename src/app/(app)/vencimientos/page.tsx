import { requireUser } from "@/server/auth";
import { ExpiryList, LocationFilter, listExpiring, listLocations } from "@/modules/inventory";

export default async function ExpiryPage({ searchParams }: PageProps<"/vencimientos">) {
  const user = await requireUser();
  const sp = await searchParams;
  const locationId = typeof sp.piso === "string" ? sp.piso : "";
  const locations = await listLocations();
  const valid = locations.some((l) => l.id === locationId) ? locationId : "";
  const lots = await listExpiring({ locationId: valid, withCost: user.role === "DUENO" });

  return (
    <section className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold">Vencimientos</h1>
      <LocationFilter locations={locations} value={valid} />
      <ExpiryList lots={lots} />
    </section>
  );
}
