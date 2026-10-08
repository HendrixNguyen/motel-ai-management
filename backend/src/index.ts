import { app } from "@/app";
import { env } from "@/config";
import { enqueueContractExpiryReminders } from "@/modules/notification/expiry.service";
import { nextExpiryRunAt, postgresAdvisoryLeaseDb, runWithAdvisoryLease } from "@/modules/notification/scheduler.service";

if (env.nodeEnv !== "test") {
  const run = async () => { for (let attempt = 1; attempt <= 3; attempt++) { try { await runWithAdvisoryLease(postgresAdvisoryLeaseDb, 8_417_203, enqueueContractExpiryReminders); return; } catch { if (attempt < 3) await new Promise((resolve) => setTimeout(resolve, attempt * 1000)); } } };
  const schedule = () => { const now = new Date(); const timer = setTimeout(async () => { await run(); schedule(); }, nextExpiryRunAt(now).getTime() - now.getTime()); timer.unref(); };
  void run(); schedule();
}

app.listen(env.port);

console.log(`Motel backend listening on http://localhost:${env.port}`);