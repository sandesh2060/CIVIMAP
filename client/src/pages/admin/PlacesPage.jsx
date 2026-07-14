// file: client/src/pages/admin/PlacesPage.jsx
import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import api from "../../services/api";
import { useLang } from "../../i18n/LanguageContext";
import { EASE } from "../../config/tokens";
import { useCachedFetch, invalidateCache } from "../../hooks/useCachedFetch";
import PlaceCategoryIcon from "../../components/places/PlaceCategoryIcon";
import PlaceLocationPicker from "../../components/places/PlaceLocationPicker";
import { SUGGESTED_CATEGORIES } from "../../utils/placeCategoryStyle";

// Fallback only — used while /places/categories is loading or if that
// call fails, so the page never renders an empty dropdown.
const FALLBACK_CATEGORIES = ["hospital", "school", "tourist", "sensitive", "custom"];

const NEW_CATEGORY_VALUE = "__new__"; // sentinel for the "+ Add new category" option

const EMPTY_FORM = {
  name: "",
  category: "hospital",
  lat: "",
  lng: "",
  description: "",
};

const CACHE_KEY = "admin:places";

async function loadPlaces() {
  const res = await api.get("/places");
  return res.data.data.places || [];
}

// The server stores location as GeoJSON — { type: "Point", coordinates:
// [lng, lat] } — not a flat { lat, lng } object.
function getLatLng(location) {
  if (!location) return null;
  if (Array.isArray(location.coordinates) && location.coordinates.length === 2) {
    const [lng, lat] = location.coordinates;
    if (typeof lat === "number" && typeof lng === "number") return { lat, lng };
    return null;
  }
  if (typeof location.lat === "number" && typeof location.lng === "number") {
    return { lat: location.lat, lng: location.lng };
  }
  return null;
}

