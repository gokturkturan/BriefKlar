import { describe, expect, it } from "vitest";
import { easterSunday, holidayOn, isWorkingDay, nextWorkingDay, publicHolidays } from "./holidays";

describe("easterSunday", () => {
  it.each([
    [2019, "2019-04-21"],
    [2024, "2024-03-31"],
    [2025, "2025-04-20"],
    [2026, "2026-04-05"],
    [2027, "2027-03-28"],
    [2038, "2038-04-25"],
  ])("%i -> %s", (year, expected) => {
    expect(easterSunday(year)).toBe(expected);
  });
});

describe("publicHolidays", () => {
  it("has the nine nationwide holidays when no state is given", () => {
    expect([...publicHolidays(2026).keys()].sort()).toEqual([
      "2026-01-01",
      "2026-04-03", // Good Friday
      "2026-04-06", // Easter Monday
      "2026-05-01",
      "2026-05-14", // Ascension Day
      "2026-05-25", // Whit Monday
      "2026-10-03",
      "2026-12-25",
      "2026-12-26",
    ]);
  });

  it("adds state holidays only for that state", () => {
    expect(holidayOn("2026-06-04", "NW")).toBe("CORPUS_CHRISTI");
    expect(holidayOn("2026-06-04", "BE")).toBeNull();
    expect(holidayOn("2026-06-04")).toBeNull();
    expect(holidayOn("2026-03-08", "BE")).toBe("WOMENS_DAY");
    expect(holidayOn("2026-01-06", "BY")).toBe("EPIPHANY");
    expect(holidayOn("2026-09-20", "TH")).toBe("CHILDRENS_DAY");
  });

  it("knows when state holidays were introduced", () => {
    expect(holidayOn("2018-03-08", "BE")).toBeNull();
    expect(holidayOn("2019-03-08", "BE")).not.toBeNull();
    expect(holidayOn("2022-03-08", "MV")).toBeNull();
    expect(holidayOn("2023-03-08", "MV")).not.toBeNull();
    expect(holidayOn("2016-10-31", "HH")).toBeNull();
    expect(holidayOn("2018-10-31", "HH")).not.toBeNull();
  });

  it("includes one-off holidays", () => {
    expect(holidayOn("2017-10-31")).toBe("REFORMATION_DAY");
    expect(holidayOn("2025-05-08", "BE")).toBe("LIBERATION_DAY");
    expect(holidayOn("2026-05-08", "BE")).toBeNull();
  });

  it("puts Buß- und Bettag on the Wednesday before 23 November in Saxony", () => {
    expect(holidayOn("2025-11-19", "SN")).toBe("REPENTANCE_DAY");
    expect(holidayOn("2026-11-18", "SN")).toBe("REPENTANCE_DAY");
    expect(holidayOn("2026-11-18", "BY")).toBeNull();
  });
});

describe("working days", () => {
  it("treats weekends and holidays as non-working days", () => {
    expect(isWorkingDay("2026-11-20")).toBe(true); // Friday
    expect(isWorkingDay("2026-11-21")).toBe(false); // Saturday
    expect(isWorkingDay("2026-11-22")).toBe(false); // Sunday
    expect(isWorkingDay("2026-12-25")).toBe(false); // Christmas
  });

  it("moves to the next working day across holidays and weekends", () => {
    expect(nextWorkingDay("2026-11-20")).toBe("2026-11-20");
    expect(nextWorkingDay("2026-11-21")).toBe("2026-11-23");
    // Good Friday, Saturday, Easter Sunday, Easter Monday
    expect(nextWorkingDay("2026-04-03")).toBe("2026-04-07");
    // Christmas 2026: Friday 25th, Saturday 26th, Sunday 27th
    expect(nextWorkingDay("2026-12-25")).toBe("2026-12-28");
  });
});
