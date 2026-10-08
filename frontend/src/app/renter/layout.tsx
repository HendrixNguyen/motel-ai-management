import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getRenterMe } from "@/lib/api/renter";

export default async function RenterLayout({ children }: { children: React.ReactNode }) {
  if (!(await cookies()).get("renter_session")?.value) redirect("/renter");
  const profile = await getRenterMe();
  return <div className="mx-auto min-h-dvh w-full max-w-[480px] bg-surface px-4 pb-8"><header className="sticky top-0 z-10 -mx-4 mb-6 border-b border-border bg-surface/95 px-4 py-4 backdrop-blur"><p className="font-heading text-lg font-bold text-text">{profile.motel.name}</p><p className="text-sm text-text-muted">Xin chào, {profile.name}</p></header><main>{children}</main></div>;
}
