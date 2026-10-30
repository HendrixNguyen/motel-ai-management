import { app } from "@/app";
import { migrateDatabase } from "@/db/migrate";
import { env } from "@/config";
import { enqueueContractExpiryReminders } from "@/modules/notification/expiry.service";
import { deliverNotification } from "@/modules/notification/notification.service";
import { runNotificationDeliveryOnce } from "@/modules/notification/delivery.service";
import {
  nextExpiryRunAt,
  postgresAdvisoryLeaseDb,
  runWithAdvisoryLease,
} from "@/modules/notification/scheduler.service";

const maskedDbUrl = env.databaseUrl.replace(/:([^:@]+)@/, ":****@");
console.log(`Database URL: ${maskedDbUrl}`);
// Force new image build: 2026-10-12

if (env.nodeEnv !== "test") {
  if (process.env.AUTO_MIGRATE === "true") {
    await migrateDatabase();
  }
  const run = async () => {
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        await runWithAdvisoryLease(
          postgresAdvisoryLeaseDb,
          8_417_203,
          enqueueContractExpiryReminders,
        );
        return;
      } catch {
        if (attempt < 3) await new Promise((resolve) => setTimeout(resolve, attempt * 1000));
      }
    }
  };
  const schedule = () => {
    const now = new Date();
    const timer = setTimeout(
      async () => {
        await run();
        schedule();
      },
      nextExpiryRunAt(now).getTime() - now.getTime(),
    );
    timer.unref();
  };
  void run();
  schedule();
  const deliver = () => {
    void runNotificationDeliveryOnce(deliverNotification).finally(() => {
      const timer = setTimeout(deliver, 5000);
      timer.unref();
    });
  };
  deliver();
}

app.listen(env.port);

console.log(`Motel backend listening on http://localhost:${env.port}`);
