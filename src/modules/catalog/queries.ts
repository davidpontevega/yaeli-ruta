import "server-only";
import { and, asc, count, eq, ilike, inArray, isNull, or, type SQL } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/server/db";
import { brands, categories, locations, packagings, productPhotos, products, suppliers } from "@/server/db/schema";
import { needsReview, priceUnitCost, realMarginPct, suggestedPrice } from "./pricing";

export const PRODUCT_LIST_LIMIT = 200;

/** Products with their packagings. `q` matches name, code or any packaging barcode. `supplierId`: "" all, "none" without supplier. */
export async function listProducts(f: { q: string; categoryId: string; includeInactive: boolean; supplierId?: string }) {
  const where: (SQL | undefined)[] = [f.includeInactive ? undefined : eq(products.active, true)];
  if (f.categoryId) where.push(eq(products.categoryId, f.categoryId));
  // An id that isn't a uuid (hand-edited URL) is ignored instead of failing the query.
  const sup = f.supplierId;
  if (sup === "none") where.push(isNull(products.supplierId));
  else if (sup && z.uuid().safeParse(sup).success) where.push(eq(products.supplierId, sup));
  if (f.q) {
    const byBarcode = db.select({ id: packagings.productId }).from(packagings).where(eq(packagings.barcode, f.q));
    where.push(or(ilike(products.name, `%${f.q}%`), ilike(products.sku, `%${f.q}%`), inArray(products.id, byBarcode)));
  }

  const rows = await db
    .select({
      id: products.id,
      sku: products.sku,
      name: products.name,
      active: products.active,
      minStock: products.minStock,
      category: categories.name,
      brand: brands.name,
      supplierId: products.supplierId,
      supplierName: suppliers.name,
      showInCatalog: products.showInCatalog,
      photoAt: productPhotos.updatedAt,
    })
    .from(products)
    .innerJoin(categories, eq(categories.id, products.categoryId))
    .leftJoin(brands, eq(brands.id, products.brandId))
    .leftJoin(suppliers, eq(suppliers.id, products.supplierId))
    .leftJoin(productPhotos, eq(productPhotos.productId, products.id))
    .where(and(...where))
    .orderBy(asc(categories.name), asc(products.name))
    .limit(PRODUCT_LIST_LIMIT);

  const packs = rows.length
    ? await db
        .select()
        .from(packagings)
        .where(
          inArray(
            packagings.productId,
            rows.map((r) => r.id),
          ),
        )
        .orderBy(asc(packagings.factor))
    : [];
  return rows.map(({ photoAt, ...r }) => ({ ...r, photoVersion: photoVersion(photoAt), packagings: packs.filter((x) => x.productId === r.id) }));
}

export type ProductListItem = Awaited<ReturnType<typeof listProducts>>[number];

export async function getProductWithPackagings(id: string) {
  const [[row], packs] = await Promise.all([
    db
      .select({ product: products, photoAt: productPhotos.updatedAt })
      .from(products)
      .leftJoin(productPhotos, eq(productPhotos.productId, products.id))
      .where(eq(products.id, id))
      .limit(1),
    db.select().from(packagings).where(eq(packagings.productId, id)).orderBy(asc(packagings.factor)),
  ]);
  return row ? { ...row.product, photoVersion: photoVersion(row.photoAt), packagings: packs } : null;
}

/** Photo version for `?v=` in its URL (changes when the photo is replaced); null without photo. */
const photoVersion = (at: Date | null) => at?.getTime() ?? null;

/** The stored photo of a product, or null. Only the photo route reads the bytes. */
export async function getProductPhoto(productId: string) {
  const [row] = await db.select().from(productPhotos).where(eq(productPhotos.productId, productId)).limit(1);
  return row ?? null;
}

/** Active products marked for the catalog, grouped by category (both by name); `photoVersion` null = no photo yet. */
export async function getCatalogSheet() {
  const rows = await db
    .select({
      categoryId: categories.id,
      category: categories.name,
      id: products.id,
      name: products.name,
      photoAt: productPhotos.updatedAt,
    })
    .from(products)
    .innerJoin(categories, eq(categories.id, products.categoryId))
    .leftJoin(productPhotos, eq(productPhotos.productId, products.id))
    .where(and(eq(products.active, true), eq(products.showInCatalog, true)))
    .orderBy(asc(categories.name), asc(products.name));
  return [...Map.groupBy(rows, (r) => r.categoryId).values()].map((list) => ({
    categoryId: list[0].categoryId,
    category: list[0].category,
    products: list.map((r) => ({ id: r.id, name: r.name, photoVersion: photoVersion(r.photoAt) })),
  }));
}

export type CatalogSheet = Awaited<ReturnType<typeof getCatalogSheet>>;

export type CatalogOption = { id: string; name: string };

export async function listCatalogOptions(): Promise<{ categories: CatalogOption[]; brands: CatalogOption[]; suppliers: CatalogOption[] }> {
  const [cats, brs, sups] = await Promise.all([
    db.select({ id: categories.id, name: categories.name }).from(categories).orderBy(asc(categories.name)),
    db.select({ id: brands.id, name: brands.name }).from(brands).orderBy(asc(brands.name)),
    db.select({ id: suppliers.id, name: suppliers.name }).from(suppliers).orderBy(asc(suppliers.name)),
  ]);
  return { categories: cats, brands: brs, suppliers: sups };
}

/** Categories and brands with product counts, plus locations. */
export function getCatalogSummary() {
  return Promise.all([
    db
      .select({ id: categories.id, name: categories.name, products: count(products.id) })
      .from(categories)
      .leftJoin(products, eq(products.categoryId, categories.id))
      .groupBy(categories.id)
      .orderBy(asc(categories.name)),
    db
      .select({ id: brands.id, name: brands.name, products: count(products.id) })
      .from(brands)
      .leftJoin(products, eq(products.brandId, brands.id))
      .groupBy(brands.id)
      .orderBy(asc(brands.name)),
    db.select().from(locations).orderBy(asc(locations.type), asc(locations.name)),
  ]).then(([categoryRows, brandRows, locationRows]) => ({ categories: categoryRows, brands: brandRows, locations: locationRows }));
}

export type CatalogSummary = Awaited<ReturnType<typeof getCatalogSummary>>;

/** Packagings of active products whose price misses the target margin (beyond rounding noise). Optionally only some products. */
export async function listPriceReview(productIds?: string[]) {
  if (productIds && !productIds.length) return [];
  const rows = await db
    .select({
      packagingId: packagings.id,
      productId: products.id,
      productName: products.name,
      packagingName: packagings.name,
      factor: packagings.factor,
      price: packagings.salePrice,
      lastCost: products.lastCost,
      averageCost: products.averageCost,
      targetPct: products.marginPct,
    })
    .from(packagings)
    .innerJoin(products, eq(products.id, packagings.productId))
    .where(and(eq(products.active, true), productIds ? inArray(products.id, productIds) : undefined))
    .orderBy(asc(products.name), asc(packagings.factor));

  return rows.flatMap((r) => {
    const unitCost = priceUnitCost(r.lastCost, r.averageCost);
    const suggested = suggestedPrice(unitCost, r.factor, r.targetPct);
    if (suggested === null || r.price >= suggested || !needsReview(r.price, unitCost, r.factor, r.targetPct)) return [];
    return [{ ...r, cost: unitCost! * r.factor, suggested, marginPct: realMarginPct(r.price, unitCost, r.factor)! }];
  });
}

export type PriceReviewItem = Awaited<ReturnType<typeof listPriceReview>>[number];
