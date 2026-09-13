export function required(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing environment variable: ${name}`);
  return value;
}
export function appUrl() {
  return new URL(required("APP_URL")).origin;
}
export function sessionSecret() {
  const s = required("SESSION_SECRET");
  if (s.length < 32)
    throw new Error("SESSION_SECRET must be at least 32 characters");
  return s;
}
