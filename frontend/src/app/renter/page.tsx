import { redirect } from "next/navigation";
import ExchangeForm from "@/components/renter/exchange-form";

export default function RenterExchangePage() {
  redirect("/portal");
  return <main className="mx-auto flex min-h-dvh w-full max-w-[480px] items-center px-4"><ExchangeForm /></main>;
}
