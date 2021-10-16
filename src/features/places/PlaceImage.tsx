import { useState } from "react";
import { CATEGORY_META, categoryOf } from "../../domain/categories";
import type { Place } from "../../domain/place";
import styles from "./places.module.css";

/**
 * Photography for this dataset lives in Firebase Storage, which currently
 * answers 402 for the whole bucket, and individual URLs rot anyway. Rather
 * than leave broken image frames around, a place without a usable photo gets a
 * tinted panel carrying its category mark — a deliberate empty state instead of
 * an accident. If the bucket comes back, nothing here needs changing.
 */
interface PlaceImageProps {
  place: Place;
  variant: "thumb" | "hero";
}

/** Stable per place, so a place keeps the same tint between renders. */
function tint(id: string): number {
  let hash = 0;
  for (let index = 0; index < id.length; index += 1) {
    hash = (hash * 31 + id.charCodeAt(index)) % 360;
  }
  // Kept in the warm quadrant so the placeholders sit inside the palette.
  return 18 + (hash % 34);
}

/**
 * For decorative photography where there is nothing sensible to show instead:
 * a dead URL removes the element rather than leaving a broken frame.
 */
export function SafeImage({ src }: { src: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) return null;

  return (
    <img
      src={src}
      alt=""
      loading="lazy"
      decoding="async"
      referrerPolicy="no-referrer"
      onError={() => {
        setFailed(true);
      }}
    />
  );
}

export function PlaceImage({ place, variant }: PlaceImageProps) {
  const [failed, setFailed] = useState(false);
  const shape = variant === "hero" ? styles.hero : styles.thumb;

  if (!place.cover || failed) {
    return (
      <div
        className={`${shape ?? ""} ${styles.placeholder ?? ""}`}
        style={{ "--tint": `${String(tint(place.id))}deg` } as React.CSSProperties}
        aria-hidden="true"
      >
        <span>{CATEGORY_META[categoryOf(place)].glyph}</span>
      </div>
    );
  }

  return (
    <img
      className={shape}
      src={place.cover}
      alt=""
      loading={variant === "hero" ? "eager" : "lazy"}
      decoding="async"
      onError={() => {
        setFailed(true);
      }}
    />
  );
}
