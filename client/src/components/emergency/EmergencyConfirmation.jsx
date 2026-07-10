// file: client/src/components/emergency/EmergencyConfirmation.jsx
import { motion } from "framer-motion";
import { useLang } from "../../i18n/LanguageContext";
import { EASE } from "../../config/tokens";

const CHANNEL_LABEL = { email: "emergency.channelEmail", whatsapp: "emergency.channelWhatsapp" };

export default function EmergencyConfirmation({ department, channelsUsed, onResolve, onSendAnother, resolved }) {
  const { t } = useLang();

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3, ease: EASE.out }}
      className="bg-surface border border-border rounded-2xl p-6 text-center space-y-4"
    >
      <span
        className="w-14 h-14 mx-auto rounded-full grid place-items-center"
        style={{ background: "#e6f4ea", color: "#1e7e34" }}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
             strokeLinecap="round" strokeLinejoin="round" className="w-7 h-7">
          <path d="M20 6L9 17l-5-5" />
        </svg>
      </span>

      <div>
        <h3 className="font-display text-lg font-semibold text-text">
          {t("emergency.dispatched")}
        </h3>
        <p className="text-sm text-muted mt-1">
          {t("emergency.reachedDepartment", { department: department?.name || "" })}
        </p>
      </div>

      {!!channelsUsed?.length && (
        <div className="flex justify-center gap-2 flex-wrap">
          {channelsUsed.map((ch) => (
            <span
              key={ch}
              className="px-3 py-1 rounded-full text-xs font-medium"
              style={{ background: "var(--crimson-soft)", color: "var(--np-crimson)" }}
            >
              {t(CHANNEL_LABEL[ch] || ch)}
            </span>
          ))}
        </div>
      )}

      <div className="flex gap-2 pt-2">
        <button
          onClick={onResolve}
          disabled={resolved}
          className="flex-1 h-11 rounded-lg text-sm font-medium border border-border text-text disabled:opacity-50"
        >
          {resolved ? t("emergency.markedResolved") : t("emergency.markResolved")}
        </button>
        <button
          onClick={onSendAnother}
          className="flex-1 h-11 rounded-lg text-sm font-medium text-white"
          style={{ background: "var(--np-crimson)" }}
        >
          {t("emergency.sendAnother")}
        </button>
      </div>
    </motion.div>
  );
}