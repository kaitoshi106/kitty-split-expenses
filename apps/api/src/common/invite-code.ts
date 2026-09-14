import { randomInt } from 'node:crypto';

/**
 * Crockford Base32 alphabet: omits I, L and O (confusable with 1 and 0) and U
 * (avoids accidental profanity), since codes are typed by hand when QR scanning fails.
 */
const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

export const INVITE_CODE_LENGTH = 8;

/**
 * @description Generates a random invite code using a CSPRNG.
 * @returns An `INVITE_CODE_LENGTH`-character Crockford Base32 string.
 */
export function generateInviteCode(): string {
  let out = '';
  for (let i = 0; i < INVITE_CODE_LENGTH; i++) {
    out += ALPHABET[randomInt(ALPHABET.length)];
  }
  return out;
}

/**
 * @description Normalizes a typed invite code: strips spaces and dashes, uppercases,
 * and maps confusable characters (I/L to 1, O to 0, U to V).
 * @param input - Raw user input.
 * @returns The canonical code to look up.
 */
export function normalizeInviteCode(input: string): string {
  return input
    .trim()
    .toUpperCase()
    .replace(/[\s-]/g, '')
    .replace(/I/g, '1')
    .replace(/L/g, '1')
    .replace(/O/g, '0')
    .replace(/U/g, 'V');
}

const PALETTE = [
  '#6366F1', '#059669', '#DC2626', '#F97316',
  '#0EA5E9', '#A855F7', '#EC4899', '#14B8A6',
];

/**
 * @description Picks a deterministic avatar color; sequential indexes avoid repeats within a group.
 * @param index - Member position in the group.
 */
export function pickAvatarColor(index: number): string {
  return PALETTE[index % PALETTE.length];
}
