import { app } from "@/app";
import { env } from "@/config";

app.listen(env.port);

console.log(`Motel backend listening on http://localhost:${env.port}`);