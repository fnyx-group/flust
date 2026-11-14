type PluralCategory = 'one' | 'other';

const cardinalRules: Record<string, (n: number) => PluralCategory> = {
  en: (n) => (n === 1 ? 'one' : 'other'),
  fr: (n) => (Math.trunc(Math.abs(n)) <= 1 ? 'one' : 'other'),
};

class FallbackPluralRules {
  private readonly selectCategory: (n: number) => PluralCategory;

  constructor(locale: string, options?: { type?: 'cardinal' | 'ordinal' }) {
    const language = locale.split(/[-_]/)[0]?.toLowerCase() ?? '';
    const rule = cardinalRules[language];
    // Ordinals are not used in the app; treating them as invariant keeps lookups safe.
    this.selectCategory = options?.type === 'ordinal' || !rule ? () => 'other' : rule;
  }

  select(n: number): PluralCategory {
    return this.selectCategory(n);
  }

  resolvedOptions(): { pluralCategories: PluralCategory[] } {
    const categories = new Set([this.selectCategory(1), this.selectCategory(2)]);
    return { pluralCategories: [...categories] };
  }
}

// Hermes ships Intl without PluralRules, and i18next would otherwise use English rules for French.
export function ensurePluralRules(): void {
  const global = globalThis as { Intl?: { PluralRules?: unknown } };
  if (typeof global.Intl?.PluralRules === 'function') return;
  global.Intl = Object.assign(global.Intl ?? {}, { PluralRules: FallbackPluralRules });
}
