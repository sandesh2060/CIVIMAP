// file: client/src/pages/admin/PlacesPage.jsx
import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import api from "../../services/api";
import { useLang } from "../../i18n/LanguageContext";
import { EASE } from "../../config/tokens";

const CATEGORIES = ["hospital", "school", "tourist", "sensitive", "custom"];

const EMPTY_FORM = {
  name: "",
  category: "hospital",
  lat: "",
  lng: "",
  description: "",
};

export default function PlacesPage() {
  const { t } = useLang();

  const [places, setPlaces] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [query, setQuery] = useState("");

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get("/places");
      setPlaces(res.data.data.places || []);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
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
    setModalOpen(true);
  }

  function openEdit(place) {
    setEditingId(place._id);
    setForm({
      name: place.name || "",
      category: place.category || "hospital",
      lat: place.location && place.location.lat !== undefined ? String(place.location.lat) : "",
      lng: place.location && place.location.lng !== undefined ? String(place.location.lng) : "",
      description: place.description || "",
    });
    setFormError(null);
    setModalOpen(true);
  }

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
        setPlaces((prev) => prev.map((p) => (p._id === editingId ? updated : p)));
      } else {
        const res = await api.post("/places", payload);
        const created = res.data.data.place;
        setPlaces((prev) => [created, ...prev]);
      }
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
      setPlaces((prev) => prev.filter((p) => p._id !== id));
    } catch (err) {
      console.error("Delete failed", err);
    }
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <p className="text-muted text-sm">{t("reports.errorLoading")}</p>
        <button onClick={load} className="px-4 h-10 rounded-lg text-white text-sm font-medium" style={{ background: "var(--np-crimson)" }}>
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
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>{t("places.category." + c)}</option>
          ))}
        </select>
      </div>

      <div className="bg-surface border border-border rounded-lg shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-muted text-sm">{t("common.loading")}…</div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center text-muted">{t("reports.noResults")}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-muted text-left border-b border-border">
                  <th className="font-medium px-5 py-3">{t("th.title")}</th>
                  <th className="font-medium px-3 py-3">{t("th.category")}</th>
                  <th className="font-medium px-3 py-3 hidden md:table-cell">{t("places.location")}</th>
                  <th className="font-medium px-5 py-3 w-24"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => (
                  <tr key={p._id} className="border-b border-border last:border-0 hover:bg-surface2 transition-colors">
                    <td className="px-5 py-3 font-medium text-text">{p.name}</td>
                    <td className="px-3 py-3 text-muted">{t("places.category." + p.category)}</td>
                    <td className="px-3 py-3 hidden md:table-cell text-muted">
                      {p.location ? p.location.lat.toFixed(4) + ", " + p.location.lng.toFixed(4) : "—"}
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
                ))}
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
              className="bg-surface border border-border rounded-xl w-full max-w-sm p-5"
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
                  <label className="text-xs text-muted block mb-1">{t("th.category")}</label>
                  <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="w-full h-10 px-3 rounded-lg bg-surface2 border border-transparent focus:border-border outline-none text-sm">
                    {CATEGORIES.map((c) => (
                      <option key={c} value={c}>{t("places.category." + c)}</option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs text-muted block mb-1">{t("places.lat")}</label>
                    <input value={form.lat} onChange={(e) => setForm({ ...form, lat: e.target.value })} placeholder="27.7172" className="w-full h-10 px-3 rounded-lg bg-surface2 border border-transparent focus:border-border outline-none text-sm" />
                  </div>
                  <div>
                    <label className="text-xs text-muted block mb-1">{t("places.lng")}</label>
                    <input value={form.lng} onChange={(e) => setForm({ ...form, lng: e.target.value })} placeholder="85.3240" className="w-full h-10 px-3 rounded-lg bg-surface2 border border-transparent focus:border-border outline-none text-sm" />
                  </div>
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