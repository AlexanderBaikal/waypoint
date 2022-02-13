import { useState } from "react";
import { CATEGORY_META, categoryOf } from "../../domain/categories";
import type { PhotoCredit, Place } from "../../domain/place";
import styles from "./places.module.css";

interface PlaceImageProps {
  place: Place;
  variant: "thumb" | "hero";
}

/**
 * Decorative photography with nothing sensible to show instead: a dead URL
 * removes the element rather than leaving a broken frame.
 */
export function SafeImage({ src }: { src: string }) {
  // Recorded against the address, so the outcome cannot outlive it. See below.
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  if (src === failedUrl) return null;

  return (
    <img
      src={src}
      alt=""
      loading="lazy"
      decoding="async"
      referrerPolicy="no-referrer"
      onError={() => {
        setFailedUrl(src);
      }}
    />
  );
}

/**
 * A place's cover, falling back to its category colour and mark when there is
 * no usable photograph. Most covers are borrowed from Wikimedia Commons by
 * scripts/import-photos.mjs and any link can rot, so the fallback is the normal
 * state rather than the error state.
 */
export function PlaceImage({ place, variant }: PlaceImageProps) {
  // The address that failed, not a flag: the hero is one component instance
  // reused for every place the panel opens, so a flag set by one dead cover
  // would hide the next place's working photograph behind a placeholder.
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const shape = variant === "hero" ? styles.hero : styles.thumb;
  // The address to draw, narrowed to null rather than tested twice, so the
  // `img` below is reached only where there is something to put in its `src`.
  const cover = place.cover === failedUrl ? null : place.cover;

  const category = CATEGORY_META[categoryOf(place)];

  const picture =
    cover === null ? (
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
    ) : (
      <img
        className={shape}
        src={cover}
        alt=""
        loading={variant === "hero" ? "eager" : "lazy"}
        decoding="async"
        referrerPolicy="no-referrer"
        onError={() => {
          setFailedUrl(cover);
        }}
      />
    );

  // Thumbnails are the picture alone, with no credit. The licences ask for
  // attribution "reasonable to the medium", which here is the panel the row
  // opens, one tap away.
  if (variant !== "hero") return picture;

  // The hero is always wrapped, photograph or placeholder, because the wrapper
  // is what breaks it out to both edges of the panel.
  //
  // The credit sits here rather than in the panel so it shares this component's
  // knowledge of what loaded: a photograph that did not must not leave a line
  // of attribution standing under a coloured placeholder.
  return (
    <figure className={styles.heroFigure}>
      {picture}
      {cover && place.coverCredit ? <PhotoCreditLine credit={place.coverCredit} /> : null}
    </figure>
  );
}

/**
 * What the photograph is, then who is owed for it. What it is leads because it
 * changes what the reader is looking at: most covers here are borrowed, either
 * from the surroundings or from the place's type, rather than being a picture
 * of the place.
 */
function PhotoCreditLine({ credit }: { credit: PhotoCredit }) {
  const attribution = [credit.author, credit.licence].filter(Boolean).join(", ");

  // At most one of these holds, which is the invariant PhotoCredit states and
  // readPhotoCredit enforces; written as one value so the panel cannot print
  // both.
  const subject = credit.generic
    ? "Generic photo, not of this place"
    : credit.nearbyMetres === null
      ? null
      : `Nearby · ${String(credit.nearbyMetres)} m away`;

  return (
    <figcaption className={styles.credit}>
      {subject ? <span className={styles.creditNearby}>{subject}</span> : null}
      {attribution ? <span>{attribution}</span> : null}
      {credit.sourceUrl ? (
        <a href={credit.sourceUrl} target="_blank" rel="noreferrer noopener">
          {credit.source}
        </a>
      ) : (
        <span>{credit.source}</span>
      )}
    </figcaption>
  );
}
