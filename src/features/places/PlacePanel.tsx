import { useListReviewsQuery } from "../../app/placesApi";
import { CATEGORY_META, categoryOf } from "../../domain/categories";
import { WEEKDAYS, type Place } from "../../domain/place";
import { OpenBadge } from "./OpenBadge";
import { PlaceImage, SafeImage } from "./PlaceImage";
import { Rating } from "./Rating";
import { ReviewList } from "./ReviewList";
import styles from "./places.module.css";

interface PlacePanelProps {
  place: Place;
  saved: boolean;
  onBack: () => void;
  onToggleSaved: (placeId: string) => void;
  /** False when this place is someone else's, or when nobody is signed in. */
  canEdit: boolean;
  onEdit: () => void;
  onReview: () => void;
}

/** Websites were entered without a scheme, so build one rather than link to a
 * relative path. */
function href(website: string): string {
  return /^https?:\/\//i.test(website) ? website : `https://${website}`;
}

function dayLabel(day: string): string {
  return day.charAt(0).toUpperCase() + day.slice(1, 3);
}

/**
 * Five 16px line glyphs, drawn here rather than pulled from an icon set: five
 * shapes do not justify a dependency, and inline paths inherit `currentcolor`
 * from the row they sit in.
 */
const PATHS = {
  address: (
    <>
      <path d="M8 14.5s5-4.2 5-8a5 5 0 0 0-10 0c0 3.8 5 8 5 8Z" />
      <circle cx="8" cy="6.4" r="1.9" />
    </>
  ),
  phone: (
    <path d="M3.3 2.6h2.3l1.1 2.9-1.4 1a8.6 8.6 0 0 0 3.9 3.9l1-1.4 2.9 1.1v2.3a1 1 0 0 1-1.1 1A11.4 11.4 0 0 1 2.3 3.7a1 1 0 0 1 1-1.1Z" />
  ),
  website: (
    <>
      <circle cx="8" cy="8" r="5.8" />
      <path d="M2.2 8h11.6M8 2.2a11.5 11.5 0 0 1 0 11.6 11.5 11.5 0 0 1 0-11.6" />
    </>
  ),
  hours: (
    <>
      <circle cx="8" cy="8" r="5.8" />
      <path d="M8 4.7V8l2.3 1.5" />
    </>
  ),
  coords: (
    <>
      <circle cx="8" cy="8" r="2.2" />
      <path d="M8 1.4v2.3M8 12.3v2.3M1.4 8h2.3M12.3 8h2.3" />
    </>
  ),
};

function Icon({ name }: { name: keyof typeof PATHS }) {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {PATHS[name]}
    </svg>
  );
}

export function PlacePanel({
  place,
  saved,
  onBack,
  onToggleSaved,
  canEdit,
  onEdit,
  onReview,
}: PlacePanelProps) {
  const { data: reviews = [], isFetching } = useListReviewsQuery(place.id);
  // The cover already appears as the hero above; the strip is for the rest.
  const photos = place.photos.filter((photo) => photo !== place.cover);
  const category = CATEGORY_META[categoryOf(place)];

  return (
    <article className={styles.panel}>
      <div className={styles.backBar}>
        <button type="button" className={styles.backButton} onClick={onBack}>
          ← All places
        </button>
      </div>

      <PlaceImage place={place} variant="hero" />

      <header className={styles.panelHead}>
        <h2 className={styles.panelTitle}>{place.name}</h2>
        <p
          className={styles.panelType}
          style={{ "--cat": category.colour } as React.CSSProperties}
        >
          {category.label} · {place.type}
        </p>
        <div className={styles.panelStats}>
          <Rating rating={place.rating} />
          <OpenBadge schedule={place.schedule} />
        </div>
      </header>

      <div className={styles.panelActions}>
        <button
          type="button"
          className={styles.saveButton}
          onClick={() => {
            onToggleSaved(place.id);
          }}
          aria-pressed={saved}
        >
          {saved ? "✦ Saved" : "✧ Save"}
        </button>

        {/* Only offered where it would work. A button that exists to tell you
            afterwards that you may not is worse than no button. */}
        {canEdit ? (
          <button type="button" className={styles.saveButton} onClick={onEdit}>
            Edit
          </button>
        ) : null}
      </div>

      {place.about ? <p className={styles.about}>{place.about}</p> : null}

      <dl className={styles.info}>
        {place.address ? (
          <div>
            <dt className={styles.infoIcon}>
              <Icon name="address" />
              <span className={styles.srOnly}>Address</span>
            </dt>
            <dd>{place.address}</dd>
          </div>
        ) : null}

        {place.phone ? (
          <div>
            <dt className={styles.infoIcon}>
              <Icon name="phone" />
              <span className={styles.srOnly}>Phone</span>
            </dt>
            <dd>
              <a href={`tel:${place.phone.replace(/\s/g, "")}`}>{place.phone}</a>
            </dd>
          </div>
        ) : null}

        {place.website ? (
          <div>
            <dt className={styles.infoIcon}>
              <Icon name="website" />
              <span className={styles.srOnly}>Website</span>
            </dt>
            <dd>
              <a href={href(place.website)} target="_blank" rel="noreferrer noopener">
                {place.website}
              </a>
            </dd>
          </div>
        ) : null}

        <div>
          <dt className={styles.infoIcon}>
            <Icon name="coords" />
            <span className={styles.srOnly}>Coordinates</span>
          </dt>
          <dd className={styles.mono}>
            {place.coords.lat.toFixed(5)}, {place.coords.lng.toFixed(5)}
          </dd>
        </div>
      </dl>

      {place.schedule ? (
        <details className={styles.hours}>
          <summary className={styles.infoRow}>
            <span className={styles.infoIcon}>
              <Icon name="hours" />
            </span>
            Opening hours
            <svg
              className={styles.chevron}
              width="12"
              height="12"
              viewBox="0 0 12 12"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M3 4.5 6 7.5l3-3" />
            </svg>
          </summary>
          <table>
            <tbody>
              {WEEKDAYS.map((day) => {
                const hours = place.schedule?.[day];
                if (!hours) return null;
                const text = hours.closed
                  ? "Closed"
                  : hours.allDay
                    ? "Open 24 hours"
                    : `${hours.open} – ${hours.close}`;

                return (
                  <tr key={day}>
                    <th scope="row">{dayLabel(day)}</th>
                    <td>{text}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </details>
      ) : null}

      {photos.length > 0 && (
        <section className={styles.section}>
          <h3 className={styles.sectionTitle}>Photos</h3>
          <div className={styles.photoStrip}>
            {photos.map((photo) => (
              <SafeImage key={photo} src={photo} />
            ))}
          </div>
        </section>
      )}

      <section className={styles.section}>
        <div className={styles.sectionHead}>
          <h3 className={styles.sectionTitle}>Reviews</h3>
          <button type="button" className={styles.textButton} onClick={onReview}>
            Write a review
          </button>
        </div>
        <ReviewList reviews={reviews} loading={isFetching} />
      </section>
    </article>
  );
}
