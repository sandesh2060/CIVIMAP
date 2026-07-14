// file: client/src/components/places/PlaceCategoryIcon.jsx
import { getCategoryStyle } from "../../utils/placeCategoryStyle";

// Small colored badge + icon for a place category. Used in the admin
// table (compact) and the location picker's marker preview (larger).
export default function PlaceCategoryIcon({ category, size = 28 }) {
  const { color, path } = getCategoryStyle(category);
  return (
    <span
      className="inline-flex items-center justify-center rounded-full shrink-0"
      style={{ width: size, height: size, background: color }}
      title={category}
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="white"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ width: size * 0.58, height: size * 0.58 }}
      >
        <path d={path} />
      </svg>
    </span>
  );
}