import "server-only";

// The only place that talks to Gemini. To switch provider or plan, only this file and the key change.
// Adapted from Farmacia's prescription reader: several models race and the first valid reading wins,
// because on the free plan a single model may take 30 s+ or answer "high demand".
const DEFAULT_MODEL = "gemini-3.5-flash-lite";
// Cost: each reading may call up to 2 distinct models (deduplicated with GEMINI_MODEL), and each counts against the free quota.
const FALLBACK_MODELS = ["gemini-3.1-flash-lite", "gemini-3.5-flash-lite"];
const TIMEOUT_MS = 55_000;

export const isDocumentReaderEnabled = () => !!process.env.GEMINI_API_KEY;

/** status: 429 quota/busy, 502 unreadable answer, 503 unavailable (no key, network, timeout, Google error). */
export class ReaderError extends Error {
  constructor(readonly status: 429 | 502 | 503) {
    super(status === 429 ? "busy" : status === 502 ? "unreadable" : "unavailable");
  }
}

const PROMPT = [
  "El archivo es una factura, boleta o guía de remisión de un proveedor de una distribuidora de abarrotes en Perú.",
  "Extrae SOLO las líneas de productos de la tabla de detalle, en el mismo orden.",
  "Para cada línea: description (texto tal como aparece), quantity (número), unit (unidad tal como aparece: CJ, UND, DSP, PQT…),",
  "unitPrice (precio por esa unidad; si hay valor unitario sin IGV y precio unitario con IGV, usa el precio CON IGV), total (importe de la línea),",
  "expiresOn (fecha de vencimiento de la línea en formato YYYY-MM-DD; búscala también dentro de la descripción: VCTO, VENCE, F.V., EXP; si no hay, null).",
  "También supplier (razón social del emisor), document (serie y número del comprobante que aparece junto a FACTURA, BOLETA o GUÍA, ej. F001-00012345) y total (importe total a pagar).",
  "No inventes: si un dato no aparece o no se lee, usa null. Ignora subtotales, descuentos globales, IGV, firmas y sellos.",
  "Montos como número con punto decimal, sin símbolo de moneda.",
].join("\n");

const num = { type: "NUMBER", nullable: true };
const str = { type: "STRING", nullable: true };
const RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    supplier: str,
    document: str,
    total: num,
    lines: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: { description: { type: "STRING" }, quantity: { type: "NUMBER" }, unit: str, unitPrice: num, total: num, expiresOn: str },
        required: ["description", "quantity"],
      },
    },
  },
  required: ["lines"],
};

async function readWithModel<T>(
  model: string,
  key: string,
  file: { mime: string; data: string },
  parse: (text: string) => T | null,
  signal: AbortSignal,
) {
  let res: Response;
  try {
    res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": key },
      signal,
      body: JSON.stringify({
        contents: [{ parts: [{ text: PROMPT }, { inline_data: { mime_type: file.mime, data: file.data } }] }],
        generationConfig: { temperature: 0, responseMimeType: "application/json", responseSchema: RESPONSE_SCHEMA },
      }),
    });
  } catch (err) {
    // Only the error name: the message could echo part of the request.
    const name = err instanceof Error ? err.name : "error";
    if (name !== "AbortError") console.error("Gemini call failed", model, name);
    throw new ReaderError(503);
  }
  // Only the status: the body may repeat the content sent.
  if (!res.ok) {
    console.error("Gemini answered", model, res.status);
    throw new ReaderError(res.status === 429 ? 429 : 503);
  }
  let body: { candidates?: { content?: { parts?: { text?: string }[] } }[] };
  try {
    body = await res.json();
  } catch {
    throw new ReaderError(502);
  }
  const result = parse(body.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "");
  if (result === null) throw new ReaderError(502);
  return result;
}

/** Reads a JPEG or PDF. `parse` validates the model's JSON (null = unreadable). Stores and logs nothing of the content. */
export async function readDocument<T>(
  file: { mime: "image/jpeg" | "application/pdf"; bytes: Uint8Array },
  parse: (text: string) => T | null,
): Promise<T> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new ReaderError(503);
  const models = [...new Set([process.env.GEMINI_MODEL || DEFAULT_MODEL, ...FALLBACK_MODELS])];
  const data = { mime: file.mime, data: Buffer.from(file.bytes).toString("base64") };

  const losers = new AbortController();
  const signal = AbortSignal.any([AbortSignal.timeout(TIMEOUT_MS), losers.signal]);
  try {
    return await Promise.any(models.map((m) => readWithModel(m, key, data, parse, signal)));
  } catch (err) {
    const errors = err instanceof AggregateError ? err.errors.filter((e): e is ReaderError => e instanceof ReaderError) : [];
    if (errors.length > 0 && errors.every((e) => e.status === 502)) throw new ReaderError(502); // all answered, nothing usable
    throw new ReaderError(errors.some((e) => e.status === 429) ? 429 : 503);
  } finally {
    losers.abort(); // the winner is done; cut the others
  }
}
