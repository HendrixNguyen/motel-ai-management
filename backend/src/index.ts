import { app } from "@/app";
import { env } from "@/config";
import { enqueueContractExpiryReminders } from "@/modules/notification/expiry.service";

if (env.nodeEnv !== "test") {
  const run = async () => { for (let attempt = 1; attempt <= 3; attempt++) { try { await enqueueContractExpiryReminders(); return; } catch { if (attempt < 3) await new Promise((resolve) => setTimeout(resolve, attempt * 1000)); } } };
  const schedule = () => { const now = new Date(); const next = new Date(now); next.setUTCHours(0, 5, 0, 0); if (next <= now) next.setUTCDate(next.getUTCDate() + 1); const timer = setTimeout(async () => { await run(); schedule(); }, next.getTime() - now.getTime()); timer.unref(); };
  void run(); schedule();
}

app.listen(env.port);

console.log(`Motel backend listening on http://localhost:${env.port}`);