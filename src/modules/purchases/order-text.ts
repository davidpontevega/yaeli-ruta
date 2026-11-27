/** WhatsApp text of a purchase list for the supplier: no costs. */
export function orderText(lines: { quantity: number | string; packagingName: string; productName: string }[], number?: number) {
  return [
    `Pedido${number ? ` #${number}` : ""} — Distribuidora Yaeli`,
    ...lines.map((l) => `${l.quantity} ${l.packagingName} · ${l.productName}`),
  ].join("\n");
}
