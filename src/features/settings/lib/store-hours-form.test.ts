import { describe, expect, it } from "vitest";
import { copyDayToAll, emptyWeek, validateWeek } from "./store-hours-form";

describe("store hours form", () => {
  it("accepts an empty week and split shifts", () => {
    expect(validateWeek(emptyWeek())).toEqual({});
    const week = emptyWeek();
    week.sat = [
      { open: "10:00", close: "13:00" },
      { open: "15:00", close: "22:00" },
    ];
    expect(validateWeek(week)).toEqual({});
  });

  it("explains each mistake on its day", () => {
    const week = emptyWeek();
    week.mon = [{ open: "21:00", close: "14:00" }];
    week.tue = [{ open: "", close: "14:00" }];
    week.wed = [
      { open: "10:00", close: "14:00" },
      { open: "13:00", close: "18:00" },
    ];
    week.thu = [
      { open: "08:00", close: "09:00" },
      { open: "10:00", close: "11:00" },
      { open: "12:00", close: "13:00" },
      { open: "14:00", close: "15:00" },
    ];
    const errors = validateWeek(week);
    expect(errors.mon).toMatch(/después/);
    expect(errors.tue).toMatch(/Completa/);
    expect(errors.wed).toMatch(/traslapan/);
    expect(errors.thu).toMatch(/Máximo 3/);
    expect(errors.fri).toBeUndefined();
  });

  it("copies a day to the whole week without sharing objects", () => {
    const week = emptyWeek();
    week.mon = [{ open: "14:00", close: "21:00" }];
    const copied = copyDayToAll(week, "mon");
    expect(copied.sun).toEqual([{ open: "14:00", close: "21:00" }]);
    copied.sun[0].open = "15:00";
    expect(copied.mon[0].open).toBe("14:00");
  });
});
