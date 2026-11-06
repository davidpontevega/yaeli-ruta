import { test } from "node:test";
import assert from "node:assert/strict";
import { documentInfo, findTableHeader, groupLines, linesToDocument, parseQuantity, splitItem, type Word } from "./table-read";

// Monospace page: each text line is one PDF item, 6 units per char, 14 units per line (like a Courier PDF).
const page = (rows: string[]): Word[] => rows.flatMap((r, i) => splitItem(r, 40, 40 + r.length * 6, 40 + i * 14, 50 + i * 14));

const INVOICE = [
  "DISTRIBUIDORA MAYORISTA DEL NORTE S.A.C.      RUC 20512345678",
  "FACTURA ELECTRONICA  F001-00004521        Fecha: 05/11/2026",
  "",
  "CANT  UM   DESCRIPCION                          V.UNIT   P.UNIT   IMPORTE",
  "   2  CJ   GALLETA SODA FIELD 34GR X 60UN        21.19    25.00     50.00",
  "   3  DSP  CHOCMAN COSTA 30G X12                  7.63     9.00     27.00",
  "   4  FDO  DET. BOLIVAR 850G X12 VCTO 15/08/2027 91.53   108.00    432.00",
  "           (BOLSA ROJA)",
  "  10  UND  ARROZ COSTEÑO 5KG                  1,019.49 1,023.00 10,230.00",
  "",
  "                                   OP. GRAVADA S/   862.71",
  "                                   IGV 18%     S/   155.29",
  "TOTAL                                          S/ 11,739.00",
];

test("splitItem places words by character offset", () => {
  assert.deepEqual(splitItem("AB  CD", 0, 60, 0, 10), [
    { text: "AB", x0: 0, x1: 20, y0: 0, y1: 10 },
    { text: "CD", x0: 40, x1: 60, y0: 0, y1: 10 },
  ]);
});

test("groupLines joins words of the same height", () => {
  const lines = groupLines([
    { text: "B", x0: 50, x1: 60, y0: 1, y1: 11 },
    { text: "A", x0: 0, x1: 10, y0: 0, y1: 10 },
    { text: "C", x0: 0, x1: 10, y0: 20, y1: 30 },
  ]);
  assert.deepEqual(
    lines.map((l) => l.map((w) => w.text).join(" ")),
    ["A B", "C"],
  );
});

test("findTableHeader: prefers price with IGV, needs qty + desc + price/amount", () => {
  const h = findTableHeader(groupLines(page(INVOICE)));
  assert.ok(h);
  assert.deepEqual(Object.keys(h.columns).sort(), ["amount", "desc", "price", "qty", "unit"]);
  // P.UNIT (with IGV) column starts after the V.UNIT label
  const vUnitX = 40 + INVOICE[3].indexOf("V.UNIT") * 6;
  assert.ok(h.columns.price![0] > vUnitX);
  assert.equal(findTableHeader(groupLines(page(["NOMBRE   PRECIO", "ARROZ    2.00"]))), null);
});

test("linesToDocument: rows, continuation, thousands, expiry in text, footer stop", () => {
  const doc = linesToDocument([page(INVOICE)], INVOICE.join("\n"));
  assert.ok(doc);
  assert.equal(doc.supplier, "DISTRIBUIDORA MAYORISTA DEL NORTE S.A.C.");
  assert.equal(doc.document, "F001-00004521");
  assert.equal(doc.total, 1173900);
  assert.equal(doc.lines.length, 4);
  assert.deepEqual(doc.lines[0], {
    description: "GALLETA SODA FIELD 34GR X 60UN",
    quantity: 2,
    unit: "CJ",
    unitPrice: 2500,
    total: 5000,
    expiresOn: null,
  });
  assert.equal(doc.lines[2].description, "DET. BOLIVAR 850G X12 VCTO 15/08/2027 (BOLSA ROJA)");
  assert.equal(doc.lines[2].expiresOn, "2027-08-15");
  assert.equal(doc.lines[3].unitPrice, 102300);
  assert.equal(doc.lines[3].total, 1023000);
});

test("linesToDocument: second page without header reuses columns", () => {
  const p2 = ["   1  CJ   OREO GALLETA 36G X 72                 48.31    57.00     57.00", "TOTAL  S/ 57.00"];
  const doc = linesToDocument([page(INVOICE.slice(0, 5)), page(p2)], "");
  assert.equal(doc?.lines.length, 2);
  assert.equal(doc?.lines[1].unitPrice, 5700);
});

test("linesToDocument: no header anywhere → null", () => {
  assert.equal(linesToDocument([page(["HOLA MUNDO", "1 2 3"])], ""), null);
});

test("documentInfo: guía number and IMPORTE TOTAL", () => {
  const info = documentInfo("COMERCIAL LUZ E.I.R.L.\nGUIA DE REMISION T001-889\nIMPORTE TOTAL S/ 1,234.50");
  assert.deepEqual(info, { supplier: "COMERCIAL LUZ E.I.R.L.", document: "T001-889", total: 123450 });
});

test("footer is a whole word: 'SONDA' or 'TOTALMENTE' in a description doesn't end the table", () => {
  const rows = [
    "CANT  UM   DESCRIPCION                          P.UNIT   IMPORTE",
    "   1  UND  CABLE USB                              5.00      5.00",
    "           SONDA NUEVA",
    "   2  UND  TOTALMENTE NUEVO X2                    3.00      6.00",
    "SON: ONCE CON 00/100 SOLES",
    "   9  UND  NO ES FILA                              1.00      9.00",
  ];
  const doc = linesToDocument([page(rows)], "");
  assert.deepEqual(
    doc?.lines.map((l) => l.description),
    ["CABLE USB SONDA NUEVA", "TOTALMENTE NUEVO X2"],
  );
});

test("continuation page skips letterhead; nothing after the footer page", () => {
  const p1 = ["CANT  UM   DESCRIPCION                          P.UNIT   IMPORTE", "   1  UND  CHOCMAN                                1.00      1.00"];
  const p2 = [
    "           Pagina 2 de 3",
    "           DISTRIBUIDORA X S.A.C.",
    "   2  UND  OREO                                   1.00      2.00",
    "TOTAL  S/ 3.00",
  ];
  const p3 = ["           Condiciones de venta", "   5  UND  NO ES FILA                             1.00      5.00"];
  const doc = linesToDocument([page(p1), page(p2), page(p3)], "");
  assert.deepEqual(
    doc?.lines.map((l) => l.description),
    ["CHOCMAN", "OREO"],
  );
});

test("parseQuantity: decimals of zero are whole, anything else needs fixing", () => {
  assert.equal(parseQuantity("2"), 2);
  assert.equal(parseQuantity("2.00"), 2);
  assert.equal(parseQuantity("2,000"), 2);
  assert.equal(parseQuantity("1.5"), 0);
  assert.equal(parseQuantity("x"), 0);
});

test("documentInfo: S.A. supplier and decimal comma total", () => {
  const info = documentInfo("ACME S.A. RUC 20100000001\nF001-9\nTOTAL S/ 1.234,50");
  assert.equal(info.supplier, "ACME S.A.");
  assert.equal(info.total, 123450);
});
