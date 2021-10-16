import type { Rating as RatingValue } from "../../domain/place";
import styles from "./places.module.css";

const formatCount = new Intl.NumberFormat("en-US");

export function Rating({ rating }: { rating: RatingValue | null }) {
  if (!rating) return null;

  const rounded = Math.round(rating.value);

  return (
    <span className={styles.rating}>
      <span className={styles.ratingValue}>{rating.value.toFixed(1)}</span>
      <span className={styles.stars} aria-hidden="true">
        {"★★★★★".slice(0, rounded)}
        <span className={styles.starsEmpty}>{"★★★★★".slice(rounded)}</span>
      </span>
      <span className={styles.ratingCount}>
        {formatCount.format(rating.count)} review{rating.count === 1 ? "" : "s"}
      </span>
    </span>
  );
}
