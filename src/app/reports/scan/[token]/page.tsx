import { notFound } from "next/navigation";

import { OptionsActionScanReport } from "@/app/reports/scan/ui/options-action-scan-report";
import "@/app/xchat/xchat.css";
import { getOptionsScanSharedReportForPublicView } from "@/modules/xchat/options-scan-share-repository";

type PageProps = {
  params: Promise<{ token: string }>;
};

export default async function PublicOptionsScanReportPage({ params }: PageProps) {
  const { token } = await params;
  const report = await getOptionsScanSharedReportForPublicView(token.trim());
  if (!report) {
    notFound();
  }

  return (
    <main className="min-h-screen bg-[var(--xf-bg-900)] px-4 py-6 text-[var(--xf-text-100)] sm:px-6">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-3">
        <p className="text-[0.7rem] uppercase tracking-[0.1em] text-[var(--xf-text-400)]">
          Shared aTx Advisor scan report · expires {report.expiresAt.toLocaleString()}
        </p>
        <OptionsActionScanReport
          data={{
            generatedAt: report.scanData.generatedAt,
            planTier: report.scanData.planTier,
            truncated: report.scanData.truncated,
            rows: report.scanData.rows,
            disclaimer: report.scanData.disclaimer
          }}
          shareMode="disabled"
        />
      </div>
    </main>
  );
}
