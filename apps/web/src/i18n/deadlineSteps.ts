import { HOLIDAY_GERMAN_NAMES, type DeadlineStep, type NonWorkingDay } from "@briefklar/shared";
import type { I18n } from "./I18nProvider";

/** "Ostermontag" in German, "Easter Monday (Ostermontag)" in other languages */
function holidayName({ t, language }: I18n, id: keyof typeof HOLIDAY_GERMAN_NAMES): string {
  const german = HOLIDAY_GERMAN_NAMES[id];
  return language === "de" ? german : `${t.holidays[id]} (${german})`;
}

function reasonText(i18n: I18n, reason: NonWorkingDay): string {
  if (reason === "SATURDAY" || reason === "SUNDAY") return i18n.t.nonWorkingDay[reason];
  return i18n.t.nonWorkingDay.holiday(holidayName(i18n, reason));
}

/** One step of a deadline calculation in the reader's language */
export function deadlineStepText(i18n: I18n, step: DeadlineStep): string {
  const { t } = i18n;
  const texts = t.deadlineSteps;
  const date = (iso: string) => i18n.formatDate(iso, "weekday");
  // Without the weekday where the sentence names it ("13 December 2026 is a Sunday")
  const day = (iso: string) => i18n.formatDate(iso);

  switch (step.type) {
    case "START_ASSUMED":
      return texts.START_ASSUMED();
    case "RECEIVED_ON":
      return texts.RECEIVED_ON(date(step.date));
    case "STARTS_ON_LETTER_DATE":
      return texts.STARTS_ON_LETTER_DATE(date(step.date));
    case "DEEMED_DELIVERY":
      return texts.DEEMED_DELIVERY(step.days, date(step.letterDate), date(step.deliveryDate));
    case "COUNTED_FROM_LETTER_DATE":
      return texts.COUNTED_FROM_LETTER_DATE(date(step.date));
    case "YELLOW_ENVELOPE":
      return texts.YELLOW_ENVELOPE();
    case "DELIVERY_MOVED":
      return texts.DELIVERY_MOVED(day(step.date), reasonText(i18n, step.reason), date(step.movedTo));
    case "PERIOD_ENDS":
      return texts.PERIOD_ENDS(t.period(step.amount, step.unit), date(step.start), date(step.end));
    case "DEADLINE_MOVED":
      return texts.DEADLINE_MOVED(day(step.date), reasonText(i18n, step.reason), date(step.movedTo));
    case "REGIONAL_HOLIDAY":
      return texts.REGIONAL_HOLIDAY(day(step.date), step.states.join(", "));
  }
}
