/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        bg:           "var(--bg)",
        surface:      "var(--surface)",
        surface2:     "var(--surface-2)",
        border:       "var(--border)",
        text:         "var(--text)",
        muted:        "var(--text-muted)",
        onBrand:      "var(--text-on-brand)",
        crimson:      "var(--np-crimson)",
        crimsonHover: "var(--np-crimson-hover)",
        crimsonSoft:  "var(--crimson-soft)",
        blue:         "var(--np-blue)",
        blueHover:    "var(--np-blue-hover)",
        blueSoft:     "var(--blue-soft)",
         faint: "var(--text-faint)",
      },
      fontFamily: {
        sans:    "var(--font-sans)",
        display: "var(--font-display)",
        nepali:  "var(--font-nepali)",
      },
      borderRadius: {
        DEFAULT: "var(--radius)",
        sm:      "var(--radius-sm)",
        lg:      "var(--radius-lg)",
        xl:      "var(--radius-xl)",
      },
      boxShadow: {
        sm:      "var(--shadow-sm)",
        DEFAULT: "var(--shadow)",
        lg:      "var(--shadow-lg)",
      },
    },
  },
  plugins: [],
}