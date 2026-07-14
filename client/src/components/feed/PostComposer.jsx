import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import api from "../../services/api";
import FormField from "../ui/FormField";

const CATEGORIES = ["announcement", "road", "traffic", "safety", "maintenance", "other"];

const EMPTY = {
  title: "",
  titleNe: "",
  body: "",
  bodyNe: "",
  category: "announcement",
  isPinned: false,
  status: "published",
  commentsDisabled: false,
};

/**
 * Modal used for both creating and editing a post. Pass `post` to edit
 * an existing one; omit it to create a new one. `onSaved(post)` is
 * called with the created/updated post so the caller can update its list.
 *
 * Image now goes through the same file-picker + FormData pattern as
 * ReportForm.jsx, uploaded server-side via Cloudinary (config/cloudinary.js)
 * instead of taking a raw URL.
 */
export default function PostComposer({ post, onClose, onSaved }) {
  const isEdit = !!post;
  const [form, setForm] = useState(
    isEdit
      ? {
          title: post.title || "",
          titleNe: post.titleNe || "",
          body: post.body || "",
          bodyNe: post.bodyNe || "",
          category: post.category || "announcement",
          isPinned: !!post.isPinned,
          status: post.status || "published",
          commentsDisabled: !!post.commentsDisabled,
        }
      : EMPTY
  );

  // Image state kept separate from `form` since it's not a plain text field.
  const [imageFile, setImageFile] = useState(null); // newly picked File, or null
  const [imagePreviewUrl, setImagePreviewUrl] = useState(post?.imageUrl || null); // existing URL or new object URL
  const [removeImage, setRemoveImage] = useState(false); // explicit "clear existing image" flag, edit mode only

  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [apiError, setApiError] = useState(null);

  useEffect(() => {
    return () => {
      // only revoke object URLs we created ourselves, not the post's real imageUrl
      if (imageFile && imagePreviewUrl) URL.revokeObjectURL(imagePreviewUrl);
    };
  }, [imageFile, imagePreviewUrl]);

  function set(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  function handleFilePicked(file) {
    if (!file) return;
    setImageFile(file);
    setImagePreviewUrl(URL.createObjectURL(file));
    setRemoveImage(false);
  }

  function handleRemoveImage() {
    setImageFile(null);
    setImagePreviewUrl(null);
    setRemoveImage(true);
  }

  function validate() {
    const next = {};
    if (form.title.trim().length < 2) next.title = "Title must be at least 2 characters";
    if (form.title.trim().length > 150) next.title = "Title must be under 150 characters";
    if (form.body.trim().length < 2) next.body = "Body must be at least 2 characters";
    if (form.body.trim().length > 3000) next.body = "Body must be under 3000 characters";
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setApiError(null);
    if (!validate()) return;

    const body = new FormData();
    body.append("title", form.title.trim());
    body.append("titleNe", form.titleNe.trim());
    body.append("body", form.body.trim());
    body.append("bodyNe", form.bodyNe.trim());
    body.append("category", form.category);
    body.append("isPinned", String(form.isPinned));
    body.append("status", form.status);
    if (isEdit) body.append("commentsDisabled", String(form.commentsDisabled));

    if (imageFile) {
      body.append("image", imageFile);
    } else if (isEdit && removeImage) {
      body.append("removeImage", "true");
    }

    setSaving(true);
    try {
      let res;
      if (isEdit) {
        res = await api.patch(`/feed/posts/${post._id}`, body, {
          headers: { "Content-Type": "multipart/form-data" },
        });
      } else {
        res = await api.post("/feed/posts", body, {
          headers: { "Content-Type": "multipart/form-data" },
        });
      }
      onSaved(res.data.data.post);
    } catch (err) {
      setApiError(err.response?.data?.message || "Couldn't save the post. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <motion.div
        className="fixed inset-0 z-40 bg-black/40"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        onClick={onClose}
      />
      <motion.div
        className="fixed inset-x-0 bottom-0 sm:inset-0 sm:m-auto z-50 sm:max-w-2xl sm:h-fit w-full max-h-[90vh] overflow-y-auto bg-surface border border-border rounded-t-2xl sm:rounded-2xl shadow-lg"
        initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 40, opacity: 0 }}
        transition={{ duration: 0.25 }}
      >
        <form onSubmit={handleSubmit} className="p-6">
          <div className="flex items-center justify-between mb-5">
            <h3 className="font-display font-semibold text-lg">{isEdit ? "Edit post" : "New post"}</h3>
            <button type="button" onClick={onClose} className="w-9 h-9 grid place-items-center rounded-lg hover:bg-surface2 transition" aria-label="Close">
              <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-5">
            <div>
              <FormField
                id="post-title"
                label="Title"
                placeholder="e.g. Road closure on Ring Road"
                value={form.title}
                onChange={(e) => set("title", e.target.value)}
                error={errors.title}
                maxLength={150}
              />
              <div className="text-left mb-4">
                <label htmlFor="post-body" className="block text-sm font-medium text-text mb-2">Body</label>
                <textarea
                  id="post-body"
                  rows={5}
                  maxLength={3000}
                  value={form.body}
                  onChange={(e) => set("body", e.target.value)}
                  className="lux-input w-full py-3 px-4 rounded-xl text-sm outline-none resize-none"
                />
                {errors.body && <p className="text-sm font-medium mt-1" style={{ color: "var(--np-crimson)" }}>{errors.body}</p>}
              </div>
            </div>

            <div>
              <FormField
                id="post-title-ne"
                label="शीर्षक (Nepali, optional)"
                value={form.titleNe}
                onChange={(e) => set("titleNe", e.target.value)}
                maxLength={150}
              />
              <div className="text-left mb-4">
                <label htmlFor="post-body-ne" className="block text-sm font-medium text-text mb-2">
                  विवरण (Nepali, optional)
                </label>
                <textarea
                  id="post-body-ne"
                  rows={5}
                  maxLength={3000}
                  value={form.bodyNe}
                  onChange={(e) => set("bodyNe", e.target.value)}
                  className="lux-input w-full py-3 px-4 rounded-xl text-sm outline-none resize-none"
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
            <div className="text-left">
              <label className="block text-sm font-medium text-text mb-2">Category</label>
              <select
                value={form.category}
                onChange={(e) => set("category", e.target.value)}
                className="w-full h-10 px-3 rounded-lg bg-surface border border-border outline-none focus:border-crimson transition text-sm cursor-pointer"
              >
                {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>

            <div className="text-left">
              <label className="block text-sm font-medium text-text mb-2">Image (optional)</label>
              {imagePreviewUrl ? (
                <div className="flex items-center gap-3">
                  <img
                    src={imagePreviewUrl}
                    alt="Post"
                    className="w-16 h-16 rounded-lg object-cover border border-border"
                  />
                  <button
                    type="button"
                    onClick={handleRemoveImage}
                    className="text-sm underline"
                    style={{ color: "var(--np-crimson)" }}
                  >
                    Remove
                  </button>
                </div>
              ) : (
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => handleFilePicked(e.target.files?.[0] ?? null)}
                  className="w-full text-sm"
                />
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-5 mb-6">
            <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
              <input type="checkbox" checked={form.isPinned} onChange={(e) => set("isPinned", e.target.checked)} className="w-4 h-4" />
              Pin to top
            </label>
            <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
              <input
                type="radio"
                name="status"
                checked={form.status === "published"}
                onChange={() => set("status", "published")}
                className="w-4 h-4"
              />
              Publish now
            </label>
            <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
              <input
                type="radio"
                name="status"
                checked={form.status === "draft"}
                onChange={() => set("status", "draft")}
                className="w-4 h-4"
              />
              Save as draft
            </label>
            {isEdit && (
              <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
                <input type="checkbox" checked={form.commentsDisabled} onChange={(e) => set("commentsDisabled", e.target.checked)} className="w-4 h-4" />
                Disable comments
              </label>
            )}
          </div>

          {apiError && (
            <p className="text-sm font-medium mb-4" style={{ color: "var(--np-crimson)" }}>{apiError}</p>
          )}

          <div className="flex gap-2">
            <button
              type="submit"
              disabled={saving}
              className="flex-1 h-11 rounded-lg text-sm font-medium text-white disabled:opacity-50"
              style={{ background: "var(--np-crimson)" }}
            >
              {saving ? "Saving…" : isEdit ? "Save changes" : form.status === "draft" ? "Save draft" : "Publish post"}
            </button>
            <button type="button" onClick={onClose} className="h-11 px-5 rounded-lg text-sm font-medium border border-border">
              Cancel
            </button>
          </div>
        </form>
      </motion.div>
    </>
  );
}