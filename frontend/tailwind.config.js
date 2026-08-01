/** @type {import('tailwindcss').Config} */

/** Build a Tailwind colour object from a CSS-variable ramp. */
const ramp = (name, stops) =>
  Object.fromEntries(stops.map((s) => [s, `var(--${name}-${s})`]));

export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        // ---- Structural surfaces ----
        background: "var(--bg-app)",
        surface: {
          DEFAULT: "var(--bg-surface)",
          canvas: "var(--surface-canvas)",
          sunken: "var(--surface-sunken)",
          raised: "var(--surface-raised)",
          overlay: "var(--surface-overlay)",
        },
        sidebar: "var(--bg-sidebar)",
        border: {
          DEFAULT: "var(--border-color)",
          subtle: "var(--border-subtle)",
          strong: "var(--border-strong)",
        },

        // ---- Brand ----
        brand: ramp("brand", [50, 100, 200, 300, 400, 500, 600, 700, 800, 900]),
        primary: {
          DEFAULT: "var(--color-primary)",
          hover: "var(--color-primary-hover)",
          active: "var(--color-primary-active)",
          subtle: "var(--color-primary-subtle)",
          fg: "var(--color-on-primary)",
        },
        secondary: "var(--color-secondary)",
        accent: "var(--color-accent)",

        // ---- Semantic ----
        success: ramp("success", [50, 200, 500, 600, 700]),
        danger: ramp("danger", [50, 200, 500, 600, 700]),
        warning: ramp("warning", [50, 200, 500, 600, 700]),
        info: ramp("info", [50, 200, 500, 600, 700]),

        // ---- Domain accents ----
        academics: ramp("academics", [500, 600, 700]),
        finance: ramp("finance", [500, 600, 700]),

        // ---- Text ----
        text: {
          primary: "var(--text-primary)",
          secondary: "var(--text-secondary)",
          muted: "var(--text-muted)",
          "on-fill": "var(--text-on-fill)",
        },

        // ---- Charts ----
        chart: {
          1: "var(--chart-1)",
          2: "var(--chart-2)",
          3: "var(--chart-3)",
          4: "var(--chart-4)",
          5: "var(--chart-5)",
          6: "var(--chart-6)",
          7: "var(--chart-7)",
          8: "var(--chart-8)",
        },
      },

      /**
       * Type scale. Body defaults to 14px/1.55 — the old floor was 10px, which
       * fails legibility guidance and is hostile on parent-facing screens.
       * Nothing above 700: heavier weights were never loaded.
       */
      fontSize: {
        "overline": ["0.6875rem", { lineHeight: "0.875rem", letterSpacing: "0.04em", fontWeight: "600" }], // 11px
        "label":    ["0.75rem",   { lineHeight: "1rem",     letterSpacing: "0.01em", fontWeight: "600" }], // 12px
        "body-sm":  ["0.8125rem", { lineHeight: "1.25rem" }],  // 13px — the new floor
        "body-md":  ["0.875rem",  { lineHeight: "1.375rem" }], // 14px — default
        "body-lg":  ["1rem",      { lineHeight: "1.5rem" }],
        "display-xs": ["1.125rem", { lineHeight: "1.5rem",  letterSpacing: "-0.015em", fontWeight: "600" }],
        "display-sm": ["1.25rem",  { lineHeight: "1.75rem", letterSpacing: "-0.02em",  fontWeight: "600" }],
        "display-md": ["1.5rem",   { lineHeight: "2rem",    letterSpacing: "-0.02em",  fontWeight: "700" }],
        "display-lg": ["1.875rem", { lineHeight: "2.25rem", letterSpacing: "-0.025em", fontWeight: "700" }],
      },

      fontFamily: {
        sans: ["Inter", "system-ui", "-apple-system", "sans-serif"],
        display: ["Outfit", "Inter", "system-ui", "sans-serif"],
      },

      borderRadius: {
        sm: "var(--radius-sm)",
        md: "var(--radius-md)",
        lg: "var(--radius-lg)",
      },

      boxShadow: {
        sm: "var(--shadow-sm)",
        md: "var(--shadow-md)",
        lg: "var(--shadow-lg)",
      },

      /** 44px minimum touch target for mobile-facing controls. */
      minHeight: { touch: "2.75rem" },
      minWidth: { touch: "2.75rem" },

      transitionTimingFunction: {
        fast: "var(--transition-fast)",
        normal: "var(--transition-normal)",
      },

      keyframes: {
        "fade-in": {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
        "slide-in-right": {
          from: { transform: "translateX(1.25rem)", opacity: "0" },
          to: { transform: "translateX(0)", opacity: "1" },
        },
        "slide-in-top": {
          from: { transform: "translateY(-0.5rem)", opacity: "0" },
          to: { transform: "translateY(0)", opacity: "1" },
        },
        "zoom-in": {
          from: { transform: "scale(0.95)", opacity: "0" },
          to: { transform: "scale(1)", opacity: "1" },
        },
      },
      animation: {
        "fade-in": "fade-in 0.2s ease-out",
        "slide-in-right": "slide-in-right 0.25s cubic-bezier(0.16, 1, 0.3, 1)",
        "slide-in-top": "slide-in-top 0.2s cubic-bezier(0.16, 1, 0.3, 1)",
        "zoom-in": "zoom-in 0.2s cubic-bezier(0.16, 1, 0.3, 1)",
      },
    },
  },
  plugins: [],
}
