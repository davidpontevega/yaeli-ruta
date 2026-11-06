import { test } from "node:test";
import assert from "node:assert/strict";
import { MAX_READ_LINES, costFromLine, fileType, matchLine, normalizeText, parseReadResponse } from "./document-read";

const PRODUCTS = [
  {
    id: "p1",
    name: "Galleta Soda Field 34g",
    packagings: [
      { id: "p1u", name: "paquete", factor: 1 },
      { id: "p1d", name: "display", factor: 6 },
      { id: "p1c", name: "caja", factor: 48 },
    ],
  },
  {
    id: "p2",
    name: "Chocman",
    packagings: [
      { id: "p2u", name: "unidad", factor: 1 },
      { id: "p2c", name: "caja", factor: 96 },
    ],
  },
  { id: "p3", name: "Detergente Bolívar 160g", packagings: [{ id: "p3u", name: "bolsa", factor: 1 }] },
];

test("parseReadResponse: numbers, strings with comma, dates and dropped lines", () => {
  const doc = parseReadResponse(
    JSON.stringify({
      supplier: " Alicorp ",
      document: "F001-123",
      total: "1,234.50",
      lines: [
        { description: "GALLETA SODA FIELD 34G", quantity: 2, unit: "CJ", unitPrice: 60.5, total: 121, expiresOn: "31/03/2027" },
        { description: "CHOCMAN", quantity: "3", unit: "CJA", unitPrice: "72,00", total: null, expiresOn: "2027-1-5" },
        { description: "", quantity: 1 },
        { description: "BONIFICACION", quantity: 0 },
        "basura",
      ],
    }),
  );
  assert.ok(doc);
  assert.equal(doc.supplier, "Alicorp");
  assert.equal(doc.total, 123450);
  assert.equal(doc.lines.length, 2);
  assert.deepEqual(doc.lines[0], {
    description: "GALLETA SODA FIELD 34G",
    quantity: 2,
    unit: "CJ",
    unitPrice: 6050,
    total: 12100,
    expiresOn: "2027-03-31",
  });
  assert.equal(doc.lines[1].unitPrice, 7200);
  assert.equal(doc.lines[1].expiresOn, "2027-01-05");
  assert.equal(parseReadResponse(JSON.stringify({ lines: [{ description: "A", quantity: 1, expiresOn: "31/02/2027" }] }))?.lines[0].expiresOn, null);
});

test("parseReadResponse: invalid JSON or shape → null; caps lines", () => {
  assert.equal(parseReadResponse("no json"), null);
  assert.equal(parseReadResponse("[1,2]"), null);
  const many = { lines: Array.from({ length: 100 }, (_, i) => ({ description: `X${i}`, quantity: 1 })) };
  assert.equal(parseReadResponse(JSON.stringify(many))?.lines.length, MAX_READ_LINES);
});

test("normalizeText strips accents and punctuation", () => {
  assert.equal(normalizeText("Detergente  Bolívar, 160g."), "DETERGENTE BOLIVAR 160G");
});

test("matchLine: alias wins with its exact packaging", () => {
  const m = matchLine({ description: "GALL. SODA FLD X34", unit: "CJ" }, PRODUCTS, { "GALL SODA FLD X34": "p1d" });
  assert.deepEqual(m, { productId: "p1", packagingId: "p1d", status: "alias" });
});

test("matchLine: word overlap with packaging from unit", () => {
  assert.deepEqual(matchLine({ description: "GALLETA SODA FIELD 34G X 48", unit: "CJ" }, PRODUCTS, {}), {
    productId: "p1",
    packagingId: "p1c",
    status: "suggested",
  });
  assert.equal(matchLine({ description: "GALLETA SODA FIELD 34G", unit: "DSP" }, PRODUCTS, {}).packagingId, "p1d");
  assert.equal(matchLine({ description: "CHOCMAN 22G", unit: "UND" }, PRODUCTS, {}).packagingId, "p2u");
  // unknown unit → largest packaging
  assert.equal(matchLine({ description: "CHOCMAN", unit: "ZZ" }, PRODUCTS, {}).packagingId, "p2c");
});

test("matchLine: sizes are normalized and must agree", () => {
  const rice = [{ id: "r", name: "Arroz Costeño 750g", packagings: [{ id: "ru", name: "bolsa", factor: 1 }] }];
  assert.equal(matchLine({ description: "ARROZ COSTEÑO 5KG", unit: "UND" }, rice, {}).status, "none");
  assert.equal(matchLine({ description: "ARROZ COSTEÑO 750GR", unit: "UND" }, rice, {}).status, "suggested");
  assert.equal(matchLine({ description: "GALLETA SODA FIELD 34GR X 60UN", unit: "CJ" }, PRODUCTS, {}).packagingId, "p1c");
});

test("matchLine: below threshold → none", () => {
  assert.equal(matchLine({ description: "GALLETA RELLENITA", unit: "CJ" }, PRODUCTS, {}).status, "none");
  assert.equal(matchLine({ description: "ARROZ COSTEÑO", unit: null }, PRODUCTS, {}).status, "none");
});

test("costFromLine: unit price, else total / quantity", () => {
  assert.equal(costFromLine({ unitPrice: 6050, total: 12100, quantity: 2 }), 6050);
  assert.equal(costFromLine({ unitPrice: null, total: 12100, quantity: 2 }), 6050);
  assert.equal(costFromLine({ unitPrice: null, total: null, quantity: 2 }), null);
});

test("fileType by magic bytes", () => {
  assert.equal(fileType(new Uint8Array([0xff, 0xd8, 0xff, 0xe0])), "image/jpeg");
  assert.equal(fileType(new TextEncoder().encode("%PDF-1.7")), "application/pdf");
  assert.equal(fileType(new Uint8Array([0x89, 0x50, 0x4e, 0x47])), null); // PNG: the browser always converts photos to JPEG
  assert.equal(fileType(new Uint8Array([])), null);
});
