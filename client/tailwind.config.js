export default {
  darkMode: "class",                 // 👈 toggles on a `.dark` class
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        // map Tailwind names to the CSS variables above
        bg:        "var(--bg)",
        surface:   "var(--surface)",
        surface2:  "var(--surface-2)",
        border:    "var(--border)",
        text:      "var(--text)",
        muted:     "var(--text-muted)",
        crimson:   "var(--np-crimson)",
        crimsonHover:"var(--np-crimson-hover)",
        blue:      "var(--np-blue)",
        blueHover: "var(--np-blue-hover)",
        crimsonSoft:"var(--crimson-soft)",
        blueSoft:  "var(--blue-soft)",
        onBrand:   "var(--text-on-brand)",
      },
    },
  },
  plugins: [],
}