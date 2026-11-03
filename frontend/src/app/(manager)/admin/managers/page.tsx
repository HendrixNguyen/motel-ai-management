import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getMe } from "@/lib/api/auth";
import AdminManagersClient from "./client";

export default async function AdminManagersPage() {
  if (!(await cookies()).get("manager_session")?.value) redirect("/login");
  const actor = await getMe();
  if (actor.role !== "superadmin") redirect("/");
  return <AdminManagersClient />;
}
