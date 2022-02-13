import { useId, useState } from "react";
import { useAppDispatch } from "../../app/hooks";
import { errorMessage, useAddReviewMutation } from "../../app/placesApi";
import { editorClosed } from "../../app/uiSlice";
import {
  LIMITS,
  isValid,
  validateReview,
  type FieldErrors,
  type ReviewInput,
} from "../../domain/placeInput";
import { useWriteIdentity, writesAreLocal } from "../auth/useAuthor";
import styles from "./placeForm.module.css";

interface ReviewFormProps {
  placeId: string;
  placeName: string;
}

const SCORES = [1, 2, 3, 4, 5] as const;

export function ReviewForm({ placeId, placeName }: ReviewFormProps) {
  const dispatch = useAppDispatch();
  const { author } = useWriteIdentity();
  const [addReview, { isLoading, error: failure }] = useAddReviewMutation();

  const [input, setInput] = useState<ReviewInput>({ rating: 0, text: "" });
  const [errors, setErrors] = useState<FieldErrors<ReviewInput>>({});
  const id = useId();

  const submit = async (event: React.SyntheticEvent) => {
    event.preventDefault();
    if (!author) return;

    const found = validateReview(input);
    setErrors(found);
    if (!isValid(found)) return;

    try {
      await addReview({ placeId, input, author }).unwrap();
      dispatch(editorClosed());
    } catch {
      // Surfaced from the mutation's error state below.
    }
  };

  return (
    <form className={styles.form} onSubmit={(event) => void submit(event)} noValidate>
      <div className={styles.head}>
        <h2 className={styles.title}>Review {placeName}</h2>
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

      {/* A radio group rather than five buttons: arrow keys move between the
          scores, and a screen reader announces it as one question with five
          answers instead of five unrelated controls. */}
      <fieldset className={styles.field}>
        <legend className={styles.label}>Rating</legend>
        <div className={styles.stars}>
          {SCORES.map((score) => (
            <label key={score} className={styles.star}>
              <input
                type="radio"
                name={`${id}-rating`}
                value={score}
                checked={input.rating === score}
                onChange={() => {
                  setInput((previous) => ({ ...previous, rating: score }));
                  setErrors((previous) => ({ ...previous, rating: undefined }));
                }}
              />
              <span aria-hidden="true">{score <= input.rating ? "★" : "☆"}</span>
              <span className={styles.srOnly}>
                {score} star{score === 1 ? "" : "s"}
              </span>
            </label>
          ))}
        </div>
        {errors.rating ? <p className={styles.error}>{errors.rating}</p> : null}
      </fieldset>

      <div className={styles.field}>
        <label className={styles.label} htmlFor={`${id}-text`}>
          What was it like?
        </label>
        <textarea
          id={`${id}-text`}
          rows={4}
          value={input.text}
          maxLength={LIMITS.reviewText}
          aria-invalid={errors.text ? true : undefined}
          onChange={(event) => {
            const text = event.target.value;
            setInput((previous) => ({ ...previous, text }));
            setErrors((previous) => ({ ...previous, text: undefined }));
          }}
        />
        {errors.text ? <p className={styles.error}>{errors.text}</p> : null}
      </div>

      {failure ? (
        <p className={styles.failure} role="alert">
          {errorMessage(failure, "Could not post the review. Please try again.")}
        </p>
      ) : null}

      <div className={styles.actions}>
        <button type="submit" className={styles.primary} disabled={isLoading}>
          {isLoading ? "Posting…" : "Post review"}
        </button>
      </div>
    </form>
  );
}
