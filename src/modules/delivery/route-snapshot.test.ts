import { test } from "node:test";
import assert from "node:assert/strict";
import { buildRouteSnapshot, type RouteRow } from "./route-snapshot";

const base: RouteRow = {
  sheetId: "s1",
  sheetNumber: 7,
  sheetStatus: "EN_RUTA",
  sheetDate: "2026-11-28",
  routeName: "Norte",
  vehicleName: "Moto",
  driverName: "Luis",
  customerId: "c1",
  customerName: "Bodega Ana",
  phone: "999",
  address: "Jr. Lima 1",
  reference: "esquina",
  routeOrder: 2,
  orderId: "o1",
  orderNumber: 10,
  orderStatus: "PENDIENTE",
  orderTotal: 1500,
  packagingId: "k1",
  productName: "Arroz",
  packagingName: "saco",
  quantity: 1,
  price: 1500,
};

test("groups by customer in visit order, orders by number; debt defaults to 0", () => {
  const rows: RouteRow[] = [
    base,
    { ...base, customerId: "c2", customerName: "Tienda Beto", routeOrder: 1, orderId: "o3", orderNumber: 12 },
    { ...base, customerId: "c2", customerName: "Tienda Beto", routeOrder: 1, orderId: "o2", orderNumber: 11 },
    { ...base, productName: "Azúcar", price: 500 },
  ];
  const [s] = buildRouteSnapshot(rows, { c2: 3000 }, {}, {});
  assert.deepEqual(
    s.customers.map((c) => [c.id, c.debt, c.orders.map((o) => o.number)]),
    [
      ["c2", 3000, [11, 12]],
      ["c1", 0, [10]],
    ],
  );
  assert.equal(s.customers[1].orders[0].lines.length, 2);
  assert.equal(s.customers[1].orders[0].lines[0].packagingId, "k1");
});

test("cancelled orders are left out; a sheet without orders is kept", () => {
  const rows: RouteRow[] = [
    { ...base, orderStatus: "ANULADO" },
    {
      ...base,
      sheetId: "s2",
      customerId: null,
      orderId: null,
      orderStatus: null,
      packagingId: null,
      productName: null,
      packagingName: null,
      quantity: null,
      price: null,
    },
  ];
  const sheets = buildRouteSnapshot(rows, {}, {}, {});
  assert.deepEqual(
    sheets.map((s) => [s.id, s.customers.length]),
    [
      ["s1", 0],
      ["s2", 0],
    ],
  );
});

test("load summary joins floors per product and expiry, with packagings", () => {
  const picking = {
    floors: [
      {
        locationId: "f1",
        locationName: "Piso 1",
        items: [{ productId: "p1", productName: "Arroz", lotId: "l1", expiresOn: "2027-01-01", baseQty: 30 }],
      },
      {
        locationId: "f2",
        locationName: "Piso 2",
        items: [{ productId: "p1", productName: "Arroz", lotId: "l2", expiresOn: "2027-01-01", baseQty: 20 }],
      },
    ],
    short: [{ productId: "p1", productName: "Arroz", missing: 5 }],
    weight: { grams: 2000, noWeight: 1 },
  };
  const packs = {
    p1: [
      { name: "saco", factor: 50 },
      { name: "kilo", factor: 1 },
    ],
  };
  const [s] = buildRouteSnapshot([base], {}, { s1: picking }, packs);
  assert.deepEqual(s.load, {
    items: [{ product: "Arroz", qty: "1 saco", expiresOn: "2027-01-01" }],
    short: [{ product: "Arroz", missing: "5 kilo" }],
    weightGrams: 2000,
    noWeight: 1,
  });
});

test("no cost or margin field leaks, even if rows and pickings carry them", () => {
  const dirty = { ...base, costo: 900, averageCost: 900, costo_promedio: 900, margin: 600, "margen%": 40 };
  const picking = {
    floors: [
      {
        locationId: "f1",
        locationName: "Piso 1",
        items: [{ productId: "p1", productName: "Arroz", lotId: "l1", expiresOn: null, baseQty: 50, unitCost: 9 }],
      },
    ],
    short: [],
    weight: { grams: 0, noWeight: 0 },
  };
  const json = JSON.stringify(buildRouteSnapshot([dirty], { c1: 100 }, { s1: picking }, { p1: [{ name: "saco", factor: 50 }] }));
  const keys = [...json.matchAll(/"([^"]+)":/g)].map((m) => m[1]);
  assert.ok(keys.length > 0);
  for (const k of keys) assert.doesNotMatch(k, /cost|costo|margin|margen|%/i, k);
});
