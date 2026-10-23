import { randomUUID } from "node:crypto";
import { MongoClient, type Collection, type Db } from "mongodb";
import type { HomeDesign } from "@shared/types/home";
import type { StoredUser, UserRepository } from "./users.js";
import { summarize, type DesignRepository, type StoredDesign } from "./designs.js";
import { newReference, type MessageRepository, type NewMessage, type StoredMessage } from "./messages.js";

type UserDoc = Omit<StoredUser, "id"> & { _id: string };
type MessageDoc = Omit<StoredMessage, "id"> & { _id: string };
type DesignDoc = Omit<StoredDesign, "id" | "design"> & { _id: string; design: string };
const user = ({ _id, ...u }: UserDoc): StoredUser => ({ id: _id, ...u });
// The design is stored as a JSON string: its maps are keyed by user-chosen ids, which
// Mongo field names would restrict, and it is only ever read whole.
const design = ({ _id, design: d, ...s }: DesignDoc): StoredDesign => ({ id: _id, design: JSON.parse(d) as HomeDesign, ...s });
const isDuplicate = (e: unknown) => (e as { code?: number }).code === 11000;

export class MongoUserRepository implements UserRepository {
  constructor(private readonly c: Collection<UserDoc>) {}
  async byId(id: string) {
    const d = await this.c.findOne({ _id: id });
    return d ? user(d) : null;
  }
  async byEmail(email: string) {
    const d = await this.c.findOne({ email: email.toLowerCase() });
    return d ? user(d) : null;
  }
  async byGoogleId(googleId: string) {
    const d = await this.c.findOne({ googleId });
    return d ? user(d) : null;
  }
  async create(input: Omit<StoredUser, "id" | "createdAt">) {
    const doc: UserDoc = { ...input, email: input.email.toLowerCase(), _id: randomUUID(), createdAt: new Date().toISOString() };
    try {
      await this.c.insertOne(doc);
      return user(doc);
    } catch (e) {
      if (isDuplicate(e)) return null;
      throw e;
    }
  }
  async update(id: string, patch: Partial<Pick<StoredUser, "name" | "passwordHash" | "googleId">>) {
    const d = await this.c.findOneAndUpdate({ _id: id }, { $set: patch }, { returnDocument: "after" });
    return d ? user(d) : null;
  }
  async remove(id: string) {
    return (await this.c.deleteOne({ _id: id })).deletedCount === 1;
  }
}

export class MongoDesignRepository implements DesignRepository {
  constructor(private readonly c: Collection<DesignDoc>) {}
  async list(ownerId: string) {
    return (await this.c.find({ ownerId }).sort({ updatedAt: -1 }).toArray()).map((d) => summarize(design(d)));
  }
  async get(ownerId: string, id: string) {
    const d = await this.c.findOne({ _id: id, ownerId });
    return d ? design(d) : null;
  }
  async create(ownerId: string, value: HomeDesign) {
    const now = new Date().toISOString(),
      doc: DesignDoc = { _id: value.id, ownerId, design: JSON.stringify(value), createdAt: now, updatedAt: now };
    try {
      await this.c.insertOne(doc);
      return design(doc);
    } catch (e) {
      if (isDuplicate(e)) return null;
      throw e;
    }
  }
  async save(ownerId: string, id: string, value: HomeDesign) {
    const d = await this.c.findOneAndUpdate(
      { _id: id, ownerId },
      { $set: { design: JSON.stringify({ ...value, id }), updatedAt: new Date().toISOString() } },
      { returnDocument: "after" },
    );
    return d ? design(d) : null;
  }
  async remove(ownerId: string, id: string) {
    return (await this.c.deleteOne({ _id: id, ownerId })).deletedCount === 1;
  }
  async setShareToken(ownerId: string, id: string, token: string | null) {
    const d = await this.c.findOneAndUpdate(
      { _id: id, ownerId },
      token ? { $set: { shareToken: token } } : { $unset: { shareToken: "" } },
      { returnDocument: "after" },
    );
    return d ? design(d) : null;
  }
  async byShareToken(token: string) {
    const d = await this.c.findOne({ shareToken: token });
    return d ? design(d) : null;
  }
}

export class MongoMessageRepository implements MessageRepository {
  constructor(private readonly c: Collection<MessageDoc>) {}
  async create(input: NewMessage) {
    const doc: MessageDoc = { _id: newReference(), ...input, createdAt: new Date().toISOString() };
    await this.c.insertOne(doc);
    const { _id, ...rest } = doc;
    return { id: _id, ...rest };
  }
  async list(limit = 50) {
    return (await this.c.find().sort({ createdAt: -1 }).limit(limit).toArray()).map(({ _id, ...m }) => ({ id: _id, ...m }));
  }
  async forUser(userId: string) {
    return (await this.c.find({ userId }).sort({ createdAt: 1 }).toArray()).map(({ _id, ...m }) => ({ id: _id, ...m }));
  }
  async removeForUser(userId: string) {
    return (await this.c.deleteMany({ userId })).deletedCount;
  }
  async removeOlderThan(cutoff: string) {
    return (await this.c.deleteMany({ createdAt: { $lt: cutoff } })).deletedCount;
  }
  async removeExpired(now: string) {
    return (await this.c.deleteMany({ expiresAt: { $type: "string", $regex: /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/, $lte: now } })).deletedCount;
  }
}

/** Connect, ensure indexes, and hand back the repositories plus a closer. */
export async function connectMongo(uri: string, dbName?: string) {
  const client = await MongoClient.connect(uri, { serverSelectionTimeoutMS: 8000, appName: "homebuilder-ai" });
  const db: Db = client.db(dbName);
  const users = db.collection<UserDoc>("users"),
    designs = db.collection<DesignDoc>("designs"),
    messages = db.collection<MessageDoc>("messages");
  await Promise.all([
    users.createIndex({ email: 1 }, { unique: true }),
    users.createIndex({ googleId: 1 }, { unique: true, partialFilterExpression: { googleId: { $type: "string" } } }),
    designs.createIndex({ ownerId: 1, updatedAt: -1 }),
    designs.createIndex({ shareToken: 1 }, { unique: true, partialFilterExpression: { shareToken: { $type: "string" } } }),
    messages.createIndex({ createdAt: -1 }),
    messages.createIndex({ userId: 1 }, { partialFilterExpression: { userId: { $type: "string" } } }),
  ]);
  return { users: new MongoUserRepository(users), designs: new MongoDesignRepository(designs), messages: new MongoMessageRepository(messages), close: () => client.close() };
}
