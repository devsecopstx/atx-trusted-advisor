import type { CapacitorConfig } from '@capacitor/cli';

/**
 * Where the WebView loads your Next.js app (this repo uses `output: "standalone"` — not a static bundle in `public/`).
 *
 * - Simulator + Mac: default `http://127.0.0.1:3000` — run `npm run dev` first.
 * - Physical device: use your Mac LAN IP, e.g. `http://192.168.1.42:3000`, same Wi‑Fi as the phone.
 * - App Store / TestFlight: set HTTPS origin, e.g.
 *   `CAPACITOR_SERVER_URL=https://your-domain.com npx cap sync ios`
 */
const serverUrl =
  process.env.CAPACITOR_SERVER_URL ?? 'http://127.0.0.1:3000';

const config: CapacitorConfig = {
  appId: 'com.atxfinance.ai',
  appName: 'aTx Finance',
  /** Static assets + Capacitor-required `index.html` (fallback when no server.url). */
  webDir: 'public',
  server: {
    url: serverUrl,
    /** Required for `http://` (local dev). HTTPS production URLs do not use cleartext. */
    cleartext: serverUrl.startsWith('http://'),
  },
};

export default config;
