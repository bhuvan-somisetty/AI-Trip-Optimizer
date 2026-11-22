import { describe, expect, it } from "vitest";
import { festivalDuring, festivalOn } from "@/lib/festivals";

describe("festival rush periods", () => {
  it("finds Diwali 2027 around 29 October", () => {
    expect(festivalOn("2027-10-29")).toMatchObject({ name: "Diwali and Chhath Puja", from: "2027-10-24", to: "2027-11-06" });
    expect(festivalOn("2027-10-23")).toBeNull();
  });

  it("marks regional festivals with their region", () => {
    expect(festivalOn("2027-09-10")).toMatchObject({ name: "Onam", region: "Kerala" });
    expect(festivalOn("2027-10-07")?.region).toBe("West Bengal and East India");
  });

  it("repeats Christmas to New Year every year, across the change of year", () => {
    expect(festivalOn("2026-12-24")).toEqual({ name: "Christmas and New Year", from: "2026-12-20", to: "2027-01-04" });
    expect(festivalOn("2028-01-02")).toEqual({ name: "Christmas and New Year", from: "2027-12-20", to: "2028-01-04" });
    expect(festivalOn("2028-05-20")?.name).toBe("Summer school holidays");
  });

  it("says nothing on an ordinary day or a bad date", () => {
    expect(festivalOn("2027-02-10")).toBeNull();
    expect(festivalOn("not a date")).toBeNull();
  });

  it("finds a rush anywhere during a trip", () => {
    expect(festivalDuring("2027-10-20", "2027-10-26")?.name).toBe("Diwali and Chhath Puja");
    expect(festivalDuring("2027-02-01", "2027-02-05")).toBeNull();
    expect(festivalDuring("2027-03-20", null)?.name).toBe("Holi");
  });
});
