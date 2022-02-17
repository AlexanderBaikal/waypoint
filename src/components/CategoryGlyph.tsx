import { CATEGORY_META, type Category } from "../domain/categories";

/**
 * A category's drawing, from the one table in categories.ts. The filter chip
 * and the placeholder tile both show it, and drawing it here is what keeps the
 * two the same mark rather than two marks that happen to share a path.
 *
 * `weight` is the one thing that legitimately differs. The drawing is stroked
 * on a 24px grid and shown at 12px on a chip and at 48px on a hero placeholder;
 * a stroke that reads at one of those sizes closes up or vanishes at the other.
 */
export function CategoryGlyph({
  category,
  weight,
}: {
  category: Category;
  weight: number;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={weight}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={CATEGORY_META[category].path} />
    </svg>
  );
}
