import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import ExchangeForm from "@/components/renter/exchange-form";

export default async function RenterExchangePage() {
  if ((await cookies()).get("renter_session")?.value) redirect("/portal");
  return <main className="mx-auto flex min-h-dvh w-full max-w-[480px] items-center px-4"><ExchangeForm /></main>;
}
