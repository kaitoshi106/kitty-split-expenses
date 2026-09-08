import { TestBed } from '@angular/core/testing';
import { I18nService } from './i18n.service';
import { en } from './translations.en';
import { vi } from './translations.vi';

describe('I18nService', () => {
  let service: I18nService;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({});
    service = TestBed.inject(I18nService);
  });

  it('defaults to Vietnamese', () => {
    expect(service.lang()).toBe('vi');
    expect(service.t('common.save')).toBe('Lưu');
  });

  it('switches every string when the language changes', () => {
    service.setLang('en');
    expect(service.t('common.save')).toBe('Save');
    service.setLang('vi');
    expect(service.t('common.save')).toBe('Lưu');
  });

  it('persists the choice in localStorage', () => {
    service.setLang('en');
    expect(localStorage.getItem('kitty.lang')).toBe('en');
  });

  it('substitutes parameters', () => {
    expect(service.t('join.memberCount', { n: 3 })).toBe('3 thành viên');
    service.setLang('en');
    expect(service.t('join.memberCount', { n: 3 })).toBe('3 members');
  });

  it('keeps the placeholder when a parameter is missing', () => {
    expect(service.t('join.memberCount', {})).toBe('{n} thành viên');
  });

  it('updates the document lang attribute for screen readers', () => {
    service.setLang('en');
    expect(document.documentElement.lang).toBe('en');
  });
});

describe('dictionaries', () => {
  it('English has every Vietnamese key', () => {
    // Also enforced by Record<TranslationKey, string>; this catches `as any` escapes.
    const viKeys = Object.keys(vi).sort();
    const enKeys = Object.keys(en).sort();
    expect(enKeys).toEqual(viKeys);
  });

  it('has no empty strings', () => {
    for (const [key, value] of Object.entries({ ...vi })) {
      expect(value.length).toBeGreaterThan(0);
      if (!value.length) throw new Error(`empty key: ${key}`);
    }
    for (const [key, value] of Object.entries(en)) {
      expect(value.length).toBeGreaterThan(0);
      if (!value.length) throw new Error(`empty key: ${key}`);
    }
  });

  it('uses the same parameters in both languages', () => {
    const params = (s: string) => (s.match(/\{(\w+)\}/g) ?? []).sort().join(',');
    for (const key of Object.keys(vi) as (keyof typeof vi)[]) {
      expect(`${key}:${params(en[key])}`).toBe(`${key}:${params(vi[key])}`);
    }
  });
});
