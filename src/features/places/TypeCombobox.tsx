import { useEffect, useId, useMemo, useRef, useState } from "react";
import { CATEGORY_META, categoryOf, type Category } from "../../domain/categories";
import styles from "./placeForm.module.css";

interface TypeComboboxProps {
  id: string;
  value: string;
  /** Every type already in the dataset, unsorted and with duplicates. */
  types: readonly string[];
  invalid: boolean;
  maxLength: number;
  onChange: (value: string) => void;
}

interface Suggestion {
  type: string;
  category: Category;
}

/** How many rows are drawn. Past this it is the query's job to narrow the list. */
const VISIBLE = 40;

/**
 * The type field, rendering its own suggestion list.
 *
 * A `<datalist>` did this job first, but its popup is drawn by the browser's UI
 * layer: on the dark interface it arrived white with dark text and no
 * stylesheet could reach it. Owning the list also allows matching on the
 * category a type belongs to, so typing "food" answers with the bakeries and
 * cafes.
 *
 * Still free text. The list can narrow to nothing and whatever was typed
 * stands; categories.ts maps an unrecognised type to `other`.
 */
export function TypeCombobox({
  id,
  value,
  types,
  invalid,
  maxLength,
  onChange,
}: TypeComboboxProps) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);

  const box = useRef<HTMLDivElement | null>(null);
  const list = useRef<HTMLUListElement | null>(null);

  const listId = useId();
  const optionId = (index: number) => `${listId}-${String(index)}`;

  const all = useMemo(() => {
    const seen = new Set<string>();
    const found: Suggestion[] = [];

    for (const raw of types) {
      const type = raw.trim();
      if (!type) continue;

      // Case-insensitively unique: the dataset holds both "Cafe" and "cafe".
      const key = type.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);

      found.push({ type, category: categoryOf({ type }) });
    }

    return found.sort((a, b) => a.type.localeCompare(b.type));
  }, [types]);

  const matches = useMemo(() => {
    const query = value.trim().toLowerCase();
    if (!query) return all.slice(0, VISIBLE);

    // Three tiers: types starting with the query, types containing it, then
    // the rest of a named category. Sorting is stable, so each tier keeps the
    // alphabetical order it arrived in.
    const ranked: { suggestion: Suggestion; tier: number }[] = [];

    for (const suggestion of all) {
      const type = suggestion.type.toLowerCase();
      const category = CATEGORY_META[suggestion.category].label.toLowerCase();

      const tier = type.startsWith(query)
        ? 0
        : type.includes(query)
          ? 1
          : category.includes(query)
            ? 2
            : -1;

      if (tier >= 0) ranked.push({ suggestion, tier });
    }

    ranked.sort((a, b) => a.tier - b.tier);
    return ranked.slice(0, VISIBLE).map((entry) => entry.suggestion);
  }, [all, value]);

  // Stored as an index, read clamped: the list narrows under the highlight as
  // the query grows, and the highlighted row has to be one that exists.
  const row = matches.length === 0 ? -1 : Math.min(active, matches.length - 1);

  // Pointer rather than click, so the list is gone by the time whatever was
  // clicked underneath it acts.
  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: PointerEvent) => {
      if (!box.current?.contains(event.target as Node)) setOpen(false);
    };

    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [open]);

  // Arrowing past the visible rows has to bring them with it.
  useEffect(() => {
    if (!open || row < 0) return;
    list.current?.children[row]?.scrollIntoView({ block: "nearest" });
  }, [open, row]);

  const choose = (suggestion: Suggestion) => {
    onChange(suggestion.type);
    setOpen(false);
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();

      if (!open) {
        setOpen(true);
        return;
      }
      if (matches.length === 0) return;

      const step = event.key === "ArrowDown" ? 1 : -1;
      setActive((row + step + matches.length) % matches.length);
      return;
    }

    if (event.key === "Enter" && open) {
      const suggestion = matches[row];
      if (!suggestion) return;

      // Enter takes the highlighted suggestion; without this it would also
      // submit the surrounding form.
      event.preventDefault();
      choose(suggestion);
      return;
    }

    if (event.key === "Escape" && open) setOpen(false);
  };

  return (
    <div className={styles.combo} ref={box}>
      <input
        id={id}
        value={value}
        maxLength={maxLength}
        autoComplete="off"
        placeholder="Cafe, Pharmacy, Bookshop…"
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={open}
        // Only while there is a list to point at.
        aria-controls={open ? listId : undefined}
        aria-activedescendant={open && matches[row] ? optionId(row) : undefined}
        aria-invalid={invalid ? true : undefined}
        onChange={(event) => {
          onChange(event.target.value);
          // A new query makes the old highlight meaningless.
          setActive(0);
          setOpen(true);
        }}
        onClick={() => {
          setOpen(true);
        }}
        onKeyDown={onKeyDown}
      />

      {/* Decorative: the field itself opens the list, so a real control here
          would only add a tab stop that repeats it. */}
      <svg className={styles.chevron} viewBox="0 0 24 24" aria-hidden="true">
        <path d="m7 10 5 5 5-5" />
      </svg>

      {open && matches.length > 0 ? (
        <ul className={styles.comboList} id={listId} role="listbox" ref={list}>
          {matches.map((suggestion, index) => (
            <li
              key={suggestion.type}
              id={optionId(index)}
              role="option"
              aria-selected={index === row}
              data-active={index === row}
              className={styles.comboOption}
              // Mouse down rather than click: it lands before the input loses
              // focus, so preventing the default keeps the caret in the field.
              onMouseDown={(event) => {
                event.preventDefault();
                choose(suggestion);
              }}
              onMouseEnter={() => {
                setActive(index);
              }}
            >
              <span
                className={styles.comboDot}
                style={{ background: CATEGORY_META[suggestion.category].colour }}
                aria-hidden="true"
              />
              <span className={styles.comboType}>{suggestion.type}</span>
              <span className={styles.comboCategory}>
                {CATEGORY_META[suggestion.category].label}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
