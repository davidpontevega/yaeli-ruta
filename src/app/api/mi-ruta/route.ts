import { getCurrentUser } from "@/server/auth";
import { canSee } from "@/lib/menus";
import { todayInLima } from "@/modules/inventory";
import { getMyRoute, type RouteSnapshot } from "@/modules/delivery";

const noStore = { "Cache-Control": "no-store" };
const fail = (status: number, error: string) => Response.json({ error }, { status, headers: noStore });

/** Today's sheets for the phone to keep offline (spec 024). */
export async function GET() {
  const me = await getCurrentUser();
  if (!me) return fail(401, "Sesión vencida; vuelve a entrar");
  if (!canSee("/mi-ruta", me.role, me.hiddenMenus)) return fail(403, "No tienes acceso a Mi ruta de hoy");
  const body: RouteSnapshot = { downloadedAt: new Date().toISOString(), userId: me.id, sheets: await getMyRoute(me, todayInLima()) };
  return Response.json(body, { headers: noStore });
}
