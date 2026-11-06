import { requireUser } from "@/server/auth";
import { listPriceReview } from "@/modules/catalog";
import { HomeAlerts, getAlertCounts } from "@/modules/inventory";

export default async function HomePage() {
  const user = await requireUser();
  const isOwner = user.role === "DUENO";
  const [counts, review] = await Promise.all([getAlertCounts(), isOwner ? listPriceReview() : null]);
  return (
    <section className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold">Hola, {user.name}</h1>
      <HomeAlerts {...counts} priceReview={review ? review.length : null} />
    </section>
  );
}
