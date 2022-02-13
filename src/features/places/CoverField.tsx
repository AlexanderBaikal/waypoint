import { useId, useState } from "react";
import { LIMITS, optional, webUrl } from "../../domain/placeInput";
import styles from "./placeForm.module.css";

interface CoverFieldProps {
  value: string | null;
  onChange: (cover: string | null) => void;
  error?: string;
}

/**
 * The field validates by showing the picture. Every string test for an image
 * URL (extension, host, content type) either rejects a working link or
 * accepts a dead one, and the browser settles the question in a moment anyway.
 */
export function CoverField({ value, onChange, error }: CoverFieldProps) {
  const id = useId();
  // Recorded against the address it belongs to, so a new address derives as
  // "loading" rather than needing an effect to reset the old outcome.
  const [outcome, setOutcome] = useState<{ url: string; ok: boolean } | null>(null);

  // Only try to load something that could be an image address; otherwise the
  // browser reports a broken image for what is really a typo mid-sentence.
  const candidate = value && webUrl(value) ? value : null;

  const status = !candidate
    ? "empty"
    : outcome?.url !== candidate
      ? "loading"
      : outcome.ok
        ? "ok"
        : "broken";

  return (
    <div className={styles.field}>
      <label className={styles.label} htmlFor={id}>
        Photo <span className={styles.optional}>optional</span>
      </label>

      <input
        id={id}
        value={value ?? ""}
        maxLength={LIMITS.cover}
        placeholder="https://…"
        inputMode="url"
        autoComplete="off"
        aria-invalid={(error ?? status === "broken") ? true : undefined}
        onChange={(event) => {
          onChange(optional(event.target.value));
        }}
      />

      <p className={styles.hint}>
        A link to a picture already on the web: right-click an image and copy its address.
        Nothing is uploaded, and a link that stops working falls back to the category
        tile.
      </p>

      {candidate ? (
        <div className={styles.preview} data-status={status}>
          <img
            // Keyed so a changed address gets a fresh element rather than a
            // reused one that keeps the previous picture on screen.
            key={candidate}
            src={candidate}
            alt=""
            referrerPolicy="no-referrer"
            onLoad={() => {
              setOutcome({ url: candidate, ok: true });
            }}
            onError={() => {
              setOutcome({ url: candidate, ok: false });
            }}
          />
          {status === "broken" ? (
            <p className={styles.previewNote}>
              That link did not load. It may be private, moved, or not an image.
            </p>
          ) : null}
        </div>
      ) : null}

      {error ? <p className={styles.error}>{error}</p> : null}
    </div>
  );
}
