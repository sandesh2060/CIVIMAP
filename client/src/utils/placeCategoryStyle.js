// file: client/src/utils/placeCategoryStyle.js
//
// Maps a place category (free-text, admin-extensible — see
// placeController.addCategory) to a consistent icon + color, used by
// both the admin table (PlaceCategoryIcon) and the map picker
// (PlaceLocationPicker's colored markers). Keeping this in one shared
// module means both places always agree on what a category looks like.
//
// "school_government" / "school_private" are not separate DB concepts —
// Place.category is just a string — but treating them as distinct
// category *values* lets admins visually tell government vs private
// schools apart on both the table and the map without a schema change.

const PATHS = {
  hospital: "M12 2C8 2 5 5 5 9c0 5 7 13 7 13s7-8 7-13c0-4-3-7-7-7zM12 7v5M9.5 9.5h5",
  school_government: "M12 3 2 8l10 5 8-4v6M6 10v5c0 1.5 2.5 3 6 3s6-1.5 6-3v-5",
  school_private: "M12 3 2 8l10 5 8-4v6M6 10v5c0 1.5 2.5 3 6 3s6-1.5 6-3v-5",
  school: "M12 3 2 8l10 5 8-4v6M6 10v5c0 1.5 2.5 3 6 3s6-1.5 6-3v-5",
  temple: "M12 2l7 6H5l7-6zM6 8v12h12V8M9 20v-6h6v6",
  tourist: "M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13 6-3m-6 3V7m6 10 4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7",
  sensitive: "M12 2 1 21h22L12 2zM12 9v5M12 17h.01",
  government_office: "M4 21h16M6 21V9l6-4 6 4v12M9 21v-6h6v6",
  police_station: "M12 2l8 3v6c0 5-3.5 9-8 11-4.5-2-8-6-8-11V5l8-3z",
  bank_atm: "M3 10l9-6 9 6M5 10v9h14v-9M9 14v3M15 14v3",
  transit_stop: "M4 16V6a2 2 0 012-2h12a2 2 0 012 2v10M4 16a2 2 0 002 2h1l1 3h8l1-3h1a2 2 0 002-2M4 16h16M7 12h10",
  petrol_pump: "M4 21V6a2 2 0 012-2h6a2 2 0 012 2v15M4 21h10M15 8h2l3 3v6a1.5 1.5 0 01-3 0v-2h-2",
  library: "M4 4v16M4 4l6 2v14l-6-2M20 4v16M20 4l-6 2v14l6-2M10 6l4 0",
  historical: "M4 21h16M6 21V10M10 21V10M14 21V10M18 21V10M4 10l8-6 8 6",
  custom: "M12 2C8 2 5 5 5 9c0 5 7 13 7 13s7-8 7-13c0-4-3-7-7-7zM12 12a3 3 0 100-6 3 3 0 000 6z",
};

const COLORS = {
  hospital: "#e53e3e",
  school_government: "#1d4ed8",
  school_private: "#7c3aed",
  school: "#2563eb",
  temple: "#b8860b",
  tourist: "#0d9488",
  sensitive: "#991b1b",
  government_office: "#1e3a5f",
  police_station: "#1e293b",
  bank_atm: "#15803d",
  transit_stop: "#c2410c",
  petrol_pump: "#b45309",
  library: "#78350f",
  historical: "#92400e",
  custom: "#6b7280",
};

const DEFAULT_COLOR = "#6b7280"; // gray — any category not in the table above

export function getCategoryStyle(category) {
  const key = (category || "custom").trim().toLowerCase();
  return {
    key,
    color: COLORS[key] || DEFAULT_COLOR,
    path: PATHS[key] || PATHS.custom,
  };
}

// Suggested categories shown in the "+ Add new category" flow, on top of
// whatever already exists in the DB / server defaults. Purely a UX
// nicety — any string is a valid category server-side.
export const SUGGESTED_CATEGORIES = [
  "hospital",
  "school_government",
  "school_private",
  "temple",
  "tourist",
  "sensitive",
  "government_office",
  "police_station",
  "bank_atm",
  "transit_stop",
  "petrol_pump",
  "library",
  "historical",
  "custom",
];