import { redirect } from "next/navigation";

type PageProps = {
  params: Promise<{ id: string }>;
};

/** Workspace deep-link: portfolio-scoped task list lives under Account → Tasks. */
export default async function PortfolioTasksRedirect({ params }: PageProps) {
  const { id } = await params;
  const trimmed = id?.trim() ?? "";
  if (/^[a-f\d]{24}$/i.test(trimmed)) {
    redirect(`/account/tasks?portfolioId=${encodeURIComponent(trimmed)}`);
  }
  redirect("/account/tasks");
}
