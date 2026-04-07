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
    extend: {},
  },
  plugins: [],
};

export default config;
