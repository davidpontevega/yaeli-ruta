// Distribuidora Yaeli mark: a delivery truck with a "Y" on its load, in a teal circle (option C, chosen 19-nov-2026).
// The paths are exported so the catalog cover can draw the same mark on a <canvas> (Path2D).
export const LOGO = {
  teal: "#0F766E",
  gold: "#FBBF24",
  /** In a 120×120 box. */
  truck: "M25.1 35.3h46.5v40.3H25.1zM71.6 50.8h12.4l9.3 9.3v15.5H71.6z",
  wheels: [
    [39, 83.4],
    [79.4, 83.4],
  ] as const,
  y: "M38 44 L48.5 55 L59 44 M48.5 55 L48.5 67",
} as const;

/** The round mark; `invert` draws it white with teal lines (for dark backgrounds). */
export function LogoMark({ size = 40, invert = false, label }: { size?: number; invert?: boolean; label?: string }) {
  const bg = invert ? "#FFFFFF" : LOGO.teal;
  const ink = invert ? LOGO.teal : "#FFFFFF";
  return (
    <svg width={size} height={size} viewBox="0 0 120 120" role={label ? "img" : undefined} aria-label={label} aria-hidden={label ? undefined : true}>
      <circle cx="60" cy="60" r="58" fill={bg} />
      <path d={LOGO.truck} fill="none" stroke={ink} strokeWidth="5.3" strokeLinejoin="round" />
      {LOGO.wheels.map(([cx, cy]) => (
        <circle key={cx} cx={cx} cy={cy} r="6.2" fill={LOGO.gold} stroke={ink} strokeWidth="4" />
      ))}
      <path d={LOGO.y} fill="none" stroke={ink} strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** Mark + "Yaeli / DISTRIBUIDORA" for headers and the login screen. */
export function Logo({ size = 40, className = "" }: { size?: number; className?: string }) {
  return (
    <span className={`flex items-center gap-2.5 ${className}`}>
      <LogoMark size={size} />
      <span className="flex flex-col leading-none">
        <span className="font-display font-extrabold tracking-tight text-[#134E4A]" style={{ fontSize: size * 0.6 }}>
          Yaeli
        </span>
        <span className="mt-1 font-bold tracking-[0.28em] text-muted" style={{ fontSize: Math.max(8, size * 0.2) }}>
          DISTRIBUIDORA
        </span>
      </span>
    </span>
  );
}
