export function FullBleedBackground() {
  return (
    <div className="fixed inset-0 z-[-40] overflow-hidden pointer-events-none" aria-hidden>
      <div className="absolute inset-0 bg-[var(--xf-bg-light,#F8FAFC)] dark:bg-[var(--xf-bg-900,#0A0E14)]" />
      <div className="bg-skyline-day absolute inset-0 opacity-[0.32] dark:hidden" />
      <div className="bg-skyline-night absolute inset-0 hidden opacity-[0.24] dark:block" />
      <div className="absolute inset-0 starfield" />
    </div>
  );
}
