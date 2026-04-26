import { notFound } from "next/navigation";

import "@/app/xchat/xchat.css";
import { WheelReportView } from "@/components/xoptions/wheel-report-view";
import { getWheelSharedReportByToken } from "@/modules/xoptions/wheel-report-repository";

type PageProps = {
  params: Promise<{ token: string }>;
};

export default async function PublicWheelReportPage({ params }: PageProps) {
  const { token } = await params;
  const report = await getWheelSharedReportByToken(token.trim());
  if (!report) {
    notFound();
  }

  return (
    <main className="min-h-screen bg-[var(--xf-bg-900)] px-4 py-6 text-[var(--xf-text-100)] sm:px-6">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-3">
        <p className="text-[0.7rem] uppercase tracking-[0.1em] text-[var(--xf-text-400)]">
          Shared xFinance wheel report · expires {report.expiresAt.toLocaleString()}
        </p>
        <WheelReportView
          report={report.reportPayload}
          generatedByName={report.generatedByName}
          shareEnabled={false}
        />
      </div>
    </main>
  );
}
