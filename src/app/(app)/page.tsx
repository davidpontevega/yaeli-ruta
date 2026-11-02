import { requerirUsuario } from "@/server/auth";

export default async function Inicio() {
  const u = await requerirUsuario();
  return (
    <section className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold">Hola, {u.nombre}</h1>
      <div className="tarjeta text-muted">
        Aquí aparecerán las alertas de vencimiento, stock bajo y las rutas del día.
      </div>
    </section>
  );
}
