// Same colors as each step's button (.btn-armar, .btn-cargar, .btn-entregar, .btn-cerrar).
const STEPS = [
  { label: "Armar", on: "bg-cyan-700 text-white", done: "bg-cyan-50 text-cyan-800" },
  { label: "Cargar", on: "bg-amber-600 text-white", done: "bg-amber-50 text-amber-800" },
  { label: "Entregar", on: "bg-emerald-700 text-white", done: "bg-emerald-50 text-emerald-800" },
  { label: "Cerrar ruta", on: "bg-violet-700 text-white", done: "bg-violet-50 text-violet-800" },
];

/** ① Armar ② Cargar ③ Entregar ④ Cerrar ruta: steps before `step` have a check, `step` is highlighted; 5 = all done. */
export function SheetStepper({ step }: { step: 1 | 2 | 3 | 4 | 5 }) {
  return (
    <ol className="grid grid-cols-4 gap-1.5 print:hidden">
      {STEPS.map(({ label, on, done: doneTone }, i) => {
        const n = i + 1;
        const done = n < step;
        const current = n === step;
        return (
          <li
            key={label}
            aria-current={current ? "step" : undefined}
            className={`flex flex-col items-center gap-1 rounded-xl px-1 py-2 text-center text-xs font-semibold ${current ? on : done ? doneTone : "bg-slate-100 text-muted"}`}
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
