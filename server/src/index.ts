import { createApp } from "./app.js";
import { env } from "./config/env.js";
import { createRepositories } from "./repositories/index.js";
import { warmDemos } from "./routes/demos.js";
import { pruneOldMessages } from "./contact/retention.js";
import { APP_NAME } from "@shared/version";

// Storage is chosen once from the environment. A bad MONGODB_URI fails loudly here.
const repos = await createRepositories(env).catch((error: Error) => {
  console.error(`Could not connect to MongoDB: ${error.message.replace(/mongodb(\+srv)?:\/\/[^\s]+/g, "<uri>")}`);
  process.exit(1);
});
const server = createApp(env, { users: repos.users, designs: repos.designs, messages: repos.messages }).listen(env.PORT, env.NODE_ENV === "production" ? "0.0.0.0" : "127.0.0.1", () => {
  console.log(`${APP_NAME} API listening on port ${env.PORT}; AI provider: ${env.AI_PROVIDER}; storage: ${repos.kind}`);
  setImmediate(warmDemos);
  const prune = () => void pruneOldMessages(repos.messages).catch((e: Error) => console.error(`Could not prune old contact messages: ${e.message}`));
  prune();
  setInterval(prune, 24 * 3600 * 1000).unref();
});
server.on("error", error => { console.error(error.message); process.exitCode = 1; });
for (const signal of ["SIGINT", "SIGTERM"] as const) process.on(signal, () => server.close(() => void repos.close().finally(() => process.exit(0))));
