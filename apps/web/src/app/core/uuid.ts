/**
 * @description Generates a UUID v4 in any context. `crypto.randomUUID` exists only in a
 * secure context (https or localhost) and is undefined over plain http, e.g. LAN testing on
 * a phone; calling it unguarded crashed the app there. Falls back to `getRandomValues`,
 * which is available everywhere, then to Math.random. The value is used for idempotency
 * keys and ids, not secrets.
 * @returns A RFC 4122 version 4 UUID string.
 */
export function randomUuid(): string {
  const c = globalThis.crypto as Crypto | undefined;
  if (typeof c?.randomUUID === 'function') return c.randomUUID();

  const bytes = new Uint8Array(16);
  if (typeof c?.getRandomValues === 'function') {
    c.getRandomValues(bytes);
  } else {
    for (let i = 0; i < 16; i += 1) bytes[i] = Math.floor(Math.random() * 256);
  }

  // Set the version (4) and variant (10xx) bits.
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;

  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
