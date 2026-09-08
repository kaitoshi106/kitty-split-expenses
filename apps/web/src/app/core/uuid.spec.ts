import { randomUuid } from './uuid';

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe('randomUuid', () => {
  const real = globalThis.crypto;

  afterEach(() => {
    Object.defineProperty(globalThis, 'crypto', { value: real, configurable: true });
  });

  /** Simulates an insecure context (e.g. http://<lan-ip>:4200). */
  function withoutRandomUUID(extra: Partial<Crypto> = {}): void {
    Object.defineProperty(globalThis, 'crypto', {
      value: { getRandomValues: real.getRandomValues.bind(real), ...extra },
      configurable: true,
    });
  }

  it('uses crypto.randomUUID when available', () => {
    expect(randomUuid()).toMatch(UUID_V4);
  });

  it('generates a v4 UUID without crypto.randomUUID', () => {
    withoutRandomUUID();
    expect(randomUuid()).toMatch(UUID_V4);
  });

  it('generates a UUID without getRandomValues', () => {
    Object.defineProperty(globalThis, 'crypto', { value: undefined, configurable: true });
    expect(randomUuid()).toMatch(UUID_V4);
  });

  it('does not produce duplicates', () => {
    withoutRandomUUID();
    const all = new Set(Array.from({ length: 500 }, () => randomUuid()));
    expect(all.size).toBe(500);
  });
});
