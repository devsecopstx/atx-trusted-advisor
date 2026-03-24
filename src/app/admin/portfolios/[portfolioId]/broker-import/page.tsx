import { redirect } from "next/navigation";

type PageProps = {
  params: Promise<{ portfolioId: string }>;
};

/** @deprecated Use `/admin/broker-import?portfolioId=…`. */
export default async function AdminPortfolioBrokerImportRedirect({ params }: PageProps) {
  const { portfolioId } = await params;
  redirect(`/admin/broker-import?portfolioId=${encodeURIComponent(portfolioId)}`);
}
