import { requerirUsuario } from "@/server/auth";
import { ProductoForm } from "../producto-form";
import { opcionesCatalogo } from "../opciones";

export default async function NuevoProductoPage() {
  await requerirUsuario("DUENO");
  const [categorias, marcas] = await opcionesCatalogo();
  return (
    <section className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold">Nuevo producto</h1>
      <ProductoForm
        categorias={categorias}
        marcas={marcas}
        inicial={{
          sku: "",
          nombre: "",
          categoriaId: "",
          marcaId: "",
          stockMinimo: 0,
          margenPct: 15,
          presentaciones: [{ nombre: "unidad", factor: "1", precio: "", codigoBarras: "" }],
        }}
      />
    </section>
  );
}
