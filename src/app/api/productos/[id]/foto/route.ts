import { z } from "zod";
import { getCurrentUser } from "@/server/auth";
import { getProductPhoto } from "@/modules/catalog";

const fail = (status: number, error: string) => Response.json({ error }, { status });

// URLs carry ?v=<updated_at ms>, so a cached copy never goes stale: a new photo is a new URL.
export async function GET(req: Request, ctx: RouteContext<"/api/productos/[id]/foto">) {
  if (!(await getCurrentUser())) return fail(401, "Sesión vencida; vuelve a entrar");
  const id = z.uuid().safeParse((await ctx.params).id);
  if (!id.success) return fail(404, "Sin foto");
  const photo = await getProductPhoto(id.data);
  if (!photo) return fail(404, "Sin foto");

  const etag = `"${photo.updatedAt.getTime()}"`;
  const headers = { "Cache-Control": "private, max-age=31536000, immutable", ETag: etag };
  if (req.headers.get("if-none-match") === etag) return new Response(null, { status: 304, headers });
  return new Response(new Uint8Array(photo.bytes), { headers: { ...headers, "Content-Type": photo.mime } });
}
