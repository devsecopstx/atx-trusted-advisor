import { redirect } from "next/navigation";

export default function AdminXchatApiTestPage() {
  redirect("/admin/delivery-channels?tab=xchat-api");
}
