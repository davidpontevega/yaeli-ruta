import Link from "next/link";
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
      {isOwner && (
        <div className="grid grid-cols-2 gap-2">
          <Link href="/pedidos/nuevo" className="btn-primario flex h-14 items-center justify-center text-center">
            Nuevo pedido
          </Link>
          <Link href="/recepciones/nueva" className="btn-secundario flex h-14 items-center justify-center text-center">
            Recibir mercadería
          </Link>
        </div>
      )}
      <HomeAlerts {...counts} priceReview={review ? review.length : null} />
    </section>
  );
}
