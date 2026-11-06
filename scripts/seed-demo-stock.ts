// DEMO stock (fictitious) so the expiry dashboard and home alerts show every case.
// Idempotent: does nothing if the receipt with document "DEMO" already exists.
// Usage: npm run db:demo-stock  (after npm run db:demo)
import { Pool } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { auditLog, locations, lots, packagings, products, receiptItems, receipts, stockLevels, stockMovements, users } from "../src/server/db/schema";
import { weightedAverageCost } from "../src/modules/inventory/stock-math";
import { addDays, todayInLima } from "../src/modules/inventory/expiry";

const db = drizzle(new Pool({ connectionString: process.env.DATABASE_URL! }));
const DEMO_DOC = "DEMO";

// Days from today for the "near" lot of the first products: 2 expired, 4 in 30, 3 in 31–60, 3 in 61–90.
const NEAR = [-5, -12, 3, 10, 18, 27, 35, 45, 58, 65, 75, 88];
const LOW_STOCK = 3; // the next 3 products end below their minimum

async function main() {
  const [done] = await db.select({ id: receipts.id }).from(receipts).where(eq(receipts.document, DEMO_DOC)).limit(1);
  if (done) return console.log("Stock demo ya existe; nada que hacer.");

  const [owner] = await db.select({ id: users.id }).from(users).where(eq(users.role, "DUENO")).orderBy(asc(users.createdAt)).limit(1);
  if (!owner) throw new Error("Crea primero el usuario dueño");
  const floors = await db
    .select({ id: locations.id })
    .from(locations)
    .where(and(eq(locations.type, "ALMACEN"), eq(locations.active, true)))
    .orderBy(asc(locations.name));
  if (!floors.length) throw new Error("Corre primero npm run db:demo");

  const prods = await db.select().from(products).where(eq(products.active, true)).orderBy(asc(products.sku));
  const packs = await db
    .select()
    .from(packagings)
    .where(
      inArray(
        packagings.productId,
        prods.map((p) => p.id),
      ),
    );
  const today = todayInLima();

  await db.transaction(async (tx) => {
    const lines: { productId: string; packagingId: string; qty: number; cost: number; expiresOn: string | null; locationId: string }[] = [];
    prods.forEach((p, i) => {
      const mine = packs.filter((k) => k.productId === p.id);
      const base = mine.find((k) => k.factor === 1);
      if (!base) return;
      const big = Math.max(...mine.map((k) => k.factor));
      // Cost from the cheapest per-unit price (wholesale box), so every packaging covers its margin.
      const cheapest = Math.min(...mine.map((k) => k.salePrice / k.factor));
      const cost = Math.floor(cheapest / (1 + p.marginPct / 100));
      const loc = (n: number) => floors[n % floors.length].id;
      const far = i % 4 === 3 ? null : addDays(today, 150 + ((i * 37) % 250)); // every 4th without expiry date

      if (i < NEAR.length)
        lines.push({ productId: p.id, packagingId: base.id, qty: big, cost, expiresOn: addDays(today, NEAR[i]), locationId: loc(i) });
      const low = i >= NEAR.length && i < NEAR.length + LOW_STOCK;
      const qty = low ? Math.max(1, Math.floor(p.minStock / 3)) : p.minStock + big * ((i % 4) + 1);
      lines.push({ productId: p.id, packagingId: base.id, qty, cost, expiresOn: far, locationId: loc(i + 1) });
    });

    const [{ id: receiptId }] = await tx
      .insert(receipts)
      .values({
        type: "SALDO_INICIAL",
        supplier: "Inventario de demostración",
        document: DEMO_DOC,
        total: lines.reduce((s, l) => s + l.qty * l.cost, 0),
        userId: owner.id,
      })
      .returning({ id: receipts.id });

    for (const l of lines) {
      const [prod] = await tx.select({ averageCost: products.averageCost }).from(products).where(eq(products.id, l.productId)).for("update");
      const [{ onHand }] = await tx
        .select({ onHand: sql<number>`coalesce(sum(${stockLevels.quantity}), 0)::int` })
        .from(stockLevels)
        .innerJoin(lots, eq(lots.id, stockLevels.lotId))
        .where(eq(lots.productId, l.productId));
      const [{ id: lotId }] = await tx
        .insert(lots)
        .values({ productId: l.productId, expiresOn: l.expiresOn })
        .onConflictDoUpdate({ target: [lots.productId, lots.expiresOn], set: { productId: sql`excluded.producto_id` } })
        .returning({ id: lots.id });
      await tx
        .insert(stockLevels)
        .values({ locationId: l.locationId, lotId, quantity: l.qty })
        .onConflictDoUpdate({
          target: [stockLevels.locationId, stockLevels.lotId],
          set: { quantity: sql`${stockLevels.quantity} + excluded.cantidad` },
        });
      await tx.insert(stockMovements).values({
        type: "SALDO_INICIAL",
        lotId,
        locationId: l.locationId,
        quantity: l.qty,
        unitCost: l.cost,
        documentId: receiptId,
        userId: owner.id,
      });
      await tx.insert(receiptItems).values({ receiptId, packagingId: l.packagingId, lotId, locationId: l.locationId, quantity: l.qty, cost: l.cost });
      await tx
        .update(products)
        .set({ averageCost: weightedAverageCost(onHand, prod.averageCost, l.qty, l.cost), lastCost: l.cost })
        .where(eq(products.id, l.productId));
    }
    await tx
      .insert(auditLog)
      .values({ actorId: owner.id, action: "receipt.demo_seed", entity: "receipt", entityId: receiptId, details: { lines: lines.length } });
    console.log(`Stock demo: ${lines.length} lotes en ${floors.length} pisos para ${prods.length} productos.`);
  });
}

main().then(
  () => process.exit(0),
  (e) => {
    console.error(e);
    process.exit(1);
  },
);
