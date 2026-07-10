// file: client/src/components/Preloader.jsx
//
// CIVIMAP splash preloader — Google Maps-style pin drop.
//
// This replaces the previous dual-spring "fly in from off-screen" version
// with the animation people actually recognize as "the Google pin":
//   1. The pin free-falls from above with an ease-in (gravity) curve.
//   2. On landing it squashes and does one small bounce (pure CSS keyframes,
//      the same trick Google's own marker-drop uses — no physics sim needed).
//   3. A soft ground shadow grows under it as it falls, then contracts to
//      settle, giving the landing weight.
//   4. The white center dot pops in right after the pin settles.
//   5. The wordmark fades up last.
//
// Sizing: the logo is now driven by a single `size` prop (default 64px
// wide), scaled to the pin's real aspect ratio (200:240 from the source
// paths), instead of the fixed 140x168 box the old halo version used —
// that box was oversized relative to the actual mark, which is why it
// looked bloated in the screenshot.
//
// Nepali touch: a two-layer Himalaya silhouette (a lighter, farther range
// behind a darker, nearer one) fades in behind the pin as the ground it
// lands on, with a small white snow cap on the tallest peak as an Everest
// nod. The pin shape itself is untouched. Colors are overridable via
// --mtn-back / --mtn-front CSS variables if you want them to match a
// specific brand palette; otherwise sensible slate-blue fallbacks are used.
//
// Bugfix: the previous version's white center dot could animate outside
// the frame because `transform-origin: 50% 50%` on an SVG element with no
// `transform-box` resolves against the whole SVG viewport, not the dot's
// own bounding box — same for the pin's translateY(-46%), which was being
// measured against viewport height, not a stable reference. Both now use
// `transform-box: fill-box` plus fixed-unit (not %) translate distances.
//
// Pure DOM + SVG + CSS keyframes. No rAF loop, no extra dependency.

import React, { useState, useCallback, useEffect, useMemo, useRef } from "react";

// Total on-screen time before we start the fade-out exit transition.
// (drop 480ms + bounce 260ms + dot 220ms + word 300ms + a short hold)
const MIN_DISPLAY_MS = 1450;
const EXIT_MS = 420;

const PIN_PATH =
  "M100,26 C138,26 168,55 168,90 C168,132 100,214 100,214 C100,214 32,132 32,90 C32,55 62,26 100,26 Z";

// viewBox is 200 x 240 -> aspect ratio height = width * 1.2
const ASPECT = 1.2;

const buildCss = (widthPx) => {
  const w = widthPx;
  const h = Math.round(widthPx * ASPECT);

  return `
  .civi-preloader {
    position: fixed;
    inset: 0;
    z-index: 9999;
    background: var(--bg);
    display: flex;
    align-items: center;
    justify-content: center;
    transition: opacity ${EXIT_MS}ms var(--ease, ease);
  }
  .civi-preloader.is-exiting {
    opacity: 0;
    pointer-events: none;
  }

  .civi-preloader__stage {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 20px;
  }

  .civi-logo {
    position: relative;
    width: ${w}px;
    height: ${h}px;
  }

  /* Himalaya silhouette behind the pin — wider than the pin's own box so it
     reads as a horizon, not a badge. Sits fully behind: DOM order (mountains
     -> shadow -> pin svg) gives correct stacking without needing z-index.
     A radial mask fades the left/right/bottom edges to transparent so it
     dissolves into the page instead of showing a hard rectangular edge. */
  .civi-mountains {
    position: absolute;
    left: 50%;
    bottom: -${Math.round(h * 0.06)}px;
    width: ${Math.round(w * 2.6)}px;
    height: ${Math.round(h * 0.42)}px;
    transform: translateX(-50%) translateY(6px);
    opacity: 0;
    animation: civi-mtn-in 420ms ease-out 40ms forwards;
    pointer-events: none;
    -webkit-mask-image: radial-gradient(ellipse 58% 100% at 50% 100%, black 0%, black 28%, rgba(0,0,0,0.65) 50%, rgba(0,0,0,0.25) 75%, transparent 100%);
    mask-image: radial-gradient(ellipse 58% 100% at 50% 100%, black 0%, black 28%, rgba(0,0,0,0.65) 50%, rgba(0,0,0,0.25) 75%, transparent 100%);
  }
  .civi-mountains svg {
    width: 100%;
    height: 100%;
    display: block;
    overflow: visible;
  }
  .civi-mtn-back {
    fill: var(--mtn-back, #c3ccd6);
    opacity: 0.5;
  }
  .civi-mtn-front {
    fill: var(--mtn-front, #6f8195);
    opacity: 0.85;
  }
  .civi-mtn-snow {
    fill: #ffffff;
    opacity: 0.85;
  }

  @keyframes civi-mtn-in {
    to { opacity: 1; transform: translateX(-50%) translateY(0); }
  }

  .civi-logo__shadow {
    position: absolute;
    left: 50%;
    bottom: -${Math.max(2, Math.round(h * 0.02))}px;
    width: ${Math.round(w * 0.46)}px;
    height: ${Math.max(5, Math.round(h * 0.05))}px;
    background: var(--pin-shadow, rgba(20, 20, 30, 0.28));
    border-radius: 50%;
    filter: blur(0.5px);
    transform: translateX(-50%) scaleX(0.15);
    opacity: 0;
    animation: civi-shadow 620ms cubic-bezier(0.4, 0, 0.2, 1) forwards;
  }

  .civi-logo__svg {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    overflow: visible;
  }

  .civi-body-pin {
    transform-box: fill-box;      /* origin % now refers to the pin's own bbox, not the whole viewBox */
    transform-origin: 50% 92%;    /* pivot near the pin's tip, like it's planted in the ground */
    opacity: 0;
    filter: drop-shadow(0 4px 6px var(--crimson-shadow));
    animation:
      civi-drop 480ms cubic-bezier(0.55, 0, 1, 0.45) forwards,
      civi-bounce 260ms ease-out 480ms forwards;
  }

  .civi-body-dot {
    transform-box: fill-box;      /* same fix: origin refers to the dot's own bbox */
    transform-origin: 50% 50%;
    opacity: 0;
    transform: scale(0.25);
    animation: civi-dot-in 220ms cubic-bezier(0.34, 1.56, 0.64, 1) 700ms forwards;
  }

  @keyframes civi-drop {
    0% {
      /* fixed user-space units, not %, so this can't be measured against the
         wrong bounding box on different browsers */
      transform: translateY(-140px) scale(0.42);
      opacity: 0;
    }
    55% {
      opacity: 1;
    }
    100% {
      transform: translateY(0) scale(1);
      opacity: 1;
    }
  }

  @keyframes civi-bounce {
    0% { transform: scaleY(1) scaleX(1); }
    35% { transform: scaleY(0.8) scaleX(1.14); }
    65% { transform: scaleY(1.05) scaleX(0.95); }
    100% { transform: scaleY(1) scaleX(1); }
  }

  @keyframes civi-shadow {
    0% { opacity: 0; transform: translateX(-50%) scaleX(0.1); }
    55% { opacity: 0.55; transform: translateX(-50%) scaleX(1); }
    75% { opacity: 0.3; transform: translateX(-50%) scaleX(0.7); }
    100% { opacity: 0.4; transform: translateX(-50%) scaleX(0.85); }
  }

  @keyframes civi-dot-in {
    to { opacity: 1; transform: scale(1); }
  }

  .civi-preloader__word {
    text-align: center;
    font-family: var(--font-sans);
    font-weight: 600;
    font-size: 0.85rem;
    letter-spacing: 0.22em;
    color: var(--text-muted);
    opacity: 0;
    transform: translateY(4px);
    animation: civi-word-in 300ms ease-out 900ms forwards;
  }

  @keyframes civi-word-in {
    to { opacity: 1; transform: translateY(0); }
  }

  @media (prefers-reduced-motion: reduce) {
    .civi-preloader {
      transition-duration: 150ms !important;
    }
    .civi-mountains,
    .civi-logo__shadow,
    .civi-body-pin,
    .civi-body-dot,
    .civi-preloader__word {
      animation: none !important;
      opacity: 1 !important;
      transform: none !important;
    }
  }
  `;
};

