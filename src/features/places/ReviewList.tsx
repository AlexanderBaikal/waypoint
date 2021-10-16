import type { Review } from "../../domain/place";
import { SafeImage } from "./PlaceImage";
import styles from "./places.module.css";

const formatDate = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

function formatReviewDate(value: string | null): string | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : formatDate.format(date);
}

interface ReviewListProps {
  reviews: readonly Review[];
  loading: boolean;
}

export function ReviewList({ reviews, loading }: ReviewListProps) {
  if (loading) return <p className={styles.hint}>Loading reviews…</p>;
  if (reviews.length === 0) return <p className={styles.hint}>No reviews yet.</p>;

  return (
    <ul className={styles.reviews}>
      {reviews.map((review) => {
        const date = formatReviewDate(review.date);

        return (
          <li key={review.id} className={styles.review}>
            <div className={styles.reviewHead}>
              {review.author.photoUrl ? (
                <img
                  className={styles.avatar}
                  src={review.author.photoUrl}
                  alt=""
                  loading="lazy"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <span className={styles.avatarFallback} aria-hidden="true">
                  {review.author.name.charAt(0)}
                </span>
              )}

              <div>
                <p className={styles.reviewAuthor}>{review.author.name}</p>
                <p className={styles.reviewMeta}>
                  <span aria-label={`${String(review.rating)} out of 5`}>
                    {"★★★★★".slice(0, review.rating)}
                  </span>
                  {date ? ` · ${date}` : null}
                </p>
              </div>
            </div>

            <p className={styles.reviewText}>{review.text}</p>

            {review.photos.length > 0 && (
              <div className={styles.reviewPhotos}>
                {review.photos.map((photo) => (
                  <SafeImage key={photo} src={photo} />
                ))}
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
