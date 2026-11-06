import { requireUser } from "@/server/auth";
import { HomeAlerts, getAlertCounts } from "@/modules/inventory";

export default async function HomePage() {
  const user = await requireUser();
  const counts = await getAlertCounts();
  return (
    <section className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold">Hola, {user.name}</h1>
      <HomeAlerts {...counts} />
    </section>
  );
}
