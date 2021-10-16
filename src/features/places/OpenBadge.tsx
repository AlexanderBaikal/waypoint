import { openStateAt } from "../../domain/hours";
import type { Schedule } from "../../domain/place";
import styles from "./places.module.css";

interface OpenBadgeProps {
  schedule: Schedule | null;
  /** Injectable so tests are not at the mercy of the clock. */
  now?: Date;
}

export function OpenBadge({ schedule, now = new Date() }: OpenBadgeProps) {
  const state = openStateAt(schedule, now);
  if (state.status === "unknown") return null;

  const open = state.status === "open";
  const detail = open
    ? state.until && `until ${state.until}`
    : state.next && `opens ${state.next}`;

  return (
    <span className={styles.openBadge} data-open={String(open)}>
      {open ? "Open" : "Closed"}
      {detail ? <span className={styles.openDetail}>· {detail}</span> : null}
    </span>
  );
}
