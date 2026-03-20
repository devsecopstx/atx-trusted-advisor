import { APP_VERSION_LABEL } from "@/lib/app-version";

export function GlobalFooter() {
  return (
    <footer className="app-footer">
      <p className="app-footer-line">
        <span className="app-footer-version">{APP_VERSION_LABEL}</span>
        <span aria-hidden className="app-footer-sep">
          ·
        </span>
        <span className="app-footer-disclaimer">
          <strong>not financial advice</strong>, don&apos;t, sue me bro.
        </span>
      </p>
    </footer>
  );
}
