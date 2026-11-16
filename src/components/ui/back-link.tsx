import Link from "next/link";

/** "‹ Volver a X" at the top of a screen reached from a button. Goes to a fixed parent (not history), so it works after a reload. */
export function BackLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="-mb-2 inline-flex h-9 items-center gap-1 self-start rounded-full pr-3 pl-1.5 text-sm font-medium text-muted transition hover:bg-slate-200/60 hover:text-foreground print:hidden"
    >
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <path d="M15 6l-6 6 6 6" />
      </svg>
      Volver a {label}
    </Link>
  );
}