export default function PlacesPage() {
  const { t } = useLang();

  const { data: placesData, loading, error, refresh, setData } = useCachedFetch(CACHE_KEY, loadPlaces);
  const places = placesData || [];

  const [categoryFilter, setCategoryFilter] = useState("all");
  const [query, setQuery] = useState("");

  const [categories, setCategories] = useState(FALLBACK_CATEGORIES);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState(null);

  // "+ Add new category" inline UI state
  const [addingCategory, setAddingCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [newCategoryError, setNewCategoryError] = useState(null);
  const [savingCategory, setSavingCategory] = useState(false);

  async function loadCategories() {
    try {
      const res = await api.get("/places/categories");
      const list = res.data?.data?.categories;
      if (Array.isArray(list) && list.length > 0) setCategories(list);
    } catch {
      // Keep whatever categories we already have — better a short list than none.
    }
  }

  useEffect(() => {
    loadCategories();
  }, []);

  const filtered = useMemo(() => {
    return places.filter((p) => {
      if (categoryFilter !== "all" && p.category !== categoryFilter) return false;
      if (query.trim() && !p.name.toLowerCase().includes(query.trim().toLowerCase())) return false;
      return true;
    });
  }, [places, categoryFilter, query]);

  function openCreate() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setFormError(null);
    setAddingCategory(false);
    setNewCategoryName("");
    setNewCategoryError(null);
    setModalOpen(true);
  }

  function openEdit(place) {
    const coords = getLatLng(place.location);
    setEditingId(place._id);
    setForm({
      name: place.name || "",
      category: place.category || "hospital",
      lat: coords ? String(coords.lat) : "",
      lng: coords ? String(coords.lng) : "",
      description: place.description || "",
    });
    setFormError(null);
    setAddingCategory(false);
    setNewCategoryName("");
    setNewCategoryError(null);
    setModalOpen(true);
  }

  function handleCategorySelect(value) {
    if (value === NEW_CATEGORY_VALUE) {
      setAddingCategory(true);
      setNewCategoryName("");
      setNewCategoryError(null);
      return;
    }
    setForm((f) => ({ ...f, category: value }));
  }

  async function handleCreateCategory() {
    const name = newCategoryName.trim().toLowerCase();
    if (name.length < 2) {
      setNewCategoryError(t("places.categoryTooShort") || "Category name is too short");
      return;
    }
    setSavingCategory(true);
    setNewCategoryError(null);
    try {
      const res = await api.post("/places/categories", { name });
      const created = res.data?.data?.category || name;
      setCategories((prev) => (prev.includes(created) ? prev : [...prev, created]));
      setForm((f) => ({ ...f, category: created }));
      setAddingCategory(false);
      setNewCategoryName("");
    } catch (err) {
      setNewCategoryError(err.response?.data?.message || t("places.categorySaveError") || "Couldn't add category");
    } finally {
      setSavingCategory(false);
    }
  }

  // Categories suggested but not yet used anywhere — offered as quick-add
  // shortcuts so admins don't have to retype e.g. "school_government"
  // from scratch. Purely a convenience list; typing anything else works too.
  const suggestedNotYetAdded = SUGGESTED_CATEGORIES.filter((c) => !categories.includes(c));

  async function handleSave() {
    setFormError(null);

    const lat = parseFloat(form.lat);
    const lng = parseFloat(form.lng);
    if (!form.name.trim()) {
      setFormError(t("places.nameRequired"));
      return;
    }
    if (Number.isNaN(lat) || Number.isNaN(lng)) {
      setFormError(t("places.locationRequired"));
      return;
    }

    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        category: form.category,
        location: { lat: lat, lng: lng },
        description: form.description.trim() || undefined,
      };

      if (editingId) {
        const res = await api.put("/places/" + editingId, payload);
        const updated = res.data.data.place;
        setData(places.map((p) => (p._id === editingId ? updated : p)));
      } else {
        const res = await api.post("/places", payload);
        const created = res.data.data.place;
        setData([created, ...places]);
      }
      invalidateCache("admin:overview"); // total place count changed
      setModalOpen(false);
    } catch (err) {
      setFormError(err.response && err.response.data ? err.response.data.message : t("places.saveError"));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id) {
    try {
      await api.delete("/places/" + id);
      setData(places.filter((p) => p._id !== id));
      invalidateCache("admin:overview");
    } catch (err) {
      console.error("Delete failed", err);
    }
  }

  if (error && places.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <p className="text-muted text-sm">{t("reports.errorLoading")}</p>
        <button onClick={refresh} className="px-4 h-10 rounded-lg text-white text-sm font-medium" style={{ background: "var(--np-crimson)" }}>
          {t("reports.retry")}
        </button>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-start justify-between gap-3 flex-wrap mb-5">
        <div>
          <h2 className="text-2xl font-display font-bold text-text">{t("places.heading")}</h2>
          <p className="text-muted mt-1">{t("places.subtitle")}</p>
        </div>
        <button onClick={openCreate} className="px-4 h-10 rounded-lg text-white text-sm font-medium" style={{ background: "var(--np-crimson)" }}>
          {t("places.addPlace")}
        </button>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted">
            <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="7" />
              <path d="M21 21l-4-4" strokeLinecap="round" />
            </svg>
          </span>
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t("places.searchPlaceholder")} className="w-full h-10 pl-10 pr-3 rounded-lg bg-surface border border-border focus:border-crimson outline-none transition text-sm" />
        </div>
        <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} className="h-10 px-3 rounded-lg bg-surface border border-border outline-none focus:border-crimson transition text-sm cursor-pointer">
          <option value="all">{t("reports.allCategories")}</option>
          {categories.map((c) => (
            <option key={c} value={c}>{t("places.category." + c) || c}</option>
          ))}
        </select>
      </div>

      <div className="bg-surface border border-border rounded-lg shadow-sm overflow-hidden">
        {loading && places.length === 0 ? (
          <div className="p-12 text-center text-muted text-sm">{t("common.loading")}…</div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center text-muted">{t("reports.noResults")}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-muted text-left border-b border-border">
                  <th className="font-medium px-5 py-3 w-12"></th>
                  <th className="font-medium px-3 py-3">{t("th.title")}</th>
                  <th className="font-medium px-3 py-3">{t("th.category")}</th>
                  <th className="font-medium px-3 py-3 hidden md:table-cell">{t("places.location")}</th>
                  <th className="font-medium px-5 py-3 w-24"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => {
                  const coords = getLatLng(p.location);
                  return (
                    <tr key={p._id} className="border-b border-border last:border-0 hover:bg-surface2 transition-colors">
                      <td className="pl-5 py-3">
                        <PlaceCategoryIcon category={p.category} size={26} />
                      </td>
                      <td className="px-3 py-3 font-medium text-text">{p.name}</td>
                      <td className="px-3 py-3 text-muted">{t("places.category." + p.category) || p.category}</td>
                      <td className="px-3 py-3 hidden md:table-cell text-muted">
                        {coords ? coords.lat.toFixed(4) + ", " + coords.lng.toFixed(4) : "—"}
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex justify-end gap-2">
                          <button onClick={() => openEdit(p)} className="text-xs font-medium px-2.5 h-8 rounded-md border border-border text-text hover:bg-surface2 transition">
                            {t("places.edit")}
                          </button>
                          <button onClick={() => handleDelete(p._id)} className="text-xs font-medium px-2.5 h-8 rounded-md border border-border text-text hover:bg-surface2 transition" style={{ color: "var(--np-crimson)" }}>
                            {t("places.delete")}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <AnimatePresence>
        {modalOpen && (
          <motion.div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setModalOpen(false)}>
            <motion.div
              initial={{ scale: 0.96, opacity: 0, y: 8 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.97, opacity: 0 }}
              transition={{ duration: 0.2, ease: EASE.out }}
              onClick={(e) => e.stopPropagation()}
              className="bg-surface border border-border rounded-xl w-full max-w-md p-5 max-h-[90vh] overflow-y-auto"
            >
              <h3 className="font-display text-lg font-semibold text-text mb-4">
                {editingId ? t("places.editPlace") : t("places.addPlace")}
              </h3>

              <div className="space-y-3">
                <div>
                  <label className="text-xs text-muted block mb-1">{t("th.title")}</label>
                  <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full h-10 px-3 rounded-lg bg-surface2 border border-transparent focus:border-border outline-none text-sm" />
                </div>

                <div>
                  <label className="text-xs text-muted block mb-1 flex items-center gap-2">
                    {t("th.category")}
                    <PlaceCategoryIcon category={form.category} size={18} />
                  </label>

                  {!addingCategory ? (
                    <select
                      value={form.category}
                      onChange={(e) => handleCategorySelect(e.target.value)}
                      className="w-full h-10 px-3 rounded-lg bg-surface2 border border-transparent focus:border-border outline-none text-sm"
                    >
                      {categories.map((c) => (
                        <option key={c} value={c}>{t("places.category." + c) || c}</option>
                      ))}
                      {suggestedNotYetAdded.length > 0 && (
                        <optgroup label={t("places.suggested") || "Suggested"}>
                          {suggestedNotYetAdded.map((c) => (
                            <option key={c} value={c} disabled>{c} — {t("places.notYetAdded") || "not added yet"}</option>
                          ))}
                        </optgroup>
                      )}
                      <option value={NEW_CATEGORY_VALUE}>+ {t("places.addNewCategory") || "Add new category"}</option>
                    </select>
                  ) : (
                    <div className="space-y-2">
                      <div className="flex gap-2">
                        <input
                          value={newCategoryName}
                          onChange={(e) => setNewCategoryName(e.target.value)}
                          placeholder={t("places.newCategoryPlaceholder") || "e.g. school_government"}
                          className="flex-1 h-10 px-3 rounded-lg bg-surface2 border border-transparent focus:border-border outline-none text-sm"
                        />
                        <button
                          type="button"
                          disabled={savingCategory}
                          onClick={handleCreateCategory}
                          className="px-3 h-10 rounded-lg text-sm font-medium text-white disabled:opacity-50"
                          style={{ background: "var(--np-crimson)" }}
                        >
                          {savingCategory ? "…" : (t("places.add") || "Add")}
                        </button>
                        <button
                          type="button"
                          onClick={() => setAddingCategory(false)}
                          className="px-3 h-10 rounded-lg text-sm font-medium border border-border text-text"
                        >
                          {t("places.cancel")}
                        </button>
                      </div>
                      {suggestedNotYetAdded.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                          {suggestedNotYetAdded.map((c) => (
                            <button
                              key={c}
                              type="button"
                              onClick={() => setNewCategoryName(c)}
                              className="text-xs px-2 py-1 rounded-full border border-border text-muted hover:bg-surface2 transition"
                            >
                              {c}
                            </button>
                          ))}
                        </div>
                      )}
                      {newCategoryError && (
                        <p className="text-xs font-medium" style={{ color: "var(--np-crimson)" }}>{newCategoryError}</p>
                      )}
                    </div>
                  )}
                </div>

                <div>
                  <label className="text-xs text-muted block mb-1">{t("places.location")}</label>
                  <PlaceLocationPicker
                    latValue={form.lat}
                    lngValue={form.lng}
                    category={form.category}
                    onLatChange={(v) => setForm((f) => ({ ...f, lat: v }))}
                    onLngChange={(v) => setForm((f) => ({ ...f, lng: v }))}
                    onPick={(coords) =>
                      setForm((f) => ({ ...f, lat: String(coords.lat), lng: String(coords.lng) }))
                    }
                  />
                </div>

                <div>
                  <label className="text-xs text-muted block mb-1">{t("places.description")}</label>
                  <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} className="w-full p-3 rounded-lg bg-surface2 border border-transparent focus:border-border outline-none text-sm resize-none" />
                </div>

                {formError && <p className="text-xs font-medium" style={{ color: "var(--np-crimson)" }}>{formError}</p>}
              </div>

              <div className="flex gap-2 mt-5">
                <button onClick={() => setModalOpen(false)} className="flex-1 h-11 rounded-lg text-sm font-medium border border-border text-text">
                  {t("places.cancel")}
                </button>
                <button disabled={saving} onClick={handleSave} className="flex-1 h-11 rounded-lg text-sm font-medium text-white disabled:opacity-50" style={{ background: "var(--np-crimson)" }}>
                  {saving ? t("places.saving") : t("places.save")}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}