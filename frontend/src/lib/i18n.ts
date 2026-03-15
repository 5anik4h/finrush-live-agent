import { en, type Translations } from "./locales/en";
import { es } from "./locales/es";

export type Lang = "en" | "es";

const locales: Record<Lang, Translations> = { en, es };

export { en, es, type Translations };

/**
 * Simple translation function — resolves dot-notation keys against the locale object.
 * Supports variable replacement: t("en", "voice.greeting", { name: "Saki" }) → "Hello, Saki"
 */
export function t(lang: Lang, key: string, variables?: Record<string, string | number>): string {
  const locale = locales[lang];
  const parts = key.split(".");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let node: any = locale;
  for (const part of parts) {
    if (node == null || typeof node !== "object") return key;
    node = node[part];
  }
  
  if (typeof node !== "string") return key;

  if (variables) {
    let result = node;
    Object.entries(variables).forEach(([vKey, vValue]) => {
      result = result.replace(new RegExp(`\\{${vKey}\\}`, 'g'), String(vValue));
    });
    return result;
  }

  return node;
}
