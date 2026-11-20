"use client";

/** WhatsApp with the summary text + print (Chrome "Guardar como PDF"). Hidden on paper. */
export function ShareButtons({ waHref }: { waHref: string }) {
  return (
    <div className="grid grid-cols-2 gap-2 print:hidden">
      <a href={waHref} target="_blank" rel="noreferrer" className="btn-secundario flex h-12 items-center justify-center text-sm">
        Enviar por WhatsApp
      </a>
      <button type="button" onClick={() => window.print()} className="btn-secundario h-12 text-sm">
        Imprimir / PDF
      </button>
    </div>
  );
}
