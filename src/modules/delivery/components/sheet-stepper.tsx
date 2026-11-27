const STEPS = ["Armar", "Cargar", "Entregar", "Cerrar ruta"];

/** ① Armar ② Cargar ③ Entregar ④ Cerrar ruta: steps before `step` have a check, `step` is highlighted; 5 = all done. */
export function SheetStepper({ step }: { step: 1 | 2 | 3 | 4 | 5 }) {
  return (
    <ol className="grid grid-cols-4 gap-1.5 print:hidden">
      {STEPS.map((label, i) => {
        const n = i + 1;
        const done = n < step;
        const current = n === step;
        return (
          <li
            key={label}
            aria-current={current ? "step" : undefined}
            className={`flex flex-col items-center gap-1 rounded-xl px-1 py-2 text-center text-xs font-semibold ${current ? "bg-primary text-primary-foreground" : done ? "bg-teal-50 text-teal-800" : "bg-slate-100 text-muted"}`}
          >
            <span aria-hidden className="text-base leading-none">
              {done ? "✓" : n}
            </span>
            {label}
          </li>
        );
      })}
    </ol>
  );
}
