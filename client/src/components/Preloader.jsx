import { motion } from "framer-motion";

export default function Preloader() {
  return (
    <motion.div
      className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-bg"
      initial={{ opacity: 1 }}
      animate={{ opacity: 0 }}
      transition={{ duration: 0.6, delay: 1.6 }}
    >
      <motion.svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 64 64"
        className="w-20 h-20"
        animate={{ scale: [1, 1.1, 1] }}
        transition={{ repeat: Infinity, duration: 1.2 }}
      >
        <path
          d="M32 4C20 4 11 13 11 25c0 14 21 35 21 35s21-21 21-35C53 13 44 4 32 4z"
          fill="#DC143C"
          stroke="#003893"
          strokeWidth="3"
        />
        <circle cx="32" cy="25" r="8" fill="#fff" />
      </motion.svg>
      <p className="mt-4 text-text font-semibold tracking-wide text-xl">CiviMap</p>
    </motion.div>
  );
}