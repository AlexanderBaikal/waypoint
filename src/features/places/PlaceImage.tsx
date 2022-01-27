import { useState } from "react";
import { CATEGORY_META, categoryOf } from "../../domain/categories";
import type { Place } from "../../domain/place";
import styles from "./places.module.css";

/**
 * Photography for this dataset lives in Firebase Storage, which currently
 * answers 402 for the whole bucket, and individual URLs rot anyway. Rather
 * than leave broken image frames around, a place without a usable photo gets
 * its category's colour and mark — a deliberate empty state instead of an
 * accident. If the bucket comes back, nothing here needs changing.
 *
 * The fallback used to be a gradient tinted from a hash of the place id, which
 * made a pretty column of pastels that meant nothing. The category colour says
 * something true, and it is the same colour the chips and the pins use.
 */
interface PlaceImageProps {
  place: Place;
  variant: "thumb" | "hero";
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
    const category = CATEGORY_META[categoryOf(place)];

    return (
      <div
        className={`${shape ?? ""} ${styles.placeholder ?? ""}`}
        style={{ "--cat": category.colour } as React.CSSProperties}
        aria-hidden="true"
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d={category.path} />
        </svg>
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
