// file: client/src/utils/placeSearch.js
// Unified place search: merges the curated Places DB (hospitals, schools,
// government offices, etc. — verified Nepal data added by admins) with
// OpenStreetMap/Nominatim (free, nationwide, covers everything the
// curated DB doesn't) so typing either a specific address or a category
// ("school near me") returns one ranked, deduped list.

import { haversineKm, toLatLng } from "./geo";

// Keyword -> category, English + Nepali + common shorthand. Keep this in
// sync with the category set in server/src/seed/places.seed.js whenever
// a new category is added there. Longer/more specific phrases are listed
// so "bus stop" doesn't accidentally get out-matched by something else.
export const CATEGORY_KEYWORDS = {
  hospital: ["hospital", "अस्पताल", "clinic", "emergency room", "er"],
  school: ["school", "विद्यालय", "college", "कलेज", "campus"],
  pharmacy: ["pharmacy", "medicine", "औषधि", "medical store", "chemist"],
  bank_atm: ["atm", "एटिएम", "bank", "बैंक", "cash machine"],
  petrol_pump: ["petrol", "fuel", "gas station", "पेट्रोल", "इन्धन", "diesel"],
  police_station: ["police station", "police", "प्रहरी", "थाना"],
  government_office: [
    "ward office",
    "वडा कार्यालय",
    "government office",
    "सरकारी कार्यालय",
    "municipality",
    "नगरपालिका",
  ],
  transit_stop: ["bus stop", "bus park", "बस", "tempo", "microbus", "station"],
  historical: ["temple", "मन्दिर", "stupa", "durbar", "heritage", "monument"],
  library: ["library", "पुस्तकालय"],
  tourist: ["tourist", "viewpoint", "park", "पर्यटकीय"],
  sensitive: ["embassy", "दूतावास", "airport", "विमानस्थल"],
};

// Order matters: check multi-word / more specific phrases before short
// ones so "bus stop" doesn't get swallowed by a shorter unrelated match.
const CATEGORY_ENTRIES = Object.entries(CATEGORY_KEYWORDS).sort(
  (a, b) => Math.max(...b[1].map((w) => w.length)) - Math.max(...a[1].map((w) => w.length))
);

export function matchCategoryFromQuery(query) {
  const q = query.trim().toLowerCase();
  if (!q) return null;
  for (const [category, words] of CATEGORY_ENTRIES) {
    if (words.some((w) => q.includes(w.toLowerCase()))) return category;
  }
  return null;
}

const NOMINATIM_LIMIT = 8;

/**
 * Nationwide Nepal search via Nominatim, softly biased toward `origin`
 * (bounded=0, not a hard box) — results outside the bias area still come
 * back, just ranked lower once we distance-sort below. Restricted to
 * Nepal via countrycodes=np instead of a fixed Kathmandu-valley box, so
 * this now works for citizens anywhere in the country.
 *
 * NOTE: calling Nominatim directly from the browser is fine for demo
 * traffic but their usage policy expects light traffic and a real
 * Referer (browsers send this automatically). Proxy through a backend
 * /geocode route if this needs to scale — same pattern as mapController.js.
 */
export async function searchNominatim(query, origin, signal) {
  if (!query || query.trim().length < 3) return [];

  const params = new URLSearchParams({
    format: "json",
    limit: String(NOMINATIM_LIMIT),
    countrycodes: "np",
    q: query,
  });

  if (origin) {
    const pad = 0.4; // ~40km bias box at valley latitude — bias only, not a hard limit
    params.set("viewbox", `${origin.lng - pad},${origin.lat + pad},${origin.lng + pad},${origin.lat - pad}`);
    params.set("bounded", "0");
  }

  const res = await fetch(`https://nominatim.openstreetmap.org/search?${params.toString()}`, { signal });
  if (!res.ok) return [];
  const data = await res.json();

  return data.map((d) => ({
    id: `osm:${d.place_id}`,
    source: "osm",
    label: d.display_name.split(",").slice(0, 3).join(","),
    lat: parseFloat(d.lat),
    lng: parseFloat(d.lon),
    category: null,
  }));
}

/**
 * Searches the curated Places DB (already loaded client-side in MapPage)
 * by category (if the query matched one) or by name/category text
 * otherwise. This is the "verified" source, so these outrank raw OSM
 * matches for the same place.
 */
export function searchCuratedPlaces(places, query, matchedCategory) {
  const q = query.trim().toLowerCase();
  return places
    .filter((p) => {
      if (matchedCategory) return p.category === matchedCategory;
      return p.name?.toLowerCase().includes(q) || p.category?.toLowerCase().includes(q);
    })
    .map((p) => {
      const pos = toLatLng(p.location);
      return {
        id: `place:${p._id}`,
        source: "civimap",
        label: p.name,
        lat: pos?.[0],
        lng: pos?.[1],
        category: p.category,
        raw: p,
      };
    })
    .filter((p) => typeof p.lat === "number" && typeof p.lng === "number");
}

/** Distance-ranks a merged result list; unresolved distances sort last. */
export function rankResults(results, origin) {
  return results
    .map((r) => ({
      ...r,
      distanceKm: origin ? haversineKm([origin.lat, origin.lng], [r.lat, r.lng]) : null,
    }))
    .sort((a, b) => {
      if (a.distanceKm == null && b.distanceKm == null) return 0;
      if (a.distanceKm == null) return 1;
      if (b.distanceKm == null) return -1;
      return a.distanceKm - b.distanceKm;
    });
}

/** Drops OSM results that sit within ~60m of a curated result — avoids showing the same hospital twice. */
export function dedupeOsmAgainstCurated(osmResults, curatedResults) {
  return osmResults.filter(
    (o) => !curatedResults.some((c) => haversineKm([c.lat, c.lng], [o.lat, o.lng]) < 0.06)
  );
}

export default {
  CATEGORY_KEYWORDS,
  matchCategoryFromQuery,
  searchNominatim,
  searchCuratedPlaces,
  rankResults,
  dedupeOsmAgainstCurated,
};