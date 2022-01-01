import type { Rating as RatingValue } from "../../domain/place";
import styles from "./places.module.css";

const formatCount = new Intl.NumberFormat("en-US");

/**
 * A number, a star and a count. Five stars are a bar chart of one value drawn
 * in a third of a row, and they round away the difference between 4.4 and 4.6
 * — the number does not.
 *
 * The whole thing is one `img` node to a screen reader: read out piece by
 * piece it comes through as "4.4 star 1,501", which is not a sentence.
 */
export function Rating({ rating }: { rating: RatingValue | null }) {
  if (!rating) return null;

  const value = rating.value.toFixed(1);
  const count = formatCount.format(rating.count);

  return (
    <span
      className={styles.rating}
      role="img"
      aria-label={`Rated ${value} out of 5, from ${count} review${rating.count === 1 ? "" : "s"}`}
    >
      <span className={styles.ratingValue}>{value}</span>
      <span className={styles.star}>★</span>
      <span className={styles.ratingCount}>({count})</span>
    </span>
  );
}
