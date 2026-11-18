import Link from "next/link";
import { notFound } from "next/navigation";
import { Glyph, ICONS } from "@/components/ui/avatar";
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
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-[22px] font-bold tracking-tight md:text-[26px]">Movimientos</h1>
          <p className="text-muted">
            {product.name} · {product.sku}
          </p>
        </div>
        <Link href={`/productos/${product.id}`} className="btn-suave flex h-10 items-center gap-1.5 px-3.5 text-sm">
          <Glyph d={ICONS.pencil} />
          Editar producto
        </Link>
      </div>
      <MovementList movements={movements} packagings={product.packagings} />
    </section>
  );
}
