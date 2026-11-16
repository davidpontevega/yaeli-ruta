import { notFound } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/server/auth";
import { BackLink } from "@/components/ui/back-link";
import { getProductWithPackagings } from "@/modules/catalog";
import { MovementList, listMovements } from "@/modules/inventory";

export default async function MovementsPage({ params }: PageProps<"/productos/[id]/movimientos">) {
  await requireUser("DUENO");
  const id = z.uuid().safeParse((await params).id);
  if (!id.success) notFound();
  const [product, movements] = await Promise.all([getProductWithPackagings(id.data), listMovements(id.data)]);
  if (!product) notFound();

  return (
    <section className="flex flex-col gap-4">
      <BackLink href="/productos" label="Productos" />
      <div>
        <h1 className="text-[22px] font-bold tracking-tight md:text-[26px]">Movimientos</h1>
        <p className="text-muted">
          {product.name} · {product.sku}
        </p>
      </div>
      <MovementList movements={movements} packagings={product.packagings} />
    </section>
  );
}
