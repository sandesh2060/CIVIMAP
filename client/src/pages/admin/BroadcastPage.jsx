// file: client/src/pages/admin/BroadcastPage.jsx
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import api from "../../services/api";
import Button from "../../components/ui/Button";
import FormField from "../../components/ui/FormField";

export default function BroadcastPage() {
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [apiError, setApiError] = useState(null);

  const validate = () => {
    const next = {};
    if (title.trim().length < 2) next.title = "Title must be at least 2 characters";
    if (title.trim().length > 120) next.title = "Title must be under 120 characters";
    if (message.trim().length < 2) next.message = "Message must be at least 2 characters";
    if (message.trim().length > 500) next.message = "Message must be under 500 characters";
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setResult(null);
    setApiError(null);
    if (!validate()) return;

    setLoading(true);
    try {
      const res = await api.post("/notifications/broadcast", {
        title: title.trim(),
        message: message.trim(),
      });
      setResult(res.data.data.recipientCount);
      setTitle("");
      setMessage("");
      setErrors({});
    } catch (err) {
      setApiError(
        err.response?.data?.message || "Failed to send broadcast. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-xl">
      <h2 className="font-display font-semibold text-xl mb-1">Send a broadcast</h2>
      <p className="text-sm text-muted mb-6">
        This message goes to every active citizen as an in-app notification.
      </p>

      <form onSubmit={handleSubmit} className="lux-card p-6 rounded-2xl">
        <FormField
          id="broadcast-title"
          label="Title"
          placeholder="e.g. Scheduled maintenance tonight"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          error={errors.title}
          maxLength={120}
        />

        <div className="mb-5 text-left">
          <label htmlFor="broadcast-message" className="block text-sm font-medium text-text mb-2">
            Message
          </label>
          <textarea
            id="broadcast-message"
            rows={4}
            maxLength={500}
            placeholder="Write the announcement citizens will see..."
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            className="lux-input w-full py-3.5 px-4 rounded-xl text-base text-text placeholder:text-placeholder outline-none resize-none"
          />
          <div className="flex justify-between mt-1.5">
            {errors.message ? (
              <p className="text-sm font-medium" style={{ color: "var(--np-crimson)" }}>
                {errors.message}
              </p>
            ) : (
              <span />
            )}
            <span className="text-xs text-muted">{message.length}/500</span>
          </div>
        </div>

        {apiError && (
          <p className="text-sm font-medium mb-4" style={{ color: "var(--np-crimson)" }}>
            {apiError}
          </p>
        )}

        <Button type="submit" loading={loading}>
          Send broadcast
        </Button>
      </form>

      <AnimatePresence>
        {result !== null && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.25 }}
            className="mt-4 px-4 py-3 rounded-xl border border-border bg-surface2 text-sm"
          >
            Sent to <strong>{result}</strong> citizen{result === 1 ? "" : "s"}.
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}