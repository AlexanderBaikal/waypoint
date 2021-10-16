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
        // The dataset is 20 rows in a client-side array; filtering on each
        // keystroke costs nothing and debouncing would only add latency.
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
