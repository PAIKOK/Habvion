// Print the newest contact-form messages: `npm run messages --workspace=server [-- 20]`.
import { env } from "./cliEnv.js";
import { createRepositories } from "../src/repositories/index.js";
import { CONTACT_TOPICS } from "@shared/contact/schema";

const limit = Math.max(1, Math.min(500, Number(process.argv[2]) || 20)),
  repos = await createRepositories(env);
try {
  const list = await repos.messages.list(limit);
  if (!list.length) console.log("No messages yet.");
  for (const m of list) {
    const topic = CONTACT_TOPICS.find((t) => t.value === m.topic)?.label ?? m.topic;
    console.log(`\n${m.id} · ${new Date(m.createdAt).toLocaleString("en-IN")} · ${topic}`);
    console.log(`From: ${m.name} <${m.email}>${m.phone ? ` · ${m.phone}` : ""}${m.userId ? " · has an account" : ""}`);
    if (m.utm) console.log(`Came from: ${Object.entries(m.utm).map(([k, v]) => `${k}=${v}`).join(", ")}`);
    console.log(m.message);
  }
} finally {
  await repos.close();
}
