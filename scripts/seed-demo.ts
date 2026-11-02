// Datos de DEMOSTRACIÓN (ficticios) para presentar al cliente.
// Idempotente: no duplica si se corre dos veces (salta lo que ya existe por nombre/código).
// Uso: npm run db:demo
import { Pool } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import { inArray } from "drizzle-orm";
import { brands, categories, locations, packagings, products } from "../src/server/db/schema";

const db = drizzle(new Pool({ connectionString: process.env.DATABASE_URL! }));

type P = [sku: string, nombre: string, categoria: string, marca: string, unidad: string, precio: number, otras: [string, number, number][]];

const PRODUCTOS: P[] = [
  ["GAL-001", "Galleta Soda Field 34g", "Galletas", "Field", "paquete", 0.5, [["pack x6", 6, 2.7], ["caja", 60, 25]]],
  ["GAL-002", "Galleta Casino Menta 43g", "Galletas", "Field", "paquete", 0.7, [["pack x6", 6, 3.9], ["caja", 48, 29]]],
  ["GAL-003", "Galleta Vainilla Field 54g", "Galletas", "Field", "paquete", 0.7, [["pack x6", 6, 3.9]]],
  ["GAL-004", "Galleta Oreo 36g", "Galletas", "Mondelez", "paquete", 0.9, [["pack x6", 6, 5], ["caja", 72, 57]]],
  ["GAL-005", "Galleta Club Social 26g", "Galletas", "Mondelez", "paquete", 0.7, [["pack x6", 6, 3.9]]],
  ["GAL-006", "Chocman 30g", "Galletas", "Costa", "unidad", 0.8, [["display", 12, 9], ["caja", 96, 68]]],
  ["GOL-001", "Chocolate Sublime Clásico 30g", "Golosinas", "Nestlé", "unidad", 2, [["display", 24, 44]]],
  ["GOL-002", "Chocolate Princesa 30g", "Golosinas", "Nestlé", "unidad", 1.8, [["display", 24, 40]]],
  ["GOL-003", "Caramelo Halls Mentol x9", "Golosinas", "Mondelez", "barra", 1, [["display", 12, 11]]],
  ["GOL-004", "Chicle Trident Menta", "Golosinas", "Mondelez", "unidad", 1, [["display", 18, 16]]],
  ["GOL-005", "Caramelos Ambrosoli surtidos 100u", "Golosinas", "Molitalia", "bolsa", 6.5, [["caja", 12, 75]]],
  ["LIM-001", "Detergente Bolívar 850g", "Limpieza", "Alicorp", "bolsa", 9.5, [["fardo", 12, 108]]],
  ["LIM-002", "Detergente Bolívar 160g", "Limpieza", "Alicorp", "bolsa", 1.9, [["tira", 12, 21]]],
  ["LIM-003", "Detergente Opal 900g", "Limpieza", "Alicorp", "bolsa", 7.5, [["fardo", 12, 85]]],
  ["LIM-004", "Detergente Ace 160g", "Limpieza", "P&G", "bolsa", 1.8, [["tira", 12, 20]]],
  ["LIM-005", "Detergente Ariel 750g", "Limpieza", "P&G", "bolsa", 11, [["fardo", 12, 125]]],
  ["LIM-006", "Lavavajilla Sapolio limón 180g", "Limpieza", "Intradevco", "pote", 2.5, [["caja", 24, 56]]],
  ["LIM-007", "Lejía Sapolio 1L", "Limpieza", "Intradevco", "botella", 3.2, [["caja", 15, 45]]],
  ["LIM-008", "Jabón de lavar Bolívar 190g", "Limpieza", "Alicorp", "barra", 3.2, [["caja", 50, 150]]],
  ["BEB-001", "Pañal Huggies Active Sec G x40", "Cuidado del bebé", "Kimberly-Clark", "paquete", 52, [["bulto", 4, 200]]],
  ["BEB-002", "Pañal Huggies Active Sec XG x36", "Cuidado del bebé", "Kimberly-Clark", "paquete", 52, [["bulto", 4, 200]]],
  ["BEB-003", "Pañal Babysec Ultra M x50", "Cuidado del bebé", "Protisa", "paquete", 32, [["bulto", 4, 124]]],
  ["BEB-004", "Pañal Babysec Ultra G x46", "Cuidado del bebé", "Protisa", "paquete", 34, [["bulto", 4, 132]]],
  ["BEB-005", "Toallitas húmedas Huggies x48", "Cuidado del bebé", "Kimberly-Clark", "paquete", 6.5, [["caja", 24, 148]]],
  ["PER-001", "Papel higiénico Elite x4", "Cuidado personal", "Protisa", "paquete", 4.8, [["fardo", 12, 56]]],
  ["PER-002", "Pasta dental Colgate Triple Acción 75ml", "Cuidado personal", "Colgate-Palmolive", "unidad", 3.8, [["display", 12, 44]]],
  ["PER-003", "Jabón Palmolive 120g", "Cuidado personal", "Colgate-Palmolive", "unidad", 2.5, [["display", 12, 29]]],
  ["PER-004", "Shampoo Head & Shoulders sachet 10ml", "Cuidado personal", "P&G", "sachet", 0.7, [["tira", 12, 8]]],
  ["ABA-001", "Aceite Primor 900ml", "Abarrotes", "Alicorp", "botella", 9.5, [["caja", 12, 110]]],
  ["ABA-002", "Arroz Costeño 750g", "Abarrotes", "Costeño", "bolsa", 4.2, [["fardo", 12, 49]]],
  ["ABA-003", "Fideo Don Vittorio Spaghetti 450g", "Abarrotes", "Alicorp", "bolsa", 3.8, [["fardo", 20, 74]]],
  ["ABA-004", "Leche Gloria evaporada 400g", "Abarrotes", "Gloria", "lata", 4.1, [["pack x6", 6, 24], ["caja", 48, 190]]],
  ["BEV-001", "Inca Kola 500ml", "Bebidas", "Lindley", "botella", 2.3, [["paquete", 12, 26]]],
  ["BEV-002", "Coca-Cola 500ml", "Bebidas", "Lindley", "botella", 2.3, [["paquete", 12, 26]]],
  ["BEV-003", "Big Cola 3L", "Bebidas", "AJE", "botella", 6.5, [["paquete", 6, 37]]],
  ["BEV-004", "Agua San Luis sin gas 625ml", "Bebidas", "Lindley", "botella", 1.2, [["paquete", 15, 16.5]]],
];

