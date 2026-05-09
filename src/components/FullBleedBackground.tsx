export function FullBleedBackground() {
  return (
    <div className="fixed inset-0 z-[-40] overflow-hidden pointer-events-none" aria-hidden>
      <div className="absolute inset-0 bg-[#F1F5F9] dark:bg-[#0B0F14]" />
      <div className="absolute inset-0 bg-[url('/branding/atx-skyline-day.png')] bg-cover bg-center bg-no-repeat opacity-[0.28] dark:hidden" />
      <div className="absolute inset-0 hidden bg-[url('/branding/atx-skyline-night.png')] bg-cover bg-center bg-no-repeat opacity-[0.22] dark:block" />
      <div className="absolute inset-0 starfield" />
    </div>
  );
}
