import { requireUser } from "@/server/auth";
import { MyRoute } from "@/modules/delivery";

export default async function MyRoutePage() {
  const me = await requireUser();
  return <MyRoute userId={me.id} />;
}
