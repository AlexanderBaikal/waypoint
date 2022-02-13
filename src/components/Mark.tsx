/**
 * The application's mark: the pin, used wherever it stands for Waypoint rather
 * than for a place. `public/favicon.svg` holds a copy, since it cannot import.
 *
 * One path with the hole punched out by the even-odd rule, so the mark carries
 * no background of its own and can sit on the panel, a colour wash or a
 * photograph. Colour comes from `currentcolor`.
 */
export function Mark({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="7 2.5 18 26.5"
      fill="currentColor"
      aria-hidden="true"
    >
      <path
        fillRule="evenodd"
        d="M16 28.5c-.1 0-9-10.6-9-16.8a9 9 0 1 1 18 0c0 6.2-8.9 16.8-9 16.8Zm0-13.5a3.4 3.4 0 1 0 0-6.8 3.4 3.4 0 0 0 0 6.8Z"
      />
    </svg>
  );
}
