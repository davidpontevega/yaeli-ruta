/** Friendly empty list: a soft icon and the message, instead of a bare grey line. */
export function EmptyState({ text, tone = "bg-slate-100 text-slate-500" }: { text: string; tone?: string }) {
  return (
    <div className="tarjeta flex flex-col items-center gap-3 py-10 text-center">
      <span aria-hidden className={`flex h-12 w-12 items-center justify-center rounded-2xl ${tone}`}>
        <svg
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M21 8l-9-5-9 5 9 5 9-5zM3 8v8l9 5 9-5V8M12 13v8" />
        </svg>
      </span>
      <p className="max-w-sm text-sm text-muted">{text}</p>
    </div>
  );
}
