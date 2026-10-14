import { Fragment, type ReactNode } from "react";

/** "*accent* text" → the starred part wrapped in <em> (styled in the accent colour by the page). */
export function accent(text: string): ReactNode {
  return text.split("*").map((part, i) => (i % 2 ? <em key={i}>{part}</em> : <Fragment key={i}>{part}</Fragment>));
}
