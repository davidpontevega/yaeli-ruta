import Link from "next/link";
import { requireUser } from "@/server/auth";
import { listPriceReview } from "@/modules/catalog";
import { HomeAlerts, getAlertCounts } from "@/modules/inventory";
import { totalReceivable } from "@/modules/accounts";

export default async function HomePage() {
  const user = await requireUser();
  const isOwner = user.role === "DUENO";
  const [counts, review, receivable] = await Promise.all([getAlertCounts(), isOwner ? listPriceReview() : null, isOwner ? totalReceivable() : null]);
  return (
    <section className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold">Hola, {user.name}</h1>
      {isOwner && (
        <div className="grid grid-cols-2 gap-2">
          <Link href="/pedidos/nuevo" className="btn-primario flex h-14 items-center justify-center text-center">
            Nuevo pedido
          </Link>
          <Link href="/compras/nueva" className="btn-secundario flex h-14 items-center justify-center text-center">
            Nueva compra
          </Link>
        </div>
      )}
      <HomeAlerts {...counts} priceReview={review ? review.length : null} receivable={receivable} />
    </section>
  );
}
