import { getCurrentUser } from "@/server/auth";
import { canSee } from "@/lib/menus";
import { syncOps, syncSchema } from "@/modules/delivery";

const noStore = { "Cache-Control": "no-store" };
const fail = (status: number, error: string) => Response.json({ error }, { status, headers: noStore });

/** Deliveries made without signal (spec 025): `{ ops }` → `{ results }`, one per op, in order. */
export async function POST(request: Request) {
  const me = await getCurrentUser();
  if (!me) return fail(401, "Sesión vencida; vuelve a entrar");
  if (!canSee("/mi-ruta", me.role, me.hiddenMenus)) return fail(403, "No tienes acceso a Mi ruta de hoy");
  const input = syncSchema.safeParse(await request.json().catch(() => null));
  if (!input.success) return fail(400, "Datos inválidos");
  return Response.json({ results: await syncOps(me, input.data.ops) }, { headers: noStore });
}
