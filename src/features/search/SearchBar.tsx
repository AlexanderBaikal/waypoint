import { useId } from "react";
import styles from "./search.module.css";

interface SearchBarProps {
  value: string;
  resultCount: number;
  onChange: (value: string) => void;
}

export function SearchBar({ value, resultCount, onChange }: SearchBarProps) {
  const id = useId();

  return (
    <div className={styles.search}>
      <label className={styles.srOnly} htmlFor={id}>
        Search places
      </label>

      <input
        id={id}
        className={styles.input}
        type="search"
        value={value}
        placeholder="Search places"
        autoComplete="off"
        // Not debounced: the caller defers the filtering pass instead, which
        // keeps the field responsive without a fixed delay on the results.
        onChange={(event) => {
          onChange(event.target.value);
        }}
        aria-describedby={`${id}-count`}
      />

      {/* After the field in the DOM, in front of it on screen, so a sibling
          selector can tint the magnifier while the field has the caret. */}
      <svg
        className={styles.icon}
        viewBox="0 0 16 16"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        aria-hidden="true"
      >
        <circle cx="7" cy="7" r="4.75" />
        <path d="M10.5 10.5 14 14" />
      </svg>

      {value ? (
        <button
          type="button"
          className={styles.clear}
          onClick={() => {
            onChange("");
          }}
          aria-label="Clear search"
        >
          ×
        </button>
      ) : null}

      <span id={`${id}-count`} className={styles.srOnly} role="status">
        {resultCount} results
      </span>
    </div>
  );
}
