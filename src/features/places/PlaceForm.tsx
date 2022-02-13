import { useId, useState } from "react";
import { useAppDispatch } from "../../app/hooks";
import {
  errorMessage,
  useCreatePlaceMutation,
  useUpdatePlaceMutation,
} from "../../app/placesApi";
import { editorClosed, placeSelected } from "../../app/uiSlice";
import type { Place } from "../../domain/place";
import {
  LIMITS,
  blankPlace,
  isValid,
  optional,
  toInput,
  validatePlace,
  type FieldErrors,
  type PlaceInput,
} from "../../domain/placeInput";
import { useWriteIdentity, writesAreLocal } from "../auth/useAuthor";
import { CoverField } from "./CoverField";
import { HoursEditor } from "./HoursEditor";
import { LocationPicker } from "./LocationPicker";
import { TypeCombobox } from "./TypeCombobox";
import styles from "./placeForm.module.css";

interface PlaceFormProps {
  /** Absent when adding; the place being changed when editing. */
  place: Place | null;
  /** Where a new place starts, so it is not dropped on another continent. */
  origin: { lat: number; lng: number };
  /** Types already in the dataset, offered as suggestions rather than a list. */
  knownTypes: readonly string[];
}

export function PlaceForm({ place, origin, knownTypes }: PlaceFormProps) {
  const dispatch = useAppDispatch();
  const { author } = useWriteIdentity();

  const [create, creating] = useCreatePlaceMutation();
  const [update, updating] = useUpdatePlaceMutation();
  const saving = creating.isLoading || updating.isLoading;
  const failure = creating.error ?? updating.error;

  const [input, setInput] = useState<PlaceInput>(() =>
    place ? toInput(place) : blankPlace(origin),
  );
  // Empty until the first attempt: telling someone their name is missing
  // before they have typed it is not help.
  const [errors, setErrors] = useState<FieldErrors<PlaceInput>>({});

  const id = useId();
  const field = (name: string) => `${id}-${name}`;

  const set = <K extends keyof PlaceInput>(key: K, value: PlaceInput[K]) => {
    setInput((previous) => ({ ...previous, [key]: value }));
    // Clear this field's complaint as soon as it is being addressed.
    setErrors((previous) => ({ ...previous, [key]: undefined }));
  };

  const submit = async (event: React.SyntheticEvent) => {
    event.preventDefault();
    if (!author) return;

    const found = validatePlace(input);
    setErrors(found);
    if (!isValid(found)) return;

    try {
      if (place) {
        await update({ placeId: place.id, input, author }).unwrap();
        dispatch(editorClosed());
      } else {
        const created = await create({ input, author }).unwrap();
        // Land on what was just added rather than back in an empty list.
        dispatch(placeSelected(created.id));
      }
    } catch {
      // Surfaced from the mutation's own error state below.
    }
  };

  return (
    <form className={styles.form} onSubmit={(event) => void submit(event)} noValidate>
      <div className={styles.head}>
        <h2 className={styles.title}>{place ? `Edit ${place.name}` : "Add a place"}</h2>
        <button
          type="button"
          className={styles.linkButton}
          onClick={() => dispatch(editorClosed())}
        >
          Cancel
        </button>
      </div>

      {writesAreLocal ? (
        <p className={styles.notice}>
          No database is configured, so this is saved in your browser and stays there.
        </p>
      ) : null}

      <div className={styles.field}>
        <label className={styles.label} htmlFor={field("name")}>
          Name
        </label>
        <input
          id={field("name")}
          value={input.name}
          maxLength={LIMITS.name}
          autoComplete="off"
          aria-invalid={errors.name ? true : undefined}
          onChange={(event) => {
            set("name", event.target.value);
          }}
        />
        {errors.name ? <p className={styles.error}>{errors.name}</p> : null}
      </div>

      <div className={styles.field}>
        <label className={styles.label} htmlFor={field("type")}>
          Type
        </label>
        {/* Suggestions, not a closed list: the taxonomy in categories.ts maps
            whatever is typed, and an unrecognised type is still a place. */}
        <TypeCombobox
          id={field("type")}
          value={input.type}
          types={knownTypes}
          maxLength={LIMITS.type}
          invalid={Boolean(errors.type)}
          onChange={(type) => {
            set("type", type);
          }}
        />
        <p className={styles.hint}>
          Search by type, or by category: “food” finds the bakeries.
        </p>
        {errors.type ? <p className={styles.error}>{errors.type}</p> : null}
      </div>

      <div className={styles.field}>
        <span className={styles.label}>Where it is</span>
        <LocationPicker
          value={input.coords}
          onChange={(coords) => {
            set("coords", coords);
          }}
        />
        <p className={styles.coords} aria-live="polite">
          {input.coords.lat.toFixed(5)}, {input.coords.lng.toFixed(5)}
        </p>
        {errors.coords ? <p className={styles.error}>{errors.coords}</p> : null}
      </div>

      <CoverField
        value={input.cover}
        error={errors.cover}
        onChange={(cover) => {
          set("cover", cover);
        }}
      />

      <div className={styles.field}>
        <label className={styles.label} htmlFor={field("address")}>
          Address <span className={styles.optional}>optional</span>
        </label>
        <input
          id={field("address")}
          value={input.address ?? ""}
          maxLength={LIMITS.address}
          onChange={(event) => {
            set("address", optional(event.target.value));
          }}
        />
        {errors.address ? <p className={styles.error}>{errors.address}</p> : null}
      </div>

      <div className={styles.row}>
        <div className={styles.field}>
          <label className={styles.label} htmlFor={field("phone")}>
            Phone <span className={styles.optional}>optional</span>
          </label>
          <input
            id={field("phone")}
            type="tel"
            value={input.phone ?? ""}
            maxLength={LIMITS.phone}
            onChange={(event) => {
              set("phone", optional(event.target.value));
            }}
          />
          {errors.phone ? <p className={styles.error}>{errors.phone}</p> : null}
        </div>

        <div className={styles.field}>
          <label className={styles.label} htmlFor={field("website")}>
            Website <span className={styles.optional}>optional</span>
          </label>
          <input
            id={field("website")}
            value={input.website ?? ""}
            maxLength={LIMITS.website}
            placeholder="example.com"
            aria-invalid={errors.website ? true : undefined}
            onChange={(event) => {
              set("website", optional(event.target.value));
            }}
          />
          {errors.website ? <p className={styles.error}>{errors.website}</p> : null}
        </div>
      </div>

      <div className={styles.field}>
        <label className={styles.label} htmlFor={field("about")}>
          About <span className={styles.optional}>optional</span>
        </label>
        <textarea
          id={field("about")}
          rows={3}
          value={input.about ?? ""}
          maxLength={LIMITS.about}
          onChange={(event) => {
            set("about", optional(event.target.value));
          }}
        />
        {errors.about ? <p className={styles.error}>{errors.about}</p> : null}
      </div>

      <HoursEditor
        value={input.schedule}
        error={errors.schedule}
        onChange={(schedule) => {
          set("schedule", schedule);
        }}
      />

      {failure ? (
        <p className={styles.failure} role="alert">
          {errorMessage(failure, "Could not save. Please try again.")}
        </p>
      ) : null}

      <div className={styles.actions}>
        <button type="submit" className={styles.primary} disabled={saving}>
          {saving ? "Saving…" : place ? "Save changes" : "Add place"}
        </button>
      </div>
    </form>
  );
}