const MARGEN: Record<string, number> = { "Cuidado del bebé": 10, Bebidas: 12 };
const cent = (s: number) => Math.round(s * 100);

async function main() {
  await db
    .insert(locations)
    .values([
      { name: "Piso 1", type: "ALMACEN" as const },
      { name: "Piso 2", type: "ALMACEN" as const },
      { name: "Carro de reparto", type: "VEHICULO" as const },
    ])
    .onConflictDoNothing();

  const nombresCat = [...new Set(PRODUCTOS.map((p) => p[2]))];
  const nombresMarca = [...new Set(PRODUCTOS.map((p) => p[3]))];
  await db.insert(categories).values(nombresCat.map((name) => ({ name }))).onConflictDoNothing();
  await db.insert(brands).values(nombresMarca.map((name) => ({ name }))).onConflictDoNothing();
  const catId = new Map((await db.select().from(categories).where(inArray(categories.name, nombresCat))).map((c) => [c.name, c.id]));
  const marcaId = new Map((await db.select().from(brands).where(inArray(brands.name, nombresMarca))).map((m) => [m.name, m.id]));

  let creados = 0;
  for (const [sku, nombre, cat, marca, unidad, precio, otras] of PRODUCTOS) {
    const mayorFactor = Math.max(1, ...otras.map((o) => o[1]));
    const [p] = await db
      .insert(products)
      .values({
        sku,
        name: nombre,
        categoryId: catId.get(cat)!,
        brandId: marcaId.get(marca)!,
        baseUnit: unidad,
        minStock: mayorFactor * 2,
        marginPct: MARGEN[cat] ?? 15,
      })
      .onConflictDoNothing()
      .returning({ id: products.id });
    if (!p) continue;
    creados++;
    await db.insert(packagings).values([
      { productId: p.id, name: unidad, factor: 1, salePrice: cent(precio) },
      ...otras.map(([n, factor, pr]) => ({ productId: p.id, name: n, factor, salePrice: cent(pr) })),
    ]);
  }
  console.log(`Demo: ${creados} productos nuevos (${PRODUCTOS.length - creados} ya existían).`);
}

main().then(
  () => process.exit(0),
  (e) => {
    console.error(e);
    process.exit(1);
  },
);
