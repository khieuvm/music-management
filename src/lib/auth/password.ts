import { randomBytes, randomInt, scrypt as scryptCallback, timingSafeEqual, type ScryptOptions } from "node:crypto";

const KEY_LENGTH = 64;
const PARAMS = { N: 32768, r: 8, p: 1 };
const MAX_MEMORY = 64 * 1024 * 1024;

function scrypt(password: string, salt: Buffer, options: ScryptOptions) {
  return new Promise<Buffer>((resolve, reject) => {
    scryptCallback(password.normalize("NFC"), salt, KEY_LENGTH, options, (error, key) => {
      if (error) reject(error);
      else resolve(key);
    });
  });
}

export async function hashPassword(password: string) {
  const salt = randomBytes(16);
  const key = await scrypt(password, salt, { ...PARAMS, maxmem: MAX_MEMORY });
  return ["scrypt", PARAMS.N, PARAMS.r, PARAMS.p, salt.toString("base64"), key.toString("base64")].join("$");
}

export async function verifyPassword(password: string, stored: string) {
  const [scheme, n, r, p, salt, hash] = stored.split("$");
  if (scheme !== "scrypt" || !salt || !hash) return false;
  const expected = Buffer.from(hash, "base64");
  const actual = await scrypt(password, Buffer.from(salt, "base64"), {
    N: Number(n), r: Number(r), p: Number(p), maxmem: MAX_MEMORY,
  });
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

const READABLE = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789";

export function generateTemporaryPassword(length = 10) {
  return Array.from({ length }, () => READABLE[randomInt(READABLE.length)]).join("");
}

// Precomputed hash used to keep login timing similar when the username does not exist.
let dummyHash: Promise<string> | undefined;
export function getDummyHash() {
  dummyHash ??= hashPassword(randomBytes(16).toString("hex"));
  return dummyHash;
}
