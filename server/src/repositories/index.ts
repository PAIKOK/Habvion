import type { Environment } from "../config/envSchema.js";
import { FileUserRepository, type UserRepository } from "./users.js";
import { FileDesignRepository, type DesignRepository } from "./designs.js";
import { FileMessageRepository, type MessageRepository } from "./messages.js";
import { connectMongo } from "./mongo.js";

export type Repositories = { users: UserRepository; designs: DesignRepository; messages: MessageRepository; kind: "mongodb" | "file"; close: () => Promise<void> };

/** MongoDB when MONGODB_URI is set, otherwise private JSON files. Never both. */
export async function createRepositories(config: Environment): Promise<Repositories> {
  if (config.MONGODB_URI) {
    const m = await connectMongo(config.MONGODB_URI);
    return { users: m.users, designs: m.designs, messages: m.messages, kind: "mongodb", close: m.close };
  }
  return { users: new FileUserRepository(config.USERS_FILE), designs: new FileDesignRepository(config.DESIGNS_FILE), messages: new FileMessageRepository(config.MESSAGES_FILE), kind: "file", close: async () => {} };
}
