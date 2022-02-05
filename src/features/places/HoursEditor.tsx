import { WEEKDAYS, type DayHours, type Schedule } from "../../domain/place";
import { blankSchedule } from "../../domain/placeInput";
import styles from "./placeForm.module.css";

interface HoursEditorProps {
  value: Schedule | null;
  onChange: (schedule: Schedule | null) => void;
  error?: string;
}

const LABELS: Record<(typeof WEEKDAYS)[number], string> = {
  monday: "Mon",
  tuesday: "Tue",
  wednesday: "Wed",
  thursday: "Thu",
  friday: "Fri",
  saturday: "Sat",
  sunday: "Sun",
};

/** Closed and all-day are exclusive, and both make the times meaningless. */
function setState(hours: DayHours, state: "open" | "closed" | "allDay"): DayHours {
  return { ...hours, closed: state === "closed", allDay: state === "allDay" };
}

function stateOf(hours: DayHours): "open" | "closed" | "allDay" {
  if (hours.closed) return "closed";
  if (hours.allDay) return "allDay";
  return "open";
}

/**
 * Seven rows, because opening hours are seven rows. The alternative — one text
 * field parsed the way the OpenStreetMap import parses one — would accept far
 * more than the model can hold and then quietly drop the rest.
 *
 * Hours are optional as a whole: most of the imported places have none, and a
 * blank schedule would claim they are closed all week rather than unknown.
 */
export function HoursEditor({ value, onChange, error }: HoursEditorProps) {
  if (!value) {
    return (
      <div className={styles.field}>
        <span className={styles.label}>Opening hours</span>
        <button
          type="button"
          className={styles.secondary}
          onClick={() => {
            onChange(blankSchedule());
          }}
        >
          Add opening hours
        </button>
        <p className={styles.hint}>
          Left out, the place shows no hours rather than none.
        </p>
      </div>
    );
  }

  const update = (day: (typeof WEEKDAYS)[number], hours: DayHours) => {
    onChange({ ...value, [day]: hours });
  };

  return (
    <div className={styles.field}>
      <div className={styles.hoursHead}>
        <span className={styles.label}>Opening hours</span>
        <button
          type="button"
          className={styles.linkButton}
          onClick={() => {
            onChange(null);
          }}
        >
          Remove
        </button>
      </div>

      <div className={styles.hours}>
        {WEEKDAYS.map((day) => {
          const hours = value[day];
          const state = stateOf(hours);

          return (
            <div key={day} className={styles.hoursRow}>
              <span className={styles.hoursDay}>{LABELS[day]}</span>

              <select
                className={styles.hoursState}
                value={state}
                aria-label={`${LABELS[day]}: open, closed or all day`}
                onChange={(event) => {
                  update(day, setState(hours, event.target.value as typeof state));
                }}
              >
                <option value="open">Open</option>
                <option value="closed">Closed</option>
                <option value="allDay">24 hours</option>
              </select>

              {state === "open" ? (
                <span className={styles.hoursTimes}>
                  <input
                    type="time"
                    value={hours.open}
                    aria-label={`${LABELS[day]} opens at`}
                    onChange={(event) => {
                      update(day, { ...hours, open: event.target.value });
                    }}
                  />
                  <span aria-hidden="true">–</span>
                  <input
                    type="time"
                    value={hours.close}
                    aria-label={`${LABELS[day]} closes at`}
                    onChange={(event) => {
                      update(day, { ...hours, close: event.target.value });
                    }}
                  />
                </span>
              ) : (
                <span className={styles.hoursTimes} aria-hidden="true" />
              )}
            </div>
          );
        })}
      </div>

      <p className={styles.hint}>
        A closing time before the opening one runs past midnight — 20:00 to 02:00 is a bar
        open late, not an empty day.
      </p>

      {error ? <p className={styles.error}>{error}</p> : null}
    </div>
  );
}
