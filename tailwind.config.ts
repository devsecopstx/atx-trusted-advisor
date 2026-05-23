import type { Config } from "tailwindcss";

const config: Config = {
  /** Align with `data-xf-ui`: soft = light shell, deep (or system→dark) = dark shell */
  darkMode: ["selector", 'html:not([data-xf-ui="soft"])'],
  content: [
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
    "./atx-docs/design-system/**/*.{css,js,ts,jsx,tsx,mdx}",
    "./atx-docs/branding/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  /** Keep existing hand-authored global CSS; avoid Tailwind Preflight reset clashes. */
  corePlugins: {
    preflight: false,
  },
  theme: {
    extend: {
      colors: {
        /** Semantic greens from `atxfinance-brand-kit.css` — see green usage table in brand kit + DEVELOPMENT.md § Branding Tokens. */
        "xf-nav-green": "var(--xf-nav-green)",
        "xf-nav-green-hover": "var(--xf-nav-green-hover)",
        "xf-accent-cta": "var(--xf-accent-cta)",
        "xf-green-500": "var(--xf-green-500)",
        "xf-green-400": "var(--xf-green-400)"
      },
      /** Align with `atx-docs/design-system/atxfinance-brand-kit.css` (--xf-font-sans / --xf-font-mono) */
      fontFamily: {
        sans: ["var(--xf-font-sans)", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["var(--xf-font-mono)", "ui-monospace", "monospace"],
        /** xChat / Grok conversation stack (Inter already loaded via `--xf-font-sans`) */
        grok: [
          "var(--xf-font-sans)",
          "system-ui",
          "-apple-system",
          "BlinkMacSystemFont",
          '"Segoe UI"',
          "Roboto",
          '"Helvetica Neue"',
          "Arial",
          "sans-serif"
        ]
      },
      fontSize: {
        /** Grok-style conversation base (deep shell CSS also sets this on `.xchat-messages`) */
        "grok-base": ["0.9375rem", { lineHeight: "1.6", letterSpacing: "-0.005em" }]
      }
    }
  },
  plugins: [],
};

export default config;
