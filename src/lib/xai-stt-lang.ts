/** Map browser locale (e.g. en-US) to xAI STT `language` codes. */
export function toXaiSttLanguage(locale: string): string {
  const t = locale.trim().toLowerCase();
  if (t.length < 2) {
    return "en";
  }
  if (t.startsWith("en")) {
    return "en";
  }
  const hyphen = t.indexOf("-");
  const short = hyphen === -1 ? t.slice(0, 2) : t.slice(0, hyphen).slice(0, 2);
  return short.length === 2 ? short : "en";
}
