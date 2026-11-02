import type { ComponentProps } from "react";

/** Numeric 4–6 digit PIN field. Accepts every native input prop (name, autoFocus…). */
export function PinInput(props: ComponentProps<"input">) {
  return <input required inputMode="numeric" pattern="\d{4,6}" type="password" autoComplete="new-password" {...props} />;
}
