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
}

/** Websites were entered without a scheme, so build one rather than link to a
 * relative path. */
function href(website: string): string {
  return /^https?:\/\//i.test(website) ? website : `https://${website}`;
}

function dayLabel(day: string): string {
  return day.charAt(0).toUpperCase() + day.slice(1, 3);
}

export function PlacePanel({ place, saved, onBack, onToggleSaved }: PlacePanelProps) {
  const { data: reviews = [], isFetching } = useListReviewsQuery(place.id);
  // The cover already appears as the hero above; the strip is for the rest.
  const photos = place.photos.filter((photo) => photo !== place.cover);

  return (
    <article className={styles.panel}>
      <button type="button" className={styles.backButton} onClick={onBack}>
        ← All places
      </button>

      <PlaceImage place={place} variant="hero" />

      <header className={styles.panelHead}>
        <h2 className={styles.panelTitle}>{place.name}</h2>
        <p className={styles.panelType}>
          {CATEGORY_META[categoryOf(place)].label} · {place.type}
        </p>
        <div className={styles.panelStats}>
          <Rating rating={place.rating} />
          <OpenBadge schedule={place.schedule} />
        </div>
      </header>

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

      {place.about ? <p className={styles.about}>{place.about}</p> : null}

      <dl className={styles.details}>
        {place.address ? (
          <div>
            <dt>Address</dt>
            <dd>{place.address}</dd>
          </div>
        ) : null}

        {place.phone ? (
          <div>
            <dt>Phone</dt>
            <dd>
              <a href={`tel:${place.phone.replace(/\s/g, "")}`}>{place.phone}</a>
            </dd>
          </div>
        ) : null}

        {place.website ? (
          <div>
            <dt>Website</dt>
            <dd>
              <a href={href(place.website)} target="_blank" rel="noreferrer noopener">
                {place.website}
              </a>
            </dd>
          </div>
        ) : null}

        <div>
          <dt>Coordinates</dt>
          <dd className={styles.mono}>
            {place.coords.lat.toFixed(5)}, {place.coords.lng.toFixed(5)}
          </dd>
        </div>
      </dl>

      {place.schedule ? (
        <details className={styles.hours}>
          <summary>Opening hours</summary>
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
        <h3 className={styles.sectionTitle}>Reviews</h3>
        <ReviewList reviews={reviews} loading={isFetching} />
      </section>
    </article>
  );
}
