import type { ExplanationLanguage } from "@briefklar/shared";
import { dirOf } from "../../i18n/I18nProvider";

/** Language attributes for texts that may still be in English on a page in another language */
export const textProps = (language: ExplanationLanguage) => ({ lang: language, dir: dirOf(language) });
