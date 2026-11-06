import { getCurrentUser } from "@/server/auth";
import { ReaderError, readDocument } from "@/server/ai/document-reader";
import { fileType, parseReadResponse, recordReadResult, reserveReadSlot } from "@/modules/inventory";

export const maxDuration = 60;

const MAX_BYTES = 4 * 1024 * 1024; // Vercel's request body limit is 4.5 MB
const MESSAGES: Record<ReaderError["status"], string> = {
  429: "El lector está muy ocupado; intenta en un minuto o llena las líneas a mano",
  502: "No se entendió el documento; prueba con una foto más nítida y derecha",
  503: "El lector no está disponible ahora; llena las líneas a mano",
};

const fail = (status: number, error: string) => Response.json({ error }, { status });

export async function POST(req: Request) {
  const me = await getCurrentUser();
  if (!me) return fail(401, "Sesión vencida; vuelve a entrar");
  if (me.role !== "DUENO") return fail(403, "Solo el dueño puede recibir mercadería");
  if (Number(req.headers.get("content-length")) > MAX_BYTES + 64 * 1024) return fail(413, "El archivo pesa más de 4 MB");

  const file = (await req.formData().catch(() => null))?.get("file");
  if (!(file instanceof File)) return fail(400, "Falta el archivo");
  if (file.size > MAX_BYTES) return fail(400, "El archivo pesa más de 4 MB");
  const bytes = new Uint8Array(await file.arrayBuffer());
  const mime = fileType(bytes);
  if (!mime) return fail(400, "Solo foto (JPG) o PDF");

  if (!(await reserveReadSlot(me.id, mime))) return fail(429, "Llegaste al límite de lecturas; espera unos minutos");
  try {
    const doc = await readDocument({ mime, bytes }, parseReadResponse);
    await recordReadResult(me.id, doc.lines.length);
    return Response.json(doc);
  } catch (e) {
    if (e instanceof ReaderError) return fail(e.status, MESSAGES[e.status]);
    throw e;
  }
}
