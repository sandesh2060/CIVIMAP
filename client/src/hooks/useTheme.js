import { useEffect, useState, useCallback } from "react";

export function useTheme() {
  const [theme, setThemeState] = useState(() => {
    const saved = localStorage.getItem("theme");
    if (saved) return saved;
    return window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  });

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    localStorage.setItem("theme", theme);
  }, [theme]);

  const setTheme = useCallback((next) => setThemeState(next), []);

  /**
   * Real circular "wipe" reveal, seeded from the exact pixel the user
   * clicked. Uses the native View Transitions API — the browser actually
   * snapshots old/new paint states and animates a true clip-path over them,
   * not a CSS opacity trick pretending to be a reveal.
   */
  const setThemeAnimated = useCallback((next, originEvent) => {
    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    if (!document.startViewTransition || reduceMotion) {
      setThemeState(next);
      return;
    }

    const x = originEvent?.clientX ?? window.innerWidth / 2;
    const y = originEvent?.clientY ?? window.innerHeight / 2;
    const endRadius = Math.hypot(
      Math.max(x, window.innerWidth - x),
      Math.max(y, window.innerHeight - y),
    );

    const transition = document.startViewTransition(() => {
      setThemeState(next);
    });

    transition.ready.then(() => {
      document.documentElement.animate(
        {
          clipPath: [
            `circle(0px at ${x}px ${y}px)`,
            `circle(${endRadius}px at ${x}px ${y}px)`,
          ],
        },
        {
          duration: 820,
          easing: "cubic-bezier(0.76, 0, 0.24, 1)",
          pseudoElement: "::view-transition-new(root)",
        },
      );
    });
  }, []);

  const toggle = useCallback(
    (originEvent) =>
      setThemeAnimated(theme === "light" ? "dark" : "light", originEvent),
    [theme, setThemeAnimated],
  );

  return { theme, setTheme, setThemeAnimated, toggle };
}
