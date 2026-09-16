import { longDate, toExportLang } from './export-i18n';
import { cellText, shortDate, totalText } from './report-layout';

/**
 * Pure formatting helpers behind every PDF and Excel cell. Mistakes here still
 * produce a downloadable file, so e2e tests would not catch them.
 */
describe('toExportLang', () => {
  it('accepts only vi and en', () => {
    expect(toExportLang('en')).toBe('en');
    expect(toExportLang('vi')).toBe('vi');
  });

  it('falls back to Vietnamese for unknown values instead of throwing', () => {
    // A bad display parameter should not fail the download.
    for (const bad of ['zz', '', null, undefined, 123, {}]) {
      expect(toExportLang(bad)).toBe('vi');
    }
  });
});

describe('longDate', () => {
  it('formats the date the way each language reads it', () => {
    expect(longDate('2026-09-16T00:00:00.000Z', 'vi')).toBe('16 tháng 9, 2026');
    expect(longDate('2026-09-16T00:00:00.000Z', 'en')).toBe('16 September 2026');
  });

  it('returns the input unchanged for an invalid date instead of "Invalid Date"', () => {
    expect(longDate('không-phải-ngày', 'vi')).toBe('không-phải-ngày');
  });
});

describe('shortDate', () => {
  it('accepts both YYYY-MM-DD and full ISO timestamps', () => {
    expect(shortDate('2026-09-09')).toBe('9/9/26');
    expect(shortDate('2026-09-16T08:30:00.000Z')).toBe('16/9/26');
  });
});

describe('cellText / totalText', () => {
  it('omits the currency symbol in table cells', () => {
    expect(cellText(300_000, 'VND')).toBe('300.000');
  });

  it('leaves zero cells empty instead of printing "0"', () => {
    // Keeps wide member tables scannable.
    expect(cellText(0, 'VND')).toBe('');
  });

  it('shows owed shares with a minus sign', () => {
    expect(cellText(-100_000, 'VND', true)).toBe('−100.000');
  });

  it('keeps the currency symbol and an explicit sign in total rows', () => {
    expect(totalText(333_333, 'VND')).toBe(`+333.333${' '}₫`);
    expect(totalText(-266_666, 'VND')).toBe(`−266.666${' '}₫`);
  });
});
