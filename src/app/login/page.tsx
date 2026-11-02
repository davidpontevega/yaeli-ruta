import { redirect } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import { db } from "@/server/db";
import { usuarios } from "@/server/db/schema";
import { usuarioActual } from "@/server/auth";
import { BRAND } from "@/lib/brand";
import { LoginForm, PrimerDuenoForm } from "./forms";

export default async function LoginPage() {
  if (await usuarioActual()) redirect("/");
  const lista = await db
    .select({ id: usuarios.id, nombre: usuarios.nombre })
    .from(usuarios)
    .where(eq(usuarios.activo, true))
    .orderBy(asc(usuarios.nombre));

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-6 px-4 py-10">
      <header className="text-center">
        <h1 className="text-3xl font-bold text-primary">{BRAND.nombre}</h1>
        <p className="text-muted">{BRAND.empresa}</p>
      </header>
      {lista.length ? <LoginForm usuarios={lista} /> : <PrimerDuenoForm />}
    </main>
  );
}
