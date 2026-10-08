import { app } from "@/app";
import { env } from "@/config";
import { enqueueContractExpiryReminders } from "@/modules/notification/expiry.service";

if (env.nodeEnv !== "test") {
  void enqueueContractExpiryReminders().catch(() => undefined);
  setInterval(() => void enqueueContractExpiryReminders().catch(() => undefined), 86_400_000);
}

app.listen(env.port);

console.log(`Motel backend listening on http://localhost:${env.port}`);