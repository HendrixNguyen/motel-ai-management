import { spawn } from "node:child_process";
import { cp, mkdir, rm } from "node:fs/promises";
import { resolve } from "node:path";

const root = process.cwd();
const backendUrl = process.env.BACKEND_URL ?? "http://127.0.0.1:3002";
const port = process.env.PORT ?? "3001";

function run(command, args, env = {}) {
  return new Promise((resolveRun, rejectRun) => {
    const child = spawn(command, args, {
      cwd: root,
      env: { ...process.env, ...env },
      stdio: "inherit",
    });
    const forwardSignal = (signal) => child.kill(signal);
    process.once("SIGINT", forwardSignal);
    process.once("SIGTERM", forwardSignal);
    child.once("error", rejectRun);
    child.once("exit", (code, signal) => {
      process.off("SIGINT", forwardSignal);
      process.off("SIGTERM", forwardSignal);
      if (code === 0) resolveRun();
      else rejectRun(new Error(`${command} exited with ${signal ?? code}`));
    });
  });
}

await rm(resolve(root, ".next/standalone"), { recursive: true, force: true });
await run("bun", ["run", "build"], { BACKEND_URL: backendUrl });
await mkdir(resolve(root, ".next/standalone/.next/static"), { recursive: true });
await cp(resolve(root, ".next/static"), resolve(root, ".next/standalone/.next/static"), {
  recursive: true,
  force: true,
});
await mkdir(resolve(root, ".next/standalone/public"), { recursive: true });
await cp(resolve(root, "public"), resolve(root, ".next/standalone/public"), {
  recursive: true,
  force: true,
});
await run(process.execPath, [".next/standalone/server.js"], {
  BACKEND_URL: backendUrl,
  PORT: port,
});
