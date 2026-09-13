import {
  randomBytes,
  scrypt as scryptCallback,
  timingSafeEqual,
  createHmac,
} from "node:crypto";
// Fixed parameters are part of the stored hash format. Introduce a new version before changing them.
const scrypt = (value: string, salt: string, length: number) =>
  new Promise<Buffer>((resolve, reject) => {
    scryptCallback(
      value,
      salt,
      length,
      { N: 65536, r: 8, p: 2, maxmem: 128 * 1024 * 1024 },
      (error, key) => (error ? reject(error) : resolve(key)),
    );
  });
export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const key = (await scrypt(password, salt, 64)) as Buffer;
  return `scrypt:${salt}:${key.toString("hex")}`;
}
export async function verifyPassword(password: string, hash: string) {
  const [algorithm, salt, key] = hash.split(":");
  if (algorithm !== "scrypt" || !salt || !key) return false;
  const actual = (await scrypt(password, salt, 64)) as Buffer;
  const expected = Buffer.from(key, "hex");
  return expected.length === actual.length && timingSafeEqual(actual, expected);
}
export function verifyHmac(body: string, signature: string, secret: string) {
  if (!/^[a-f0-9]{64}$/i.test(signature)) return false;
  return timingSafeEqual(
    Buffer.from(signature, "hex"),
    createHmac("sha256", secret).update(body).digest(),
  );
}
export function token() {
  return randomBytes(32).toString("hex");
}
