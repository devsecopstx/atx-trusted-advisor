import { redirect } from "next/navigation";

export default function AdminXoptionsPage() {
  redirect("/admin/delivery-channels?tab=xoptions");
}