const Preloader = ({ loading = true, onDone = () => {}, size = 64 }) => {
  const [exiting, setExiting] = useState(false);
  const doneCalledRef = useRef(false);

  const prefersReducedMotion = useMemo(
    () =>
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches,
    []
  );

  const css = useMemo(() => buildCss(size), [size]);

  const finish = useCallback(() => {
    if (!doneCalledRef.current) {
      doneCalledRef.current = true;
      onDone();
    }
  }, [onDone]);

  useEffect(() => {
    if (!loading) return;
    const holdMs = prefersReducedMotion ? 400 : MIN_DISPLAY_MS;
    const exitTimer = setTimeout(() => setExiting(true), holdMs);
    return () => clearTimeout(exitTimer);
  }, [loading, prefersReducedMotion]);

  useEffect(() => {
    if (exiting) {
      const t = setTimeout(finish, EXIT_MS);
      return () => clearTimeout(t);
    }
  }, [exiting, finish]);

  if (!loading) return null;

  return (
    <div
      className={`civi-preloader ${exiting ? "is-exiting" : ""}`}
      role="status"
      aria-label="Loading CIVIMAP"
    >
      <div className="civi-preloader__stage">
        <div className="civi-logo">
          <div className="civi-mountains" aria-hidden="true">
            <svg viewBox="0 0 300 140" preserveAspectRatio="xMidYMax slice">
              {/* farther range, softer */}
              <path
                className="civi-mtn-back"
                d="M0,140 L0,92 L45,52 L78,84 L118,38 L162,86 L205,44 L245,88 L300,58 L300,140 Z"
              />
              {/* nearer range, darker, with the tallest peak center-ish */}
              <path
                className="civi-mtn-front"
                d="M0,140 L0,110 L55,68 L95,100 L150,22 L200,92 L235,60 L270,98 L300,80 L300,140 Z"
              />
              {/* snow cap on the tallest peak, an Everest nod */}
              <path
                className="civi-mtn-snow"
                d="M150,22 L163,44 L154,40 L150,34 L146,40 L137,44 Z"
              />
            </svg>
          </div>
          <div className="civi-logo__shadow" />
          <svg className="civi-logo__svg" viewBox="0 0 200 240">
            <g className="civi-body-pin">
              <path
                d={PIN_PATH}
                fill="var(--np-crimson)"
                stroke="var(--np-blue)"
                strokeWidth="14"
                strokeLinejoin="round"
              />
            </g>
            <g className="civi-body-dot">
              <circle cx="100" cy="95" r="26" fill="#ffffff" />
            </g>
          </svg>
        </div>
        <div className="civi-preloader__word">CIVIMAP</div>
      </div>
      <style>{css}</style>
    </div>
  );
};

export default Preloader;