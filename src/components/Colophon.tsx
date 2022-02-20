import styles from "./Colophon.module.css";

/** Where to find the person who wrote this. */
const GITHUB_URL = "https://github.com/AlexanderBaikal";
const AUTHOR = "Alexander Baikal";

/**
 * The byline, pinned under the panel's results.
 *
 * It sits outside the scroller so it is reachable without reading to the end of
 * a long list, and stays at the small print's grey: the credit should be
 * findable, not the loudest thing on a panel about places.
 *
 * GitHub's mark is drawn inline rather than kept in `glyphs.ts`, which is for
 * shapes this interface says more than once.
 */
export function Colophon() {
  return (
    <footer className={styles.colophon}>
      <a className={styles.link} href={GITHUB_URL} target="_blank" rel="noreferrer">
        <svg
          className={styles.icon}
          viewBox="0 0 16 16"
          fill="currentColor"
          aria-hidden="true"
        >
          <path d="M8 0a8 8 0 0 0-2.53 15.59c.4.07.55-.17.55-.38l-.01-1.34c-2.23.48-2.7-1.07-2.7-1.07-.36-.93-.89-1.18-.89-1.18-.73-.5.05-.49.05-.49.8.06 1.23.83 1.23.83.72 1.23 1.88.87 2.34.67.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82a7.6 7.6 0 0 1 4 0c1.53-1.03 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.28.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48l-.01 2.19c0 .21.15.46.55.38A8 8 0 0 0 8 0Z" />
        </svg>
        {AUTHOR}
      </a>
    </footer>
  );
}
