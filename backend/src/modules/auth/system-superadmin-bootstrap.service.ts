import { eq } from "drizzle-orm";
import { db } from "@/db";
import { managerAuditEvents, managers } from "./auth.schema";
import { SUPERADMIN_EMAIL, SUPERADMIN_NAME } from "./superadmin-identity";

type Executor = Pick<typeof db, "insert" | "select">;
type SafeBootstrapError = Error & { readonly safeSystemSeedError: true };

function safeError(message: string): SafeBootstrapError {
  return Object.assign(new Error(message), { safeSystemSeedError: true as const });
}

export async function seedSystemSuperadmin(executor: Executor, password: string): Promise<string> {
  const [existing] = await executor
    .select()
    .from(managers)
    .where(eq(managers.email, SUPERADMIN_EMAIL))
    .for("update")
    .limit(1);
  if (existing) {
    if (existing.role !== "superadmin")
      throw safeError("Canonical Superadmin identity has conflicting role; no data was changed");
    if (existing.disabledAt)
      throw safeError("Canonical Superadmin account is disabled; no data was changed");
    if (existing.name !== SUPERADMIN_NAME)
      throw safeError("Canonical Superadmin name does not match; no data was changed");
    if (!(await Bun.password.verify(password, existing.passwordHash)))
      throw safeError("Canonical Superadmin password does not match; no data was changed");
    return existing.id;
  }

  const passwordHash = await Bun.password.hash(password, { algorithm: "argon2id" });
  const [created] = await executor
    .insert(managers)
    .values({ email: SUPERADMIN_EMAIL, name: SUPERADMIN_NAME, passwordHash, role: "superadmin" })
    .returning({ id: managers.id });
  if (!created) throw safeError("Superadmin insert returned no row; no data was changed");
  const id = created.id;
  await executor.insert(managerAuditEvents).values({
    actorId: id,
    targetId: id,
    action: "superadmin.bootstrapped",
  });
  return id;
}
