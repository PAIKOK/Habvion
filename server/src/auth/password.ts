import { randomBytes, scrypt, timingSafeEqual, type ScryptOptions } from "node:crypto";

const N = 16384,
  R = 8,
  P = 1,
  KEYLEN = 64;
const derive = (password: string, salt: Buffer, opts: ScryptOptions) =>
  new Promise<Buffer>((resolve, reject) =>
    scrypt(password.normalize("NFKC"), salt, KEYLEN, { ...opts, maxmem: 256 * opts.N! * opts.r! }, (err, key) => (err ? reject(err) : resolve(key))),
  );

/** `scrypt$N$r$p$salt$hash`, base64 parts. Parameters travel with the hash so they can rise later. */
export async function hashPassword(password: string) {
  const salt = randomBytes(16),
    key = await derive(password, salt, { N, r: R, p: P });
  return `scrypt$${N}$${R}$${P}$${salt.toString("base64")}$${key.toString("base64")}`;
}
export async function verifyPassword(password: string, stored: string) {
  const [alg, n, r, p, salt, hash] = stored.split("$");
  const opts = { N: Number(n), r: Number(r), p: Number(p) };
  if (alg !== "scrypt" || !salt || !hash || !(opts.N >= 1024 && opts.N <= 1 << 20) || !(opts.r >= 1 && opts.r <= 32) || !(opts.p >= 1 && opts.p <= 4)) return false;
  const expected = Buffer.from(hash, "base64"),
    key = await derive(password, Buffer.from(salt, "base64"), opts);
  return key.length === expected.length && timingSafeEqual(key, expected);
}
/** Spent on unknown emails so a login's timing does not reveal who has an account. */
export const DUMMY_HASH = await hashPassword(randomBytes(12).toString("hex"));
