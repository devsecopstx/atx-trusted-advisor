import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
    "./design-system/**/*.{css,js,ts,jsx,tsx,mdx}",
    "./atx-branding/**/*.{js,ts,jsx,tsx,mdx}",
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
