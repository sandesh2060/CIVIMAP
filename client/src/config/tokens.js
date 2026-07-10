// file: client/src/config/tokens.js
// Single source of truth for values JS needs (Framer Motion, Leaflet, inline styles).

export const COLORS = {
  crimson: "#DC143C",
  crimsonHover: "#B01030",
  blue: "#003893",
  blueHover: "#002A6E",
  white: "#FFFFFF",
};

export const EASE = {
  smooth: [0.25, 0.1, 0.25, 1],
  slide: [0.65, 0, 0.35, 1],
  overshoot: [0.34, 1.4, 0.5, 1],
  out: [0.22, 1, 0.36, 1],
};

export const DUR = {
  fast: 0.2,
  base: 0.4,
  slow: 0.7,
};

export const RADIUS = { sm: 6, base: 10, lg: 16, xl: 24 };

export const LENIS_CONFIG = {
  duration: 1.2,
  easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
  smoothWheel: true,
};

export default { COLORS, EASE, DUR, RADIUS, LENIS_CONFIG };