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

      <input
        id={id}
        className={styles.input}
        type="search"
        value={value}
        placeholder="Search places"
        autoComplete="off"
        // Not debounced: the caller defers the filtering pass instead, so the
        // field stays responsive without holding results back by a fixed delay.
        onChange={(event) => {
          onChange(event.target.value);
        }}
        aria-describedby={`${id}-count`}
      />

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
