import { requireUser } from "@/server/auth";
import { BackLink } from "@/components/ui/back-link";
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
      <BackLink href="/stock" label="Stock" />
      <h1 className="text-[22px] font-bold tracking-tight md:text-[26px]">Vencimientos</h1>
      <LocationFilter locations={locations} value={valid} />
      <ExpiryList lots={lots} />
    </section>
  );
}
