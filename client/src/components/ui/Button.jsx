import { motion } from "framer-motion";

const VARIANTS = {
  primary: "lux-btn-primary",
  secondary: "lux-btn-secondary",
  ghost: "lux-btn-ghost",
};

export default function Button({
  children,
  variant = "primary",
  type = "button",
  icon,
  loading = false,
  disabled = false,
  className = "",
  ...props
}) {
  return (
    <motion.button
      type={type}
      whileHover={{ scale: disabled || loading ? 1 : 1.015 }}
      whileTap={{ scale: disabled || loading ? 1 : 0.985 }}
      transition={{ duration: 0.15 }}
      disabled={disabled || loading}
      className={`${VARIANTS[variant]} w-full py-3.5 rounded-xl text-base font-semibold flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
      {...props}
    >
      {loading ? (
        <span className="w-4 h-4 rounded-full border-2 border-current border-t-transparent animate-spin" />
      ) : (
        <>
          {children}
          {icon}
        </>
      )}
    </motion.button>
  );
}