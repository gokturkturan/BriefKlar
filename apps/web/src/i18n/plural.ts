/** Plural forms of one word; "#" is replaced by the number */
export type PluralForms = Partial<Record<Intl.LDMLPluralRule, string>> & { other: string };

const rules = new Map<string, Intl.PluralRules>();

/** Picks the plural form with the rules of the locale (Russian, Ukrainian and Arabic have up to six) */
export function plural(locale: string, count: number, forms: PluralForms): string {
  let pluralRules = rules.get(locale);
  if (!pluralRules) {
    pluralRules = new Intl.PluralRules(locale);
    rules.set(locale, pluralRules);
  }
  const form = forms[pluralRules.select(count)] ?? forms.other;
  return form.replace("#", String(count));
}
