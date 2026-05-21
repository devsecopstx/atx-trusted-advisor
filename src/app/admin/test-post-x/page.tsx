import { redirect } from "next/navigation";

export default function AdminTestPostXPage() {
  redirect("/admin/delivery-channels?tab=test-post-x");
}
